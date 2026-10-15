import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRoom, type RoomApi, type Me } from "@/lib/room-engine";
import { syncPlayer } from "@/lib/player-sync";
import { percentile } from "@/lib/sync";
export const Route = createFileRoute("/diagnostics")({
  head: () => ({ meta: [{ title: "Playback verification — Watch Together" }] }),
  component: Diagnostics,
});
type Viewer = { room: () => RoomApi; video: () => HTMLVideoElement | null };
function ViewerPlayer({
  index,
  code,
  session,
  register,
}: {
  index: number;
  code: string;
  session: string;
  register: (index: number, viewer: Viewer | null) => void;
}) {
  const [me] = useState<Me>({
    id: `bench_${session}_${index}`,
    name: `Test viewer ${index + 1}`,
    color: "#a43b32",
  });
  const room = useRoom(code, me),
    current = useRef(room),
    video = useRef<HTMLVideoElement>(null);
  current.current = room;
  useEffect(() => {
    register(index, { room: () => current.current, video: () => video.current });
    return () => register(index, null);
  }, [index, register]);
  useEffect(() => {
    const timer = setInterval(() => {
      const r = current.current,
        v = video.current;
      if (!v || !r.state.playback.videoId) return;
      const sample = syncPlayer(v, r.state.playback, r.hostNow());
      if (sample)
        r.api.observePlayer(sample.actual, sample.expected, sample.applied, sample.sampleable);
    }, 50);
    return () => clearInterval(timer);
  }, []);
  return (
    <figure>
      <video ref={video} src="/diagnostics/fixture.mp4" preload="auto" muted playsInline />
      <figcaption>
        Viewer {index + 1} · {room.status}
        {room.isHost ? " · host" : ""}
      </figcaption>
    </figure>
  );
}
function Diagnostics() {
  const [session, setSession] = useState(""),
    [status, setStatus] = useState("Ready to start"),
    [report, setReport] = useState("");
  const viewers = useRef(new Map<number, Viewer>()),
    running = useRef(false);
  useEffect(
    () => () => {
      running.current = false;
    },
    [],
  );
  const register = useCallback((i: number, v: Viewer | null) => {
    if (v) viewers.current.set(i, v);
    else viewers.current.delete(i);
  }, []);
  const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  async function until(check: () => boolean, timeout = 25000) {
    const deadline = Date.now() + timeout;
    while (!check()) {
      if (!running.current) throw Error("Test stopped");
      if (Date.now() > deadline)
        throw Error(
          "Timed out waiting for ten connected viewers and loaded videos. Check the room server and retry.",
        );
      await pause(100);
    }
  }
  async function run() {
    if (running.current) return;
    running.current = true;
    setReport("");
    const token = crypto.randomUUID().slice(0, 8);
    setSession(token);
    setStatus("Connecting ten native video players…");
    try {
      await until(
        () =>
          viewers.current.size === 10 &&
          [...viewers.current.values()].every(
            (v) =>
              v.room().ready &&
              v.room().members.length === 10 &&
              !!v.video() &&
              v.video()!.readyState >= 2,
          ),
      );
      await pause(3500);
      const host = [...viewers.current.values()].find((v) => v.room().isHost);
      if (!host) throw Error("Host election did not converge");
      host.room().api.load(location.origin + "/diagnostics/fixture.mp4");
      await until(() =>
        [...viewers.current.values()].every((v) => !!v.room().state.playback.videoId),
      );
      await pause(1000);
      for (const v of viewers.current.values()) v.room().api.resetMeasurements();
      const startedAt = new Date().toISOString();
      for (let round = 0; round < 30; round++) {
        if (!running.current) throw Error("Test stopped");
        setStatus(`Measuring control ${round + 1} of 30 across ten viewers…`);
        const r = host.room();
        if (round % 3 === 0) r.api.play();
        else if (round % 3 === 1) r.api.pause();
        else r.api.seek(2 + (round % 5));
        if (round === 15) {
          const guest = [...viewers.current.values()].find((v) => !v.room().isHost)?.video();
          if (guest) guest.currentTime += 0.8;
        }
        await pause(900);
      }
      host.room().api.pause();
      await pause(1200);
      const results = [...viewers.current.entries()].map(([index, v]) => ({
        viewer: index + 1,
        isHost: v.room().isHost,
        connected: v.room().status === "live",
        clockRttMs: v.room().stats.rtt(),
        ...v.room().stats.player(),
      }));
      const remote = results.filter((v) => !v.isHost),
        latency = remote.flatMap((v) => v.latency),
        drift = results.flatMap((v) => v.drift);
      const complete =
        results.length === 10 &&
        results.every((v) => v.connected && v.latency.length >= 30 && v.drift.length > 0);
      const payload = {
        startedAt,
        finishedAt: new Date().toISOString(),
        browser: navigator.userAgent,
        origin: location.origin,
        topology:
          "Ten native HTMLVideoElements and ten independent room engines in one browser page on one computer. Localhost is loopback; a public deployment uses its configured remote relay. This is not ten physical LAN devices.",
        fixture: "/diagnostics/fixture.mp4",
        samplePeriodMs: 50,
        controlSpacingMs: 900,
        commands: 30,
        cleanupCommands: 1,
        driftInjectionSeconds: 0.8,
        settlingWindowMs: 500,
        viewers: results,
        remoteLatencySamples: latency.length,
        settledDriftSamples: drift.length,
        p50LatencyMs: latency.length ? percentile(latency, 50) : null,
        p95LatencyMs: latency.length ? percentile(latency, 95) : null,
        maxSettledDriftMs: drift.length ? Math.max(...drift) : null,
        complete,
        withinTargets: complete && percentile(latency, 95) <= 250 && Math.max(...drift) <= 500,
      };
      setReport(JSON.stringify(payload, null, 2));
      setStatus(
        payload.withinTargets
          ? "Completed — within targets for these test conditions"
          : "Completed — review results; a target or sample count was not met",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Test failed");
    } finally {
      running.current = false;
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([report], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "watch-together-browser-benchmark.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="club-site diagnostics-page">
      <header className="club-nav">
        <Link to="/">← Watch Together</Link>
        <Link to="/docs">Test method & limitations</Link>
      </header>
      <h1>Playback verification.</h1>
      <p>
        Thirty play, pause and seek commands, ten independent room connections, ten native video
        players, and one deliberate 0.8-second drift. This uses the same room engine and correction
        function as the screening room.
      </p>
      <p>
        Keep this page in the foreground. The included W3C test clip is diagnostic media, not a
        recommendation. Sound is muted. The run takes about forty seconds.
      </p>
      <button
        className="feature-button"
        disabled={!!session && !report && status.startsWith("Measuring")}
        onClick={() => void run()}
      >
        Run ten-player check
      </button>
      <p role="status">{status}</p>
      <div className="benchmark-grid">
        {session &&
          Array.from({ length: 10 }, (_, i) => (
            <ViewerPlayer
              key={`${session}-${i}`}
              index={i}
              code={`bench_${session}`}
              session={session}
              register={register}
            />
          ))}
      </div>
      {report && (
        <>
          <h2>Measured results</h2>
          <p>
            This report describes the actual topology above. For the assignment’s physical LAN test,
            open one screening room on ten browser viewers across your LAN and export “Playback
            measurements” from every viewer.
          </p>
          <button className="feature-button" onClick={download}>
            Download benchmark JSON
          </button>
          <textarea aria-label="Benchmark report" readOnly value={report} rows={12} />
        </>
      )}
    </main>
  );
}

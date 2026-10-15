import { useEffect, useState } from "react";
import type { RoomApi } from "@/lib/room-engine";
import { percentile } from "@/lib/sync";
export function RoomDiagnostics({ room, code }: { room: RoomApi; code: string }) {
  const [, refresh] = useState(0);
  const [conditions, setConditions] = useState("");
  useEffect(() => {
    const timer = setInterval(() => refresh((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const samples = room.stats.player();
  function download() {
    const data = {
      recordedAt: new Date().toISOString(),
      room: code,
      viewers: room.members.length,
      conditions,
      browser: navigator.userAgent,
      clockRttMs: room.stats.rtt(),
      clockOffsetMs: room.stats.offset(),
      definition:
        "Command issue to native video state observed; scheduled countdowns excluded. Drift sampled once a command is applied and at least 500 ms old. Per-viewer samples; collect every viewer for a room-wide report.",
      latencyMs: samples.latency,
      settledDriftMs: samples.drift,
      p95LatencyMs: samples.latency.length ? percentile(samples.latency, 95) : null,
      maxSettledDriftMs: samples.drift.length ? Math.max(...samples.drift) : null,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `watch-together-${code}-measurements.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <details className="room-library">
      <summary>Playback measurements</summary>
      <div className="room-measurements">
        <p>
          {room.members.length} viewers · {samples.latency.length} applied control samples
        </p>
        <p>
          Applied control latency p50 / p95:{" "}
          {samples.latency.length
            ? `${Math.round(percentile(samples.latency, 50))} / ${Math.round(percentile(samples.latency, 95))} ms`
            : "Waiting for play, pause or seek controls"}
        </p>
        <p>
          Maximum settled drift:{" "}
          {samples.drift.length
            ? `${Math.round(Math.max(...samples.drift))} ms`
            : "Waiting for stable playback"}
        </p>
        <label>
          Test conditions
          <input
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            placeholder="Devices, browser, LAN / Wi-Fi, video, buffering…"
          />
        </label>
        <button className="feature-button" disabled={!samples.latency.length} onClick={download}>
          Export this viewer’s measurements
        </button>
        <p>
          Collect exports from every viewer. A localhost test is not proof of a physical LAN result.
          Video decoding, buffering, device clocks and network conditions affect measurements.
        </p>
      </div>
    </details>
  );
}

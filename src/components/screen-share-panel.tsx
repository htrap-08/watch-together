import { useCallback, useEffect, useRef, useState } from "react";
import { RealtimeChannel } from "@/lib/realtime-channel";
import { ScreenPeers } from "@/lib/screen-peers";

type Host = { id: string; session: string };
export function ScreenSharePanel({
  code,
  id,
  isHost,
  connected,
}: {
  code: string;
  id: string;
  isHost: boolean;
  connected: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const captured = useRef<MediaStream | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const peers = useRef<ScreenPeers | null>(null);
  const host = useRef<Host | null>(null);
  const activeSession = useRef<string | null>(null);
  const alive = useRef(false);
  const canShare = useRef(isHost);
  canShare.current = isHost;
  const [sharing, setSharing] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [error, setError] = useState("");
  const [audio, setAudio] = useState(true);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const stop = useCallback(() => {
    activeSession.current = null;
    const stream = captured.current;
    captured.current = null;
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    peers.current?.reset();
    if (video.current) video.current.srcObject = null;
    setSharing(false);
    setReceiving(false);
    channel.current?.track({ id, session: null });
  }, [id]);
  useEffect(() => {
    alive.current = true;
    const transport = new RealtimeChannel(`share_${code}`, id);
    channel.current = transport;
    const send = (payload: Record<string, unknown>) =>
      transport.send({ type: "broadcast", event: "share", payload });
    const controller = new ScreenPeers(
      id,
      send,
      (stream) => {
        if (captured.current) return;
        if (video.current) {
          video.current.srcObject = stream;
          video.current.muted = false;
        }
        setReceiving(!!stream);
      },
      setError,
    );
    peers.current = controller;
    transport
      .on("presence", { event: "sync" }, () => {
        const members = Object.values(
          transport.presenceState<{ id: string; session?: string }>(),
        ).flat();
        controller.retain(new Set(members.map((member) => member.id)));
        const sharer = members.find(
          (member) => member.id !== id && typeof member.session === "string" && member.session,
        );
        const next = sharer ? { id: sharer.id, session: sharer.session! } : null;
        if (host.current?.session !== next?.session || host.current?.id !== next?.id) {
          if (!captured.current) controller.reset();
          host.current = next;
          if (next) send({ to: next.id, session: next.session, kind: "request" });
        }
      })
      .on("broadcast", { event: "share" }, ({ payload }) => {
        void controller
          .message(payload, host.current?.id ?? null, host.current?.session ?? null)
          .catch(() => setError("Couldn’t connect the shared video. Try reconnecting."));
      })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") transport.track({ id, session: activeSession.current });
        else {
          controller.reset();
          host.current = null;
          if (captured.current && activeSession.current)
            controller.share(captured.current, activeSession.current);
        }
      });
    return () => {
      alive.current = false;
      stop();
      transport.close();
      channel.current = null;
      peers.current = null;
      host.current = null;
    };
  }, [code, id, stop]);
  useEffect(() => {
    if (!isHost && captured.current) stop();
  }, [isHost, stop]);
  async function start() {
    setError("");
    setBusy(true);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia)
        throw new Error("Tab sharing isn’t supported in this browser. Try desktop Chrome or Edge.");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 24, max: 30 } },
        audio: true,
      });
      if (!alive.current || !canShare.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const session = crypto.randomUUID();
      captured.current = stream;
      activeSession.current = session;
      peers.current?.share(stream, session);
      if (video.current) {
        video.current.srcObject = stream;
        video.current.muted = true;
      }
      setSharing(true);
      setAudio(stream.getAudioTracks().length > 0);
      stream.getVideoTracks()[0]!.onended = stop;
      channel.current?.track({ id, session });
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Sharing was cancelled or permission was denied. Choose a tab when you’re ready."
          : cause instanceof Error
            ? cause.message
            : "Couldn’t start sharing.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="screen-share-panel">
      <div className="share-screen">
        <video ref={video} autoPlay playsInline controls={!isHost} aria-label="Shared tab video" />
        {!sharing && !receiving && (
          <div className="share-empty">
            <h2>{isHost ? "Your tab is the big screen." : "Waiting for the host’s screen."}</h2>
            <p>
              {isHost
                ? "Open the video in another tab, then choose it in the browser’s sharing picker."
                : "The picture will appear here when the host starts sharing. Press play if your browser asks."}
            </p>
          </div>
        )}
      </div>
      <div className="share-actions">
        {isHost ? (
          <button
            className="action-primary"
            disabled={!connected || !live || busy}
            onClick={() => (sharing ? stop() : void start())}
          >
            {sharing ? "Stop sharing" : busy ? "Opening picker…" : "Share a tab"}
          </button>
        ) : (
          <button
            className="action-secondary"
            disabled={!live || !host.current}
            onClick={() => {
              peers.current?.reset();
              setError("");
              const h = host.current;
              if (h)
                channel.current?.send({
                  type: "broadcast",
                  event: "share",
                  payload: { to: h.id, session: h.session, kind: "request" },
                });
            }}
          >
            Reconnect video
          </button>
        )}
        <span>
          {live
            ? sharing
              ? "Sharing live"
              : receiving
                ? "Connected to shared video"
                : "Ready for screen sharing"
            : "Connecting…"}
        </span>
      </div>
      {sharing && !audio && (
        <p className="share-warning">
          No audio was captured. Stop and select a browser tab with “Share tab audio” enabled.
        </p>
      )}
      {error && (
        <p role="alert" className="share-warning">
          {error}
        </p>
      )}
      <p className="share-note">
        Use ordinary YouTube videos, Twitch or other unprotected content. DRM films may show a black
        picture; use Streaming service mode for those. Desktop Chrome / Edge gives the best chance
        of tab audio.
      </p>
      <p className="share-note">
        Sharing uses direct peer connections. Restrictive networks may block video, and the host’s
        upload speed limits room size. No recording is saved.
      </p>
    </section>
  );
}

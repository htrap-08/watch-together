import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, MonitorPlay, Users } from "lucide-react";
import { extensionMessage } from "@/lib/extension-bridge";
import { extensionSetup, useStreamingRoom } from "@/lib/streaming";

export function StreamingPanel({
  code,
  id,
  name,
  onPlaying,
}: {
  code: string;
  id: string;
  name: string;
  onPlaying?: (playing: boolean) => void;
}) {
  const { snapshot, connection, retry, send } = useStreamingRoom(code, id);
  useEffect(() => {
    onPlaying?.(connection === "Connected" && !!snapshot?.playback.playing);
  }, [snapshot?.playback.playing, connection, onPlaying]);
  const [extension, setExtension] = useState<string | null>(null);
  const [handoff, setHandoff] = useState("");
  useEffect(() => {
    let active = true;
    void extensionMessage("hello")
      .then((result) => {
        if (active) setExtension(result.version ?? "0.2");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const [setup, setSetup] = useState("");
  const copy = async () => {
    const token = extensionSetup(code);
    setSetup(token);
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setManual(true);
    }
  };
  const host = snapshot?.members.find((member) => member.id === snapshot.hostId);
  return (
    <section className="streaming-panel">
      <div className="streaming-heading">
        <MonitorPlay size={26} />
        <div>
          <p className="eyebrow">STREAMING COMPANION</p>
          <h2>Watch on your streaming site.</h2>
        </div>
      </div>
      <p className="streaming-intro">
        Everyone opens the same film with their own account. The extension syncs playback; this room
        keeps the conversation together.
      </p>
      <div className="streaming-steps">
        <div>
          <span>01</span>
          <h3>Install the companion</h3>
          <p>Download and load the extension in desktop Chrome or Edge.</p>
          <Link to="/streaming" className="text-link">
            <Download size={14} /> Installation & compatibility
          </Link>
        </div>
        <div>
          <span>02</span>
          <h3>Connect your video tab</h3>
          <p>
            Send the room below, then open your film and click the extension. Copying the setup
            still works as a fallback.
          </p>
          <button
            className="action-primary"
            onClick={() =>
              void extensionMessage("prepare", { setup: extensionSetup(code), name })
                .then((result) => {
                  setExtension(result.version ?? "0.2");
                  setHandoff(
                    "Room sent. Open your film, click the extension, and choose Connect this video tab.",
                  );
                })
                .catch((error) => setHandoff(error.message))
            }
          >
            Send room to extension
          </button>
          <p className="feature-muted">
            {extension
              ? "Extension v" + extension + " detected."
              : "Use companion v0.2 for the copy-free setup."}
          </p>
          {handoff && <p role="status">{handoff}</p>}
          <button className="action-secondary" onClick={() => void copy()}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Setup copied" : "Copy extension setup"}
          </button>
        </div>
        <div>
          <span>03</span>
          <h3>Play together</h3>
          <p>
            The first connected streaming viewer hosts. Playback controls stay on the streaming tab;
            chat works here and in the extension.
          </p>
        </div>
      </div>
      {manual && (
        <label className="setup-fallback">
          Copy this setup manually
          <textarea readOnly value={setup} onFocus={(event) => event.target.select()} />
        </label>
      )}
      {connection !== "Connected" && (
        <div className="feature-recovery" role="status">
          <p>
            Room connection interrupted. Your streaming accounts and video stay on their own sites.
          </p>
          <button className="feature-button" onClick={retry}>
            Reconnect room
          </button>
        </div>
      )}
      <div className="streaming-session">
        <div className="streaming-session-title">
          <span className="connection">
            <i /> {connection}
          </span>
          <span>
            <Users size={14} /> {snapshot?.members.length ?? 0} streaming viewers
          </span>
        </div>
        {snapshot?.target && host ? (
          <>
            <h3>{snapshot.target.title}</h3>
            <p>
              {snapshot.target.service} · hosted by {host.name} ·{" "}
              {host.ad ? "ad break" : snapshot.playback.playing ? "playing" : "paused"}
            </p>
            <a
              className="action-secondary"
              href={snapshot.target.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the host’s title <ExternalLink size={14} />
            </a>
          </>
        ) : (
          <>
            <h3>Waiting for a streaming tab.</h3>
            <p>Connect the extension from your video page. Nothing is screen-shared or uploaded.</p>
          </>
        )}
        {snapshot?.intermission && (
          <p className="feature-notice" role="status">
            Intermission requested by {snapshot.intermission.name}. Mark ready in the extension; the
            host can resume once everyone is ready.
          </p>
        )}
        {!!snapshot?.members.length && (
          <div className="streaming-ready-summary">
            <p>
              {
                snapshot.members.filter(
                  (member) => member.ready && member.url === snapshot.target?.url && !member.ad,
                ).length
              }{" "}
              / {snapshot.members.length} ready
            </p>
            <button
              className="feature-button"
              onClick={() => send("stream_break", { name })}
              disabled={!!snapshot.intermission}
            >
              Request intermission
            </button>
          </div>
        )}
        {!!snapshot?.members.length && (
          <ul className="streaming-members">
            {snapshot.members.map((member) => (
              <li key={member.id}>
                <b>
                  {member.name}
                  {member.id === snapshot.hostId ? " · host" : ""}
                </b>
                <span>
                  {member.url !== snapshot.target?.url
                    ? "Different title — open the host’s film"
                    : member.ad
                      ? "Advertisement — waiting"
                      : member.ready
                        ? "Ready"
                        : member.status + " · not marked ready"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="streaming-limit">
        Service adapters are in preview. Ad-based plans, live streams, embedded players, and title
        changes can need manual intervention.{" "}
        <Link to="/streaming">View compatibility details →</Link>
      </p>
    </section>
  );
}

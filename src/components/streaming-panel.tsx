import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, MonitorPlay, Users } from "lucide-react";
import { selectionKey, type DiscoveryTitle } from "@/lib/discovery";
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
  const [selection, setSelection] = useState<DiscoveryTitle | null>(null);
  useEffect(() => {
    try {
      setSelection(JSON.parse(sessionStorage.getItem(selectionKey(code)) || "null"));
    } catch {
      setSelection(null);
    }
  }, [code]);
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
      <p className="extension-explainer">
        The film plays on Netflix or your chosen service, not inside this page. Keep both tabs open:
        the service for video, this room for chat. Every friend follows these steps on their own
        computer.
      </p>
      {selection && (
        <div className="streaming-session">
          <h3>Tonight’s pick: {selection.title}</h3>
          <p>
            {selection.kind} · {selection.platform} · India
          </p>
          <a className="action-secondary" href={selection.url} target="_blank" rel="noreferrer">
            Open on {selection.platform} <ExternalLink size={14} />
          </a>
          <p className="feature-muted">
            Open the actual episode, then connect the extension from that tab. The connected host’s
            title below is authoritative for other viewers.
          </p>
        </div>
      )}
      <div className="streaming-steps">
        <div>
          <span>01</span>
          <h3>Install the companion</h3>
          <p>
            Download the ZIP, extract it, then open chrome://extensions or edge://extensions. Turn
            on Developer mode, click “Load unpacked” and select the extracted folder containing
            manifest.json. Pin Watch Together from the browser’s extensions menu, then refresh this
            room.
          </p>
          <a className="text-link" href="/watch-together-extension.zip" download>
            <Download size={14} /> Download extension ZIP
          </a>
          <Link to="/streaming" className="text-link" target="_blank" rel="noreferrer">
            <Download size={14} /> Installation & compatibility
          </Link>
        </div>
        <div>
          <span>02</span>
          <h3>Connect your video tab</h3>
          <p>
            Click “Send room to extension” here. In a separate tab, sign in to your streaming
            service and open the actual film or episode. Click the pinned Watch Together icon on
            that video tab, check the room code and click “Connect this video tab”. Allow the site
            access it requests.
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
              : "No extension detected yet. Install it, then refresh this room."}
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
            Each viewer waits for the player to load, then clicks “I’m ready” in the extension. The
            first person to connect is the streaming host. Once everyone is ready, the host presses
            Play on their streaming site. The host’s play, pause and seek controls sync the others.
          </p>
        </div>
      </div>
      <details className="extension-troubleshooting">
        <summary>Invite friends or troubleshoot setup</summary>
        <p>
          <b>Invite friends:</b> use “Invite friends” at the top of this room. Each person opens
          that link, installs the extension and sends the room to their own extension. They need
          access to the same title and service.
        </p>
        <p>
          <b>Handoff didn’t work?</b> refresh this room after installing. Or click “Copy extension
          setup” and paste it into “Room setup or six-character code” in the popup on your video
          tab. Leave Server settings at their defaults.
        </p>
        <p>
          <b>Already connected to another room?</b> click “Disconnect this tab” in the extension
          before connecting to this room.
        </p>
        <p>
          <b>“I’m ready” is disabled?</b> open the host’s exact episode, wait for ads to finish,
          press play once and pause, then click “Find player again”. The player must be found before
          you can mark ready.
        </p>
        <p>
          <b>Connected here does not mean your video tab is connected.</b> Check that your name
          appears below as a streaming viewer. “Room sent” only fills the extension setup; you still
          need to connect it from the video tab.
        </p>
      </details>
      {manual && (
        <label className="setup-fallback">
          Copy this setup manually
          <textarea readOnly value={setup} onFocus={(event) => event.target.select()} />
        </label>
      )}
      {connection === "Reconnecting" && (
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

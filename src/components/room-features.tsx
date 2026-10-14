import { useState } from "react";
import { Check, Pause, Play, RefreshCw } from "lucide-react";
import type { RoomApi, Me } from "@/lib/room-engine";
export function ReadyLobby({ room, me }: { room: RoomApi; me: Me }) {
  const s = room.state;
  const mine = room.members.find((member) => member.id === me.id);
  const open = !!s.playback.videoId && (!s.started || !!s.intermission) && !s.ended;
  if (!open) return null;
  return (
    <section className="ready-lobby">
      <div>
        <h2>{s.intermission ? "Intermission." : "Everyone settled in?"}</h2>
        <p>
          {s.intermission
            ? `${s.intermission.name} requested a break. Mark ready when you’re back.`
            : "Your film is loaded. Mark ready when you’re ready to watch."}
        </p>
      </div>
      <ul>
        {room.members.map((member) => (
          <li key={member.id}>
            <span>
              {member.name}
              {member.id === me.id ? " (you)" : ""}
            </span>
            <span>
              {member.playerStatus !== "Player connected" ? (
                (member.playerStatus ?? "Loading player")
              ) : member.readyFor === s.playback.videoId ? (
                <>
                  <Check size={12} /> Ready
                </>
              ) : (
                "Not ready yet"
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="ready-actions">
        <button
          className="feature-button"
          disabled={room.status !== "live" || mine?.playerStatus !== "Player connected"}
          aria-pressed={mine?.readyFor === s.playback.videoId}
          onClick={() => room.api.setViewerReady(mine?.readyFor !== s.playback.videoId)}
        >
          {mine?.readyFor === s.playback.videoId ? "Ready ✓ · undo" : "I’m ready"}
        </button>
        {room.isHost ? (
          <button
            className="feature-button feature-primary"
            disabled={!room.allReady || room.status !== "live"}
            onClick={() => room.api.startScreening()}
          >
            <Play size={14} />
            {s.intermission ? "Resume screening" : "Start together"}
          </button>
        ) : (
          <span>Waiting for the host to start.</span>
        )}
      </div>
    </section>
  );
}
export function RoomRecovery({ room }: { room: RoomApi }) {
  if (room.status === "live" && room.ready) return null;
  return (
    <div className="feature-recovery" role="status">
      <RefreshCw size={16} />
      <span>
        {room.status === "reconnecting"
          ? "Connection lost. Restoring your place in the room…"
          : "Connecting and restoring the screening…"}
      </span>
      {room.status === "reconnecting" && (
        <button className="feature-button" onClick={() => location.reload()}>
          Reconnect now
        </button>
      )}
    </div>
  );
}
export function ScreeningActions({ room }: { room: RoomApi }) {
  return (
    <div className="screening-tools">
      <button
        className="feature-button"
        disabled={
          !room.state.playback.videoId ||
          !!room.state.intermission ||
          room.state.ended ||
          room.status !== "live"
        }
        onClick={() => room.api.intermission()}
      >
        <Pause size={13} /> Intermission
      </button>
      {room.state.started && !room.state.ended && room.isHost && (
        <button className="feature-button" onClick={() => room.api.finish()}>
          Finish & discuss
        </button>
      )}
    </div>
  );
}
export function AfterCredits({
  room,
  me,
  onSave,
}: {
  room: RoomApi;
  me: Me;
  onSave?: ((score: number, text: string) => Promise<void>) | undefined;
}) {
  const [score, setScore] = useState(4);
  const [text, setText] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  if (!room.state.ended || !room.state.playback.videoId) return null;
  const reviews = Object.values(room.state.reviews[room.state.playback.videoId] ?? {});
  const mine = room.state.reviews[room.state.playback.videoId]?.[me.id];
  return (
    <section className="after-credits">
      <h2>After the credits.</h2>
      <p>What stayed with you? A favourite scene, a question, something you’d change?</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          room.api.review(score, text);
          setShow(true);
          if (onSave) {
            try {
              await onSave(score, text);
              setMessage("Review saved to club history.");
            } catch (e) {
              setMessage(
                "Shared in this room. Club save: " +
                  (e instanceof Error ? e.message : "Please retry."),
              );
            }
          }
        }}
      >
        <label>
          Your rating
          <select value={score} onChange={(event) => setScore(Number(event.target.value))}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value} / 5
              </option>
            ))}
          </select>
        </label>
        <label>
          Your thoughts
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            placeholder="Stay a little longer…"
          />
        </label>
        <button className="feature-button feature-primary" disabled={room.status !== "live"}>
          {mine ? "Update your review" : "Share your review"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <button className="feature-button" onClick={() => setShow((value) => !value)}>
        {show ? "Hide discussion" : "Reveal discussion (spoilers)"} · {reviews.length}
      </button>
      {show &&
        reviews.map((review, index) => (
          <blockquote key={index}>
            <b>
              {review.name} · {review.score}/5
            </b>
            <p>{review.text || "Rated the film."}</p>
          </blockquote>
        ))}
      {!!room.state.queue.length && (
        <button
          className="feature-button"
          disabled={!room.canControl}
          onClick={() => room.api.playNext()}
        >
          Play the next film →
        </button>
      )}
    </section>
  );
}

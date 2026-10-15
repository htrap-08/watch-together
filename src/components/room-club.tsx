import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { clubAction, savedClubs, type Club, type ClubScreening } from "@/lib/clubs";
export function RoomClub({
  club,
  screening,
  ended,
  onUpdate,
}: {
  club: Club;
  screening: ClubScreening | undefined;
  ended: boolean;
  onUpdate: (club: Club) => void;
}) {
  const [error, setError] = useState("");
  const owner = !!savedClubs().find((item) => item.id === club.id)?.ownerSecret;
  useEffect(() => {
    if (!ended || !owner || !screening || screening.completed) return;
    let cancelled = false;
    void clubAction(club.id, { type: "complete", screeningId: screening.id })
      .then((result) => {
        if (!cancelled) onUpdate(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [ended, owner, club.id, screening, onUpdate]);
  return (
    <div className="room-club-banner">
      <Link to="/club/$id" params={{ id: club.id }}>
        {club.name} ↗
      </Link>
      <span>{screening?.film.title ?? "Club screening"}</span>
      {screening?.film.source === "stream" && (
        <a href={screening.film.url} target="_blank" rel="noopener noreferrer">
          Open title ↗
        </a>
      )}
      {error && <p role="alert">{error}</p>}
      {ended && screening && !screening.completed && (
        <button
          className="feature-button"
          disabled={!owner}
          onClick={() =>
            void clubAction(club.id, { type: "complete", screeningId: screening.id })
              .then(onUpdate)
              .catch((e) => setError(e.message))
          }
        >
          {owner ? "Save to club history" : "Club host can save this screening to history"}
        </button>
      )}
    </div>
  );
}

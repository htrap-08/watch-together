import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Calendar, Check, Copy, Plus } from "lucide-react";
import { CATALOG } from "@/lib/catalog";
import {
  calendarFile,
  clubAction,
  clubActor,
  rememberClub,
  savedClubs,
  screeningLink,
  useClub,
  type ClubScreening,
} from "@/lib/clubs";
import { loadMe, saveMe } from "@/lib/identity";
export const Route = createFileRoute("/club/$id")({
  head: () => ({ meta: [{ title: "Film club — Watch Together" }] }),
  component: ClubPage,
});
function ClubPage() {
  const { id } = Route.useParams();
  const { club, error, setClub } = useClub(id);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<"direct" | "stream">("stream");
  const [filmId, setFilmId] = useState("");
  const [when, setWhen] = useState("");
  const [hostKey, setHostKey] = useState("");
  const [rating, setRating] = useState(4);
  const [review, setReview] = useState("");
  const [revealed, setRevealed] = useState<string[]>([]);
  useEffect(() => {
    setName(loadMe()?.name ?? "");
    setOwner(!!savedClubs().find((c) => c.id === id)?.ownerSecret);
  }, [id]);
  async function act(op: Record<string, unknown>) {
    setMessage("");
    setBusy(true);
    try {
      if (name.trim()) saveMe(name);
      const updated = await clubAction(id, { ...op, name });
      setClub(updated);
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save changes.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(label);
    } catch {
      setMessage("Clipboard unavailable. Select and copy the link from your address bar.");
    }
  }
  if (!club)
    return (
      <main className="club-site club-directory">
        <header className="club-nav">
          <Link to="/clubs">← Your clubs</Link>
        </header>
        <h1>{error || "Opening the club…"}</h1>
        {error && <p>Check the invite link or reload to retry.</p>}
      </main>
    );
  const upcoming = club.screenings.filter((s) => !s.completed).sort((a, b) => a.at - b.at);
  const history = club.screenings
    .filter((s) => s.completed)
    .sort((a, b) => (b.completedAt ?? b.at) - (a.completedAt ?? a.at));
  function screeningCard(s: ClubScreening) {
    const mine = s.rsvps[clubActor()];
    return (
      <article className="screening-card" key={s.id}>
        <time>
          {new Date(s.at).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })}
        </time>
        <h3>{s.film.title}</h3>
        <p>
          {s.film.source === "stream"
            ? "Streaming service · extension required"
            : "Direct video / open film"}
        </p>
        <div className="screening-actions">
          <a className="feature-button feature-primary" href={screeningLink(club!, s)}>
            Enter screening <ArrowRight size={14} />
          </a>
          <button className="feature-button" onClick={() => calendarFile(club!, s)}>
            <Calendar size={14} /> Add to calendar
          </button>
        </div>
        <div className="rsvp-row">
          <span>Your RSVP</span>
          {(["yes", "maybe", "no"] as const).map((answer) => (
            <button
              key={answer}
              disabled={busy || !name.trim()}
              aria-pressed={mine?.answer === answer}
              onClick={() => void act({ type: "rsvp", screeningId: s.id, answer })}
            >
              {answer === "yes" ? "Going" : answer === "maybe" ? "Maybe" : "Not this time"}
            </button>
          ))}
        </div>
        <p className="feature-muted">
          {Object.values(s.rsvps)
            .filter((r) => r.answer === "yes")
            .map((r) => r.name)
            .join(", ") || "No RSVPs yet."}
        </p>
        {owner && (
          <div className="host-screening-actions">
            <button
              disabled={busy}
              onClick={() => void act({ type: "complete", screeningId: s.id })}
            >
              Finish screening & open discussion
            </button>
            <button disabled={busy} onClick={() => void act({ type: "cancel", screeningId: s.id })}>
              Cancel screening
            </button>
          </div>
        )}
      </article>
    );
  }
  return (
    <main className="club-site club-directory">
      <header className="club-nav">
        <Link to="/" className="club-wordmark">
          watch <em>together</em>
        </Link>
        <Link to="/clubs">Your clubs</Link>
      </header>
      <section className="club-directory-intro">
        <p>Your standing screening room</p>
        <div className="club-title-row">
          <h1>{club.name}</h1>
          <button
            className="feature-button"
            onClick={() => void copy(location.origin + "/club/" + id, "Club invite copied.")}
          >
            <Copy size={14} /> Invite friends
          </button>
        </div>
        <p>
          Anyone with the invite can visit, add films, RSVP and join screenings. Names are not
          verified accounts.
        </p>
      </section>
      <label className="club-nickname">
        Your nickname
        <input
          value={name}
          placeholder="Your name"
          maxLength={24}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {message && (
        <p className="feature-notice" role="status">
          {message}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="club-content-grid">
        <section>
          <h2>Next on the calendar</h2>
          {!upcoming.length && (
            <p className="feature-muted">
              Nothing scheduled yet.{" "}
              {owner
                ? "Pick a film from the shelf and set a time."
                : "Your host can set the next screening."}
            </p>
          )}
          {upcoming.map(screeningCard)}
          {owner && (
            <form
              className="club-schedule-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await act({ type: "schedule", filmId, at: new Date(when).getTime() })) {
                  setWhen("");
                  setFilmId("");
                }
              }}
            >
              <h3>Schedule a screening</h3>
              <label htmlFor="schedule-film">Film</label>
              <select
                id="schedule-film"
                required
                value={filmId}
                onChange={(event) => setFilmId(event.target.value)}
              >
                <option value="">Choose from your shelf</option>
                {club.watchlist.map((film) => (
                  <option key={film.id} value={film.id}>
                    {film.title}
                  </option>
                ))}
              </select>
              <label htmlFor="screening-time">Date & time (your local timezone)</label>
              <input
                id="screening-time"
                type="datetime-local"
                required
                value={when}
                onChange={(event) => setWhen(event.target.value)}
              />
              <button
                type="button"
                className="feature-button schedule-preset"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + 1);
                  date.setHours(20, 0, 0, 0);
                  setWhen(
                    new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                      .toISOString()
                      .slice(0, 16),
                  );
                }}
              >
                Tomorrow at 8pm
              </button>
              <button
                className="feature-button feature-primary"
                disabled={busy || !club.watchlist.length || !filmId || !when}
              >
                Schedule screening <Calendar size={14} />
              </button>
            </form>
          )}
        </section>
        <section>
          <h2>The shared shelf</h2>
          {!club.watchlist.length && (
            <p className="feature-muted">
              What should we watch? Add a title or start with an open film.
            </p>
          )}
          {club.watchlist.map((film) => (
            <article className="club-shelf-item" key={film.id}>
              <div>
                <h3>{film.title}</h3>
                <p>
                  {film.source === "stream" ? "Streaming service" : "Direct video"} · suggested by{" "}
                  {film.addedBy}
                </p>
                {film.url.startsWith("https://") && (
                  <a href={film.url} target="_blank" rel="noopener noreferrer">
                    View title ↗
                  </a>
                )}
              </div>
              {owner && (
                <button
                  aria-label={"Remove " + film.title}
                  disabled={busy}
                  onClick={() => void act({ type: "film_remove", filmId: film.id })}
                >
                  Remove
                </button>
              )}
            </article>
          ))}
          <form
            className="club-add-film"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await act({ type: "film_add", title, url, source })) {
                setTitle("");
                setUrl("");
              }
            }}
          >
            <h3>Add a film</h3>
            <label htmlFor="film-title">Title</label>
            <input
              id="film-title"
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What’s on your list?"
            />
            <label htmlFor="film-url">Video or streaming title link</label>
            <input
              id="film-url"
              type="url"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
            />
            <label htmlFor="film-source">Where to watch</label>
            <select
              id="film-source"
              value={source}
              onChange={(event) => setSource(event.target.value as "direct" | "stream")}
            >
              <option value="stream">Streaming service</option>
              <option value="direct">Direct video link</option>
            </select>
            <button className="feature-button" disabled={busy || !name.trim()}>
              Add to shelf <Plus size={14} />
            </button>
          </form>
          <details className="club-open-films">
            <summary>Or choose an open film</summary>
            {CATALOG.map((film) => (
              <button
                className="feature-button"
                key={film.id}
                disabled={busy || !name.trim()}
                onClick={() =>
                  void act({ type: "film_add", title: film.title, url: film.src, source: "direct" })
                }
              >
                {film.title} <Plus size={13} />
              </button>
            ))}
          </details>
        </section>
      </div>
      <section className="club-history">
        <h2>After the credits</h2>
        {!history.length && (
          <p className="feature-muted">
            Completed screenings, ratings and discussions will live here.
          </p>
        )}
        {history.map((s) => (
          <article className="club-history-item" key={s.id}>
            <div>
              <h3>{s.film.title}</h3>
              <p>
                {new Date(s.completedAt ?? s.at).toLocaleDateString()} ·{" "}
                {Object.keys(s.reviews).length} reviews
              </p>
            </div>
            <button
              className="feature-button"
              onClick={() =>
                setRevealed((values) =>
                  values.includes(s.id)
                    ? values.filter((value) => value !== s.id)
                    : [...values, s.id],
                )
              }
            >
              {revealed.includes(s.id) ? "Hide discussion" : "Reveal discussion (spoilers)"}
            </button>
            {revealed.includes(s.id) && (
              <div className="club-discussion">
                <p className="discussion-prompt">
                  What stayed with you? Was there a scene you’d watch again?
                </p>
                {Object.entries(s.reviews).map(([actor, r]) => (
                  <blockquote key={actor}>
                    <b>
                      {r.name} · {r.score}/5
                    </b>
                    <p>{r.text || "Rated the film."}</p>
                  </blockquote>
                ))}
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (
                      await act({ type: "review", screeningId: s.id, score: rating, text: review })
                    )
                      setReview("");
                  }}
                >
                  <label>
                    Rating
                    <select
                      value={rating}
                      onChange={(event) => setRating(Number(event.target.value))}
                    >
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
                      maxLength={500}
                      value={review}
                      onChange={(event) => setReview(event.target.value)}
                      placeholder="A favourite scene, a thought, a question…"
                    />
                  </label>
                  <button
                    className="feature-button feature-primary"
                    disabled={busy || !name.trim()}
                  >
                    Save your review <Check size={14} />
                  </button>
                </form>
              </div>
            )}
          </article>
        ))}
      </section>
      <details className="club-host-settings">
        <summary>Host key & recovery</summary>
        {owner ? (
          <>
            <p className="feature-muted">
              Your host key is saved only in this browser. Save a private copy to manage the club on
              another device. Do not share it with the invite.
            </p>
            <button
              className="feature-button"
              onClick={() =>
                void copy(
                  savedClubs().find((c) => c.id === id)?.ownerSecret ?? "",
                  "Host key copied. Store it privately.",
                )
              }
            >
              <Copy size={14} /> Copy host key
            </button>
          </>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                const r = await fetch("/api/clubs/" + id, {
                  method: "POST",
                  headers: { "content-type": "application/json", "x-club-owner": hostKey },
                  body: JSON.stringify({ type: "rename", title: club.name }),
                });
                const result = await r.json();
                if (!r.ok) throw new Error(result.error);
                rememberClub(club, hostKey);
                setHostKey("");
                setOwner(true);
                setMessage("Host controls restored on this browser.");
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Invalid key.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Restore host access
              <input
                type="password"
                required
                value={hostKey}
                onChange={(event) => setHostKey(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button className="feature-button" disabled={busy}>
              Restore
            </button>
          </form>
        )}
      </details>
      <footer className="club-footer">
        <p>Stay for the credits.</p>
        <Link to="/">Back to the lobby →</Link>
      </footer>
    </main>
  );
}

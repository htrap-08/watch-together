import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Play } from "lucide-react";
import { CATALOG } from "@/lib/catalog";
import { loadMe, newRoomCode, saveMe } from "@/lib/identity";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Watch Together — Your own little cinema" },
      {
        name: "description",
        content:
          "A screening room for you and your friends. Choose a film, invite your people, and watch in sync.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const nav = useNavigate();
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [source, setSource] = useState<"direct" | "stream">("direct");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [film, setFilm] = useState(CATALOG[1]!);
  useEffect(() => setName(loadMe()?.name ?? ""), []);
  function go() {
    if (!name.trim() || (mode === "join" && code.length !== 6)) return;
    saveMe(name);
    if (mode === "create" && source === "direct")
      sessionStorage.setItem("watchparty:first-video", film.id);
    else sessionStorage.removeItem("watchparty:first-video");
    void nav({
      to: "/room/$code",
      params: { code: mode === "create" ? newRoomCode() : code },
      search: source === "stream" ? { watch: "stream" } : {},
    });
  }
  return (
    <main className="club-site">
      <header className="club-nav">
        <Link to="/" className="club-wordmark">
          watch <em>together</em>
          <span aria-hidden="true">✳</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/clubs">Film clubs</Link>
          <Link to="/streaming">Extension & help</Link>
        </nav>
      </header>
      <section className="club-lobby">
        <div className="club-feature">
          <div className="club-intro">
            <p>A little cinema. Your kind of company.</p>
            <h1>
              Make a night <em>of it.</em>
            </h1>
          </div>
          <figure className="club-still">
            <img src={film.thumb} alt={`Still from ${film.title}`} />
            <figcaption>
              <span>On your screen</span>
              <h2>{film.title}</h2>
              <p>
                {film.year} <span>·</span> {film.genres[0]} <span>·</span> {film.minutes} min
              </p>
            </figcaption>
            <button
              className="club-still-play"
              aria-label={`Choose ${film.title} for your room`}
              onClick={() => {
                setMode("create");
                setSource("direct");
                nameInput.current?.focus();
              }}
            >
              <Play size={20} fill="currentColor" />
            </button>
          </figure>
          <p className="club-feature-caption">Pick something below, or bring your own film.</p>
        </div>
        <aside className="club-boxoffice" id="start">
          <div className="club-form-tabs" role="tablist" aria-label="Room action">
            <button role="tab" aria-selected={mode === "create"} onClick={() => setMode("create")}>
              New screening
            </button>
            <button role="tab" aria-selected={mode === "join"} onClick={() => setMode("join")}>
              Join friends
            </button>
          </div>
          <h2>
            {mode === "create" ? (
              <>
                Save your friends <br />a seat.
              </>
            ) : (
              <>
                Your people <br />
                are waiting.
              </>
            )}
          </h2>
          <p className="club-form-intro">
            {mode === "create"
              ? "Make a room, send the link. You bring the company; we’ll keep the screens in time."
              : "Have a room code? Come on in."}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              go();
            }}
          >
            <label htmlFor="display-name">What should we call you?</label>
            <input
              ref={nameInput}
              id="display-name"
              placeholder="Your nickname"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={24}
              autoComplete="nickname"
            />
            {mode === "join" && (
              <>
                <label htmlFor="room-code">Room code</label>
                <input
                  id="room-code"
                  className="club-code-input"
                  placeholder="ABC123"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())
                  }
                  minLength={6}
                  maxLength={6}
                  required
                />
              </>
            )}
            <label htmlFor="watch-source">Watching from</label>
            <select
              id="watch-source"
              value={source}
              onChange={(event) => setSource(event.target.value as "direct" | "stream")}
            >
              <option value="direct">Our film shelf / a video link</option>
              <option value="stream">A streaming service</option>
            </select>
            <p className="club-source-note">
              {source === "stream" ? (
                <>
                  You’ll need our <Link to="/streaming">Chrome / Edge extension</Link> and access to
                  the film.
                </>
              ) : (
                "No account, download or extension needed."
              )}
            </p>
            <button type="submit" className="club-submit">
              {mode === "create" ? "Open the room" : "Take your seat"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="club-ticket-end">
            <span>Everyone gets their own screen.</span>
            <span aria-hidden="true">✳</span>
          </div>
        </aside>
      </section>
      <section className="club-shelf" id="films">
        <div className="club-shelf-heading">
          <h2>On the house.</h2>
          <p>A few open films & trailers to get you started.</p>
        </div>
        <div className="club-film-list">
          {CATALOG.map((item) => (
            <button
              key={item.id}
              className={`club-film ${item.id === film.id && source === "direct" ? "is-picked" : ""}`}
              aria-pressed={item.id === film.id && source === "direct"}
              onClick={() => {
                setFilm(item);
                setSource("direct");
                setMode("create");
              }}
            >
              <img src={item.thumb} alt="" loading="lazy" />
              <span className="club-film-text">
                <strong>{item.title}</strong>
                <small>
                  {item.category === "Trailers" ? "Trailer" : "Short film"} · {item.year}
                </small>
              </span>
              <span className="club-film-duration">{item.minutes} min</span>
              <span className="club-film-pick">
                {item.id === film.id && source === "direct" ? (
                  <Check size={16} />
                ) : (
                  <ArrowRight size={16} />
                )}
              </span>
            </button>
          ))}
        </div>
      </section>
      <footer className="club-footer">
        <p>
          Stay for the credits. <span>Watch Together, by Parth.</span>
        </p>
        <Link to="/docs">
          How playback sync works <ArrowRight size={13} />
        </Link>
      </footer>
    </main>
  );
}

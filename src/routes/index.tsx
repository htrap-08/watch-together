import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Clapperboard,
  Link2,
  MessageCircle,
  Play,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import { CATALOG } from "@/lib/catalog";
import { loadMe, newRoomCode, saveMe } from "@/lib/identity";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Watch Together — Movie night, wherever you are" },
      {
        name: "description",
        content:
          "Start a watch room, invite your friends, and enjoy synchronized video, live chat, and a shared queue.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [featured, setFeatured] = useState(CATALOG[1]!);
  useEffect(() => setName(loadMe()?.name ?? ""), []);
  const go = () => {
    if (!name.trim() || (mode === "join" && code.length !== 6)) return;
    saveMe(name);
    if (mode === "create") sessionStorage.setItem("watchparty:first-video", featured.id);
    void nav({
      to: "/room/$code",
      params: { code: mode === "create" ? newRoomCode() : code.toUpperCase() },
    });
  };
  return (
    <main className="landing">
      <header className="site-nav page-width">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Play size={18} fill="currentColor" />
          </span>
          watch<span className="brand-light">together</span>
          <span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#discover">Discover</a>
          <a className="nav-cta" href="#start">
            Let’s watch <ArrowRight size={15} />
          </a>
        </nav>
      </header>
      <section className="hero page-width">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> FAR APART. SAME MOVIE NIGHT.
          </p>
          <h1>
            Your people.
            <br />
            Your movie.
            <br />
            <em>One play button.</em>
          </h1>
          <p className="hero-description">
            Make room for a little together time. Watch in sync, share every reaction, and keep the
            conversation going.
          </p>
          <div className="party-form" id="start">
            <div className="form-tabs" role="tablist" aria-label="Party action">
              {(["create", "join"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  className={mode === m ? "active" : ""}
                  onClick={() => setMode(m)}
                >
                  {m === "create" ? "Start a party" : "Join a party"}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go();
              }}
            >
              <label htmlFor="display-name">What should we call you?</label>
              <div className="form-row">
                <input
                  id="display-name"
                  placeholder="Your nickname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  required
                  autoComplete="nickname"
                />
                {mode === "create" && (
                  <button className="action-primary" type="submit">
                    Create room <ArrowRight size={17} />
                  </button>
                )}
              </div>
              {mode === "join" && (
                <div className="form-row join-row">
                  <input
                    aria-label="Room code"
                    placeholder="6-character room code"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())
                    }
                    minLength={6}
                    maxLength={6}
                    required
                  />
                  <button className="action-primary" type="submit">
                    Join room <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </form>
          </div>
          <p className="small-note">
            <Check size={14} /> No account. No extension. Just your friends.
          </p>
        </div>
        <div className="hero-visual">
          <div className="orbit-label">
            <Sparkles size={16} /> THE BEST SEAT IS NEXT TO YOUR FRIENDS
          </div>
          <div className="preview-window" aria-label="Illustration of a watch room">
            <div className="preview-top">
              <span>
                <i />
                <i />
                <i />
              </span>
              <span>
                <Radio size={12} /> Movie night · preview
              </span>
              <span>•••</span>
            </div>
            <div className="preview-picture">
              <img src={featured.thumb} alt={featured.title} />
              <div className="preview-shade" />
              <span className="preview-live">
                <span className="live-dot" /> IN SYNC
              </span>
              <div className="preview-title">
                <span>TONIGHT’S PICK</span>
                <h2>{featured.title}</h2>
                <p>
                  {featured.genres.slice(0, 2).join(" · ")} / {featured.minutes} min
                </p>
              </div>
              <span className="preview-play">
                <Play size={24} fill="currentColor" />
              </span>
            </div>
            <div className="preview-bottom">
              <span>
                <Play size={12} fill="currentColor" /> 00:12
              </span>
              <div className="preview-progress">
                <i />
              </div>
              <span>{featured.minutes}:00</span>
            </div>
          </div>
          <div className="chat-sticker">
            <span className="demo-avatar">J</span>
            <div>
              <b>
                Jamie <span>just now · demo</span>
              </b>
              <p>okay this is already my favorite scene 🍿</p>
            </div>
          </div>
          <div className="reaction-sticker">
            😂 <span>❤️</span> 🍿
          </div>
          <div className="visual-caption">
            <span className="avatar-stack">
              <i>A</i>
              <i>J</i>
              <i>M</i>
            </span>
            <span>Different couches. Same good company.</span>
          </div>
        </div>
      </section>
      <section className="promise-strip">
        <div className="page-width">
          <span>
            <Radio size={18} /> Playback that stays together
          </span>
          <span>
            <MessageCircle size={18} /> Chat beside the action
          </span>
          <span>
            <Users size={18} /> Everyone gets a say
          </span>
          <span>
            <Link2 size={18} /> One link brings you in
          </span>
        </div>
      </section>
      <section className="discovery page-width" id="discover">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LESS SCROLLING, MORE WATCHING</p>
            <h2>Something for tonight.</h2>
          </div>
          <p>
            A few short films to get the party started.
            <br />
            Pick your opening act.
          </p>
        </div>
        <div className="film-grid">
          {CATALOG.slice(0, 4).map((film, i) => (
            <button
              key={film.id}
              className={`film-card ${featured.id === film.id ? "selected" : ""}`}
              onClick={() => {
                setFeatured(film);
                document
                  .getElementById("start")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
                document.getElementById("display-name")?.focus({ preventScroll: true });
              }}
            >
              <div className="film-image">
                <img src={film.thumb} alt="" loading="lazy" />
                <span className="film-tag">
                  {
                    ["A little adventure", "A little magic", "A little action", "A quick preview"][
                      i
                    ]
                  }
                </span>
                <span className="film-launch">
                  <Play size={17} fill="currentColor" />
                </span>
              </div>
              <div className="film-info">
                <h3>{film.title}</h3>
                <span>
                  {film.minutes} min <i>·</i> {film.genres[0]}
                </span>
              </div>
            </button>
          ))}
        </div>
        <p className="catalog-note">
          Sample films and videos. You can also share a direct video link inside your room.
        </p>
      </section>
      <section className="how-section page-width" id="how-it-works">
        <div>
          <p className="eyebrow">THE GROUP CHAT HAS PLANS NOW</p>
          <h2>
            Three steps.
            <br />
            <em>A whole night together.</em>
          </h2>
          <Link to="/docs" className="text-link">
            The details behind the sync <ArrowRight size={16} />
          </Link>
        </div>
        <ol>
          {[
            {
              title: "Make a room",
              text: "Choose a nickname and your first film. Your space is ready in seconds.",
            },
            {
              title: "Bring your people",
              text: "Copy the invite link. Friends join from their browser with the room code.",
            },
            {
              title: "Press play, together",
              text: "Playback stays in sync while you chat, react, and vote on what’s next.",
            },
          ].map((step, i) => (
            <li key={step.title}>
              <span>0{i + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="closing page-width">
        <Clapperboard size={30} />
        <h2>
          “One more?” hits different
          <br />
          when you’re together.
        </h2>
        <a href="#start" className="action-primary">
          Make tonight a movie night <ArrowRight size={18} />
        </a>
      </section>
      <footer className="site-footer page-width">
        <span>
          watchtogether. <small>Made for nights worth sharing.</small>
        </span>
        <Link to="/docs">
          How sync works <ArrowRight size={14} />
        </Link>
      </footer>
    </main>
  );
}

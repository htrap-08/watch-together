import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
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
  const [source, setSource] = useState<"direct" | "stream" | "share">("share");
  const [mode, setMode] = useState<"create" | "join">("create");
  useEffect(() => setName(loadMe()?.name ?? ""), []);
  function go() {
    if (!name.trim() || (mode === "join" && code.length !== 6)) return;
    saveMe(name);
    sessionStorage.removeItem("watchparty:first-video");
    void nav({
      to: "/room/$code",
      params: { code: mode === "create" ? newRoomCode() : code },
      search: source === "direct" ? {} : { watch: source },
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
          <div className="watch-paths">
            <section className="watch-path" aria-labelledby="share-heading">
              <p className="path-number">01 / One screen, shared</p>
              <h2 id="share-heading">Share a browser tab.</h2>
              <p>One person presses play. Everyone else watches the same picture, right here.</p>
              <dl>
                <div>
                  <dt>YouTube</dt>
                  <dd>Ordinary uploads & live videos; skip rentals and purchased films.</dd>
                </div>
                <div>
                  <dt>Twitch</dt>
                  <dd>Unprotected live streams and recordings.</dd>
                </div>
                <div>
                  <dt>Vimeo & your videos</dt>
                  <dd>Videos without DRM. Some Vimeo creators enable protection.</dd>
                </div>
              </dl>
              <button
                className="path-choice"
                onClick={() => {
                  setSource("share");
                  setMode("create");
                  nameInput.current?.focus();
                }}
              >
                Start with screen sharing <ArrowRight size={16} />
              </button>
              <small>
                Desktop Chrome / Edge recommended. Choose a tab and include tab audio. Capture
                depends on the video and browser; it does not grant permission to rebroadcast.
              </small>
            </section>
            <section className="watch-path" aria-labelledby="extension-heading">
              <p className="path-number">02 / Separate screens, same moment</p>
              <h2 id="extension-heading">Watch on the service.</h2>
              <p>
                For protected films, each person opens the same title. Our extension keeps playback
                in time.
              </p>
              <p className="service-names">
                Netflix · Prime Video · Disney+ · Hulu · Max · Apple TV+ · Paramount+ · Crunchyroll
              </p>
              <p className="path-detail">
                Everyone needs access to the title and the Chrome / Edge extension. Service
                integrations are experimental; players, regions and ads can affect sync.
              </p>
              <a className="path-choice" href="/watch-together-extension.zip" download>
                Download the extension <ArrowRight size={16} />
              </a>
              <Link className="path-help" to="/streaming">
                Installation & compatibility notes
              </Link>
              <button
                className="path-choice"
                onClick={() => {
                  setSource("stream");
                  setMode("create");
                  nameInput.current?.focus();
                }}
              >
                Create an extension room <ArrowRight size={16} />
              </button>
            </section>
          </div>
          <p className="compatibility-footnote">
            A black picture usually means protected content. Use separate playback instead.{" "}
            <a
              href="https://help.vimeo.com/hc/en-us/articles/31622243101969-Digital-Rights-Management-DRM-for-my-videos"
              target="_blank"
              rel="noreferrer"
            >
              DRM & capture
            </a>{" "}
            ·{" "}
            <a
              href="https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia"
              target="_blank"
              rel="noreferrer"
            >
              Browser sharing support
            </a>
          </p>
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
              onChange={(event) => setSource(event.target.value as "direct" | "stream" | "share")}
            >
              <option value="share">Screen share</option>
              <option value="direct">Direct video link</option>
              <option value="stream">A streaming service</option>
            </select>
            <p className="club-source-note">
              {source === "stream" ? (
                <>
                  You’ll need our <Link to="/streaming">Chrome / Edge extension</Link> and access to
                  the film.
                </>
              ) : source === "share" ? (
                "The host shares a tab. Friends watch here without an extension."
              ) : (
                "Paste your own video link in the room. No extension needed."
              )}
            </p>
            <button type="submit" className="club-submit">
              {mode === "create" ? "Open the room" : "Take your seat"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="club-ticket-end">
            <span>Bring something worth watching.</span>
            <span aria-hidden="true">✳</span>
          </div>
        </aside>
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

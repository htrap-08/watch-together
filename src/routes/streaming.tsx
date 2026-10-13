import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Download, MonitorPlay, Play } from "lucide-react";

export const Route = createFileRoute("/streaming")({
  head: () => ({
    meta: [
      { title: "Streaming companion — Watch Together" },
      {
        name: "description",
        content:
          "Install the Watch Together extension to synchronize your own streaming player with friends.",
      },
    ],
  }),
  component: Streaming,
});
function Streaming() {
  return (
    <main className="streaming-guide page-width">
      <header className="site-nav">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Play size={14} fill="currentColor" />
          </span>
          watchtogether.
        </Link>
        <Link to="/" className="text-link">
          <ArrowLeft size={14} /> Back home
        </Link>
      </header>
      <section className="guide-hero">
        <p className="eyebrow">WATCH TOGETHER / STREAMING COMPANION</p>
        <h1>
          Your service. Your account.
          <br />A shared play button.
        </h1>
        <p>
          Keep Netflix and other streaming services in their own tabs. Our companion extension
          coordinates playback with your room, without capturing or forwarding the protected video.
        </p>
        <a className="action-primary" href="/watch-together-extension.zip" download>
          <Download size={16} /> Download extension · v0.1 preview
        </a>
        <small>
          Desktop Chrome 116+ and Chromium-based Edge. Not published to a browser store yet.
        </small>
      </section>
      <section className="guide-section">
        <h2>Install it once.</h2>
        <ol>
          <li>
            <b>Unzip the download.</b>
            <p>Keep the extracted folder somewhere permanent.</p>
          </li>
          <li>
            <b>Load it in your browser.</b>
            <p>
              Open <code>chrome://extensions</code> (or <code>edge://extensions</code>), enable
              Developer mode, choose <strong>Load unpacked</strong>, and select the folder
              containing <code>manifest.json</code>.
            </p>
          </li>
          <li>
            <b>Pin Watch Together.</b>
            <p>
              Use your browser’s extensions menu so the companion is easy to find on a video tab.
            </p>
          </li>
        </ol>
      </section>
      <section className="guide-section">
        <h2>Connect a movie night.</h2>
        <ol>
          <li>
            <b>Create a room and choose “Streaming service”.</b>
            <p>Click “Copy extension setup”. Send your friends the room invite link.</p>
          </li>
          <li>
            <b>Open the same title on your service.</b>
            <p>
              Everyone signs in separately, needs access to the title in their region, and presses
              play once to allow playback.
            </p>
          </li>
          <li>
            <b>Click the extension on that video tab.</b>
            <p>
              Paste the setup, choose your nickname, and connect. The extension requests access to
              that site and your realtime server.
            </p>
          </li>
          <li>
            <b>The first streaming viewer hosts.</b>
            <p>
              Play, pause, or seek using the host’s normal player controls. Guests follow
              automatically. Chat in the extension or this website. The host can pass control from
              the extension popup.
            </p>
          </li>
        </ol>
      </section>
      <section className="guide-section">
        <div className="guide-section-title">
          <MonitorPlay size={22} />
          <h2>Service adapters.</h2>
        </div>
        <p>
          The extension is built to work with HTML5 video players, including open shadow roots and
          frames your browser has permitted. Adapters are implementations, not certification from
          the streaming services.
        </p>
        <div className="compatibility-table">
          <div>
            <b>Netflix / YouTube</b>
            <span>
              Player API adapters with an HTML5 fallback. Needs signed-in service testing.
            </span>
          </div>
          <div>
            <b>Prime Video / Disney+ / Hulu / Max</b>
            <span>
              HTML5 player selectors and ad detection hooks. Needs signed-in service testing.
            </span>
          </div>
          <div>
            <b>Apple TV+ / Paramount+ / Crunchyroll / Vimeo</b>
            <span>HTML5 player discovery. Needs service testing.</span>
          </div>
          <div>
            <b>Other video websites</b>
            <span>
              Generic HTML5 adapter. Validated using local video fixtures; site-specific behavior
              can vary.
            </span>
          </div>
        </div>
        <p>
          Advertisements temporarily suspend synchronization when detected. Ad detection is
          best-effort, and viewers with different ad schedules may need to pause and resume
          together. Live or non-seekable streams cannot guarantee position synchronization.
        </p>
        <p>
          Players inside cross-origin iframes or closed shadow roots may be inaccessible. Mobile
          apps, smart TVs, Safari, and Firefox are not supported by this build. Everyone must be
          watching the same service and title.
        </p>
      </section>
      <section className="guide-section">
        <h2>Invite your friends.</h2>
        <p>
          Share your room link. Each friend opens it, copies their extension setup, and connects
          from their own streaming tab. The setup connects everyone to the same room automatically.
        </p>
        <p>
          Use the public site link when watching with friends on other networks. A localhost link
          works only on the computer running the app.
        </p>
      </section>
      <section className="guide-section">
        <h2>When the player doesn’t connect.</h2>
        <p>
          Open an actual episode or movie, press play once, and click “Find player again” in the
          extension. If you navigate to another service or the player lives on a different permitted
          domain, reconnect the extension on that tab. “Open the host’s video” navigates only after
          you click it.
        </p>
        <p>
          This preview doesn’t access streaming passwords, cookies, account tokens, or video bytes.
          It sends the sanitized page URL, title, nickname, playback state, and room messages to
          your room server. Room codes provide access; account authentication and production abuse
          protection remain future work.
        </p>
      </section>
      <footer className="site-footer">
        <span>
          watchtogether. <small>a project by Parth</small>
        </span>
        <Link to="/">
          Create a room <ArrowRight size={14} />
        </Link>
      </footer>
    </main>
  );
}

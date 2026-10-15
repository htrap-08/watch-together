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
          <Download size={16} /> Download extension · v0.2.1 preview
        </a>
        <small>
          Existing users: replace the extracted files, reload the extension, then refresh the room
          page. Desktop Chrome 116+ and Chromium-based Edge. Not published to a browser store yet.
        </small>
      </section>
      <section className="guide-section">
        <h2>Install it once.</h2>
        <ol>
          <li>
            <b>Unzip the download.</b>
            <p>
              The ZIP does not install itself. Extract it into a permanent folder; do not delete or
              move that folder after installation. Every friend installs their own copy.
            </p>
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
              Open the puzzle-piece extensions menu and pin Watch Together. Return to your Watch
              Together room and refresh the page so it can detect the newly installed extension.
            </p>
          </li>
        </ol>
      </section>
      <section className="guide-section">
        <h2>Connect a movie night.</h2>
        <ol>
          <li>
            <b>Create a room and choose “Streaming service”.</b>
            <p>
              Use “Invite friends” to share the room link. Every friend opens that link and clicks
              “Send room to extension” in their own browser. “Room sent” means the setup is filled
              in; it does not connect a streaming tab yet.
            </p>
          </li>
          <li>
            <b>Open the same title on your service.</b>
            <p>
              In a separate tab, sign in to your streaming service and open the actual movie or
              episode, not its description page. Every viewer needs access to the same service and
              title in their region. Press play once, then pause while everyone joins.
            </p>
          </li>
          <li>
            <b>Click the extension on that video tab.</b>
            <p>
              Keep the video tab selected, click the pinned Watch Together icon, check the room code
              and nickname, then click “Connect this video tab”. Allow access to the selected site
              when Chrome or Edge asks. If you are connected to a previous room, click “Disconnect
              this tab” first. Wait for the player to be found, then click “I’m ready”.
            </p>
          </li>
          <li>
            <b>The first streaming viewer hosts.</b>
            <p>
              Look for HOST in the extension. Once everyone has marked ready, that person presses
              Play on their streaming site. Their play, pause and seek controls sync the viewers.
              Leave the video tab and this room open: the service plays the film, and this website
              keeps the chat. “Connected” on the website only confirms the room server; your name
              must also appear in the room’s streaming viewers list.
            </p>
          </li>
        </ol>
      </section>
      <section className="guide-section">
        <h2>Which way should we watch?</h2>
        <p>
          Ordinary YouTube uploads, unprotected Twitch streams and non-DRM Vimeo videos are
          candidates for the homepage’s Screen share mode. One host shares a browser tab; friends
          watch here without the extension. Rentals, purchased films and protected Vimeo videos are
          excluded from that recommendation.
        </p>
        <p>
          Use separate playback for Netflix, Prime Video and other subscription films. Each viewer
          needs their own access to the same title. Screen capture can be blocked by DRM, and our
          extension never removes that protection. Commercial service adapters are experimental,
          rather than verified against every current player.
        </p>
        <p>
          Technical capture depends on the title, browser and operating system. Choose a tab and
          include tab audio in desktop Chrome or Edge. Direct peer connections can fail on
          restrictive networks; there is no TURN media relay yet.
        </p>
        <p>
          References:{" "}
          <a href="https://help.netflix.com/en/node/27451" target="_blank" rel="noreferrer">
            Netflix protected content
          </a>
          ,{" "}
          <a
            href="https://www.primevideo.com/help?nodeId=G8X362NHQ64MH5SY"
            target="_blank"
            rel="noreferrer"
          >
            Prime Video protected content
          </a>
          ,{" "}
          <a
            href="https://help.vimeo.com/hc/en-us/articles/31622243101969-Digital-Rights-Management-DRM-for-my-videos"
            target="_blank"
            rel="noreferrer"
          >
            Vimeo recording protection
          </a>
          ,{" "}
          <a
            href="https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia"
            target="_blank"
            rel="noreferrer"
          >
            browser capture & audio support
          </a>
          .
        </p>
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
            <b>
              Prime Video / Disney+ / JioHotstar / Hulu / HBO Max{" "}
              <small className="compat-status">Experimental</small>
            </b>
            <span>
              HTML5 player selectors and ad detection hooks. Needs signed-in service testing.
            </span>
          </div>
          <div>
            <b>
              Apple TV+ / Paramount+ / Crunchyroll / Vimeo{" "}
              <small className="compat-status">Experimental</small>
            </b>
            <span>HTML5 player discovery. Needs service testing.</span>
          </div>
          <div>
            <b>
              Other video websites <small className="compat-status">HTML5 fixture-tested</small>
            </b>
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
          Share the invite link, not the extension’s server settings. Each friend installs the
          extension, opens your room, clicks “Send room to extension”, then connects from their own
          video tab. Nobody watches a broadcast of your account.
        </p>
        <p>
          Use the public site link when watching with friends on other networks. A localhost link
          works only on the computer running the app.
        </p>
      </section>
      <section className="guide-section">
        <h2>If “Send room to extension” doesn’t work.</h2>
        <p>
          Refresh this room after installing or reloading the extension. If the handoff still fails,
          click “Copy extension setup” in the room, switch to your video tab, open the extension and
          paste it into “Room setup or six-character code”. Enter your nickname and click “Connect
          this video tab”. Keep Server settings at their defaults for the public site.
        </p>
        <p>
          Updating an existing installation? Replace the files in its extracted folder, click Reload
          on its card at chrome://extensions or edge://extensions, then refresh both the room and
          the streaming video tab.
        </p>
      </section>
      <section className="guide-section">
        <h2>When the player doesn’t connect.</h2>
        <p>
          Open an actual episode or movie, press play once, and click “Find player again” in the
          extension. If you navigate to another service or the player lives on a different permitted
          domain, reconnect the extension on that tab. If “I’m ready” is disabled, wait for ads to
          finish and make sure you opened the host’s exact episode. “Open the host’s video”
          navigates only after you click it. During intermission, everyone marks ready again; the
          host clicks “Resume when everyone is ready” in the extension.
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

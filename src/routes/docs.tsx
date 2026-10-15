import { createFileRoute, Link } from "@tanstack/react-router";
export const Route = createFileRoute("/docs")({
  head: () => ({ meta: [{ title: "Sync, measurements & submission — Watch Together" }] }),
  component: Docs,
});
function Docs() {
  return (
    <main className="club-site diagnostics-page">
      <header className="club-nav">
        <Link to="/">← Watch Together</Link>
        <Link to="/diagnostics">Run playback verification</Link>
      </header>
      <h1>How the room stays together.</h1>
      <p>
        Direct videos share a playback position, host-clock timestamp and sequence number. Every
        viewer projects the current position using that anchor. The extension uses a separate,
        server-authoritative timeline for streaming-service tabs. Screen sharing sends a single
        captured stream over peer connections.
      </p>
      <h2>Timing & correction</h2>
      <p>
        Direct players check their native video state every 50 ms. Drift below 120 ms is ignored.
        Between 120 and 500 ms, playback speed changes by ±6%. At 500 ms or more, the player seeks.
        Paused players seek instead of trying to catch up through playback speed. Scheduled starts
        remain paused until the agreed start time.
      </p>
      <p>
        Clients estimate host-clock offset using the lowest-round-trip sample among the last twelve
        pings. Measurement accuracy depends on that estimate; device clocks, asymmetric networks and
        browser scheduling introduce uncertainty.
      </p>
      <h2>What has been measured?</h2>
      <p>
        The published report records ten independent room connections and ten native video elements
        in a single desktop browser, using a local Node relay and a fixed W3C fixture. It records
        thirty test controls plus a final pause. The report contains raw per-viewer latency and
        drift samples, timestamps, browser and topology.
      </p>
      <p>
        <a href="/verification/loopback.json">Download the recorded loopback measurements</a> ·{" "}
        <Link to="/diagnostics">Repeat the browser check</Link>
      </p>
      <p>
        Recorded on 15 October 2026: ten players, 279 remote control observations, p50 38.5 ms, p95
        132.5 ms and maximum settled drift 98.3 ms across 2565 samples. Both targets passed for that
        recorded loopback run.
      </p>
      <p>
        This single-computer loopback test does not certify ten physical devices on your LAN,
        protected streaming services, or ten-recipient screen-sharing bandwidth. Results are
        observations for the recorded conditions, not universal guarantees.
      </p>
      <h2>Measure your actual LAN</h2>
      <ol>
        <li>
          Run <code>npm run dev</code> on the host. Open the printed LAN address on ten viewers,
          allowing the web and realtime ports through your firewall.
        </li>
        <li>
          Join the same room in Video link mode. Use one accessible MP4 or WebM URL, wait for all
          players and mark every viewer ready.
        </li>
        <li>
          Record devices, browsers, wired/Wi-Fi connections, video resolution, network conditions
          and buffering. Warm up playback and clock synchronization.
        </li>
        <li>
          Open “Playback measurements” in each viewer. Exercise at least thirty play/pause/seek
          controls, then let playback settle for at least 500 ms after each control. Scheduled
          countdowns are excluded from latency samples.
        </li>
        <li>
          Export every viewer’s measurements. Combine remote-viewer samples to calculate p95
          command-to-native-player-state latency; check each viewer’s absolute settled media drift.
          Targets are ≤250 ms p95 and ≤500 ms drift.
        </li>
        <li>
          Repeat late joins, network interruptions, host departure, concurrent controls and
          simultaneous poll creation. Record failures alongside successful runs.
        </li>
      </ol>
      <h2>Recovery & concurrency</h2>
      <ul>
        <li>
          Reconnecting viewers temporarily disable controls and request a fresh full snapshot. An
          authoritative snapshot from the same host can restore missed queue, chat and poll updates.
        </li>
        <li>
          Playback controls use sequence numbers with a deterministic user-ID tie-break. Poll
          creation uses a monotonic version and poll-ID tie-break, so simultaneous creation
          converges. Replays of the same poll cannot reopen it.
        </li>
        <li>
          The direct-room host broadcasts an anchor every three seconds. After a host disappears
          from presence for three ticks, the longest-present viewer takes over. Detection can take
          longer after an unclean network loss.
        </li>
        <li>
          The streaming relay serializes updates under a Redis lease on Vercel. Late joiners receive
          a snapshot; disconnected companions restore membership. Readiness and ad checks protect
          startup and intermission.
        </li>
        <li>
          Unloaded or blocked players show a recovery action. Captured screen-sharing tracks stop on
          leaving the mode; restrictive networks can still prevent peer media without TURN.
        </li>
      </ul>
      <h2>Discovery sources</h2>
      <p>
        Homepage recommendations mix international and Indian films and series, grouped under Movies
        and Series. The selection includes recent chart picks and international favourites, with
        Indian streaming availability checked on 15 October 2026. This is not a live popularity
        ranking. Search also queries Wikipedia’s worldwide movie catalogue and TVmaze’s series
        catalogue; external matches link to an India availability check rather than claiming a local
        platform. Both catalogues have coverage gaps. Search handles punctuation, accents and typos;
        filters explain hidden results and can be cleared. Shared metadata credits:{" "}
        <a href="https://en.wikipedia.org/">Wikipedia</a> and{" "}
        <a href="https://www.tvmaze.com/">TVmaze</a> (
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA</a>); curated
        availability from <a href="https://www.justwatch.com/in">JustWatch India</a> and{" "}
        <a href="https://www.netflix.com/tudum/top10/india/tv">Netflix</a>.
      </p>
      <h2>Media credits</h2>
      <p>
        The diagnostic fixture comes from{" "}
        <a href="https://media.w3.org/2010/05/video/movie_300.mp4">W3C’s media test collection</a>.
        Legacy open-film IDs and credits remain for saved rooms. Big Buck Bunny, Sintel and Tears of
        Steel are Blender Foundation open films under Creative Commons Attribution 3.0.
        Recommendation artwork remains the property of its respective rights holders.
      </p>
      <p>
        <a href="https://peach.blender.org/about/">Big Buck Bunny credits</a> ·{" "}
        <a href="https://durian.blender.org/about/">Sintel credits</a> ·{" "}
        <a href="https://mango.blender.org/sharing/">Tears of Steel credits</a>
      </p>
    </main>
  );
}

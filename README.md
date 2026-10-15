# Watch Together

A film-club watch-party app with synchronized direct-video playback, real movie and
series discovery for India, room chat, reactions, shared queues, polls, host
transfer, streaming-service companions and optional tab sharing.

Live: https://watch-together-lyart.vercel.app/

## Run locally

Node.js 22.12+ or 24+ and npm are required.

```sh
npm ci
npm run dev
```

Open the Vite URL printed in the terminal. The web app and the included WebSocket
relay run together; the relay defaults to port 3001. For other devices, use your
computer's printed LAN address and allow both ports through the firewall. Direct
video rooms do not require an external backend. Persistent film clubs require
server-only `REDIS_URL`; see `.env.example`. Never put that value in a `VITE_` variable.

## Viewing modes

- **Video link:** everyone loads an accessible MP4/WebM. Playback, queue, readiness,
  intermission, chat, emoji reactions, polls and host controls are shared. The
  host starts after all viewers mark ready. No extension is required.
- **Streaming service:** every viewer opens the same title on their own service,
  with authorized account access, and connects the desktop Chrome/Edge companion.
  Website-to-extension handoff prefills setup but does not grant permissions or
  connect a tab silently. Commercial adapters remain experimental; fixture tests
  are not proof of Netflix or another current signed-in player.
- **Screen share:** the host captures an unprotected browser tab. Chrome/Edge tab
  audio is the preferred path. Direct WebRTC peers use public STUN; there is no
  TURN media relay or SFU. Restrictive networks and host upload bandwidth can
  limit delivery. This mode does not bypass DRM or grant retransmission rights.

The website and extension each have their own host role. Website polls and chat
work across modes. Queues and post-film direct-player reviews apply to direct
videos; choosing a protected title does not enqueue its page URL as an MP4.

## Discovery

The homepage groups real international and Indian titles under Movies and Series,
with a mix of genres, languages, recent chart entries and international favourites.
The curated recommendations retain India platform labels, links and a shared
source note. Availability was checked on 15 October 2026; it is not a live ranking
API. Keep `src/lib/discovery-data.json` updated when making new availability claims.

Typing at least two characters also searches Wikipedia's worldwide film catalogue
and TVmaze's series catalogue through `/api/discovery`. Requests are debounced,
stale responses are ignored, and provider failures preserve other results. The
server bounds its cache to 200 queries, caches successful responses for an hour,
and times out providers. No API key is required. Catalogue coverage is not exhaustive.

Search normalizes accents, punctuation and non-Latin text, tolerates typos, and
matches curated aliases, genres, languages and common platform names. Format,
genre and platform filters combine; counts explain hidden matches and filters
can be cleared. External catalogue results do not assert Indian streaming rights:
they link to a JustWatch India availability search. Original broadcast networks
are never treated as local subscription availability.

Real artwork replaces logo-only cards. Film search batches Wikipedia poster
lookups; series use TVmaze artwork. Portraits are contained rather than cropped,
images load lazily, and unavailable artwork has a deliberate title-card fallback.
Metadata and artwork credits are shared rather than repeated under each card.
“Plan a watch party” carries the selection into a new streaming room; each viewer
must open the actual title and connect their extension before synchronization.

## Film clubs

`/clubs` creates reusable unlisted film-club invites. Redis persists shared shelves,
scheduled screenings, RSVPs, history and spoiler-hidden reviews. Calendar downloads
use local display times and UTC iCalendar timestamps. Names are not verified accounts.

The creator's separate host key is saved in their browser. Save it privately using
Host key & recovery. It permits scheduling, cancellation and completion; it is not
part of the public invite. The API checks origins, owner secrets, input bounds and
rate limits. Atomic compare-and-set updates preserve concurrent RSVPs.

## Reliability

Direct-player events use monotonic sequences and a deterministic user-ID tie-break.
Full snapshots restore missed room state on initial join and reconnection, including
when the host and epoch are unchanged. Controls remain unavailable during recovery.
Simultaneous poll creation resolves by version then poll ID, independently of delivery
order. Same-poll replays cannot reopen a closed poll. Host anchors repeat every three
seconds; host election follows presence loss. Abrupt network loss takes longer to
detect than closing a tab normally.

Clock offsets use low-RTT ping samples. Direct players check every 50 ms; drift below
120 ms is ignored, moderate drift changes speed by ±6%, and drift at or above 500 ms
seeks. Paused players seek because rate changes cannot correct a paused clock.

## Measurements and submission

Open `/diagnostics` and run the ten-player check. It uses ten native video elements,
ten independent room engines and the actual relay, with a fixed W3C media fixture.
The workload contains thirty play/pause/seek controls plus a final cleanup pause and
a deliberate 0.8-second drift. The raw report records every viewer, timestamps,
browser, topology, samples and target checks. Keep the page in the foreground.

The recorded loopback report is served at `/verification/loopback.json`. This is a
single-computer browser test, not a claim of ten physical LAN devices or universal
streaming-service compatibility. See `docs/SUBMISSION.md` and the site's `/docs` page
for measured results, scope and the actual-LAN test procedure.

Real screening rooms expose **Playback measurements**: per-viewer applied-control
latency p50/p95, settled drift and JSON export with test conditions. Latency measures
command issue to observed native media state; scheduled countdowns are excluded.
Drift is sampled after a 500 ms settling window without discarding excessive values.
Collect every remote viewer's export before calculating a room-wide p95. Clock
estimation and buffering introduce uncertainty; record failures as well as passes.

## Deploy

### Vercel

`vercel.json` builds the web app and `/api/realtime` WebSocket endpoint together.
Connect an Upstash Redis database and supply server-only `REDIS_URL`. The browser
and companion default to the deployment's secure endpoint. Redis leases and atomic
state/event commits serialize streaming mutations across function instances.
Inactive room records expire after one hour; dead connections expire after one
minute. Clients reconnect when a function connection reaches its duration limit.
Film-club records have separate persistence without the room TTL.

```sh
vercel deploy --prod --scope htrap-08
```

The current account uses the free Redis plan with paid auto-upgrades disabled.
GitHub source is maintained separately; automatic Git-based deployment is not assumed.
When deploying a source snapshot, ensure deleted files are also removed from it.

### Dedicated Node server

```sh
npm run build
npm start
```

Run both processes behind HTTPS/WSS. Set `VITE_REALTIME_URL` to the public relay URL
before building and configure `REALTIME_ORIGINS` on the realtime process for allowed
web and extension origins. `REALTIME_PORT` defaults to 3001. This relay uses memory;
rooms disappear after all participants leave or after a full restart. Room codes
provide access without accounts; this is a project prototype, not a hardened service.

## Checks

```sh
npm test
npm run lint
npx tsc --noEmit
npm run test:extension
npm run test:realtime
node --test server/clubs.test.mjs
node --env-file=.env.local --test server/clubs.integration.test.mjs realtime/distributed.test.mjs
npm run build
```

To check the companion worker against a deployed relay with simulated browser APIs:

```sh
TEST_REALTIME_URL=wss://watch-together-lyart.vercel.app/api/realtime node --test extension/tests/background.test.mjs
```

The extension ZIP is regenerated before builds. Installation and service limitations
are documented at `/streaming` and in `extension/README.md`.

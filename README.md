# Watch Together

A real-time watch-party app with synchronized playback, movie discovery, chat,
reactions, shared queues, polls, and host transfer.

## Development

Requires Node.js 22.12+ (or 24+) and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. This starts the web app and the included WebSocket
room server on port 3001. Other devices on your network can open the app using
your computer's LAN address; allow both ports through the firewall.
No backend account or API key is required.

## Production

### Vercel

The checked-in Vercel configuration builds the web app and `/api/realtime`
WebSocket endpoint together. Connect an Upstash Redis database to the project
and supply its server-only `REDIS_URL` in production and preview environments.
The browser and extension use the same deployment's secure WebSocket endpoint.
Redis shares presence and streaming state between function instances; room
mutations use a lease and atomic state/event commit to preserve host authority.
Inactive room records expire after one hour and dead connections after one minute.
Clients reconnect when a Vercel function reaches its connection duration limit.

```sh
vercel deploy --prod
```

Use the free Redis plan with `autoUpgrade=false` to avoid automatic paid upgrades.
To check cross-instance behavior against a configured database, run
`node --env-file=.env.local --test realtime/distributed.test.mjs`.

### A dedicated Node server

```sh
npm run build
npm start
```

Deploy both Node processes to your own server. Reverse-proxy the web app and
WebSocket service with HTTPS/WSS. Set `VITE_REALTIME_URL` before building to the
public WebSocket URL (for example, `wss://realtime.example.com`). Set
`REALTIME_ORIGINS` on the realtime process to a comma-separated list of permitted
web app origins. `REALTIME_PORT` defaults to 3001. See `.env.example`.

Rooms use in-memory membership and client-replicated state. Late joins request
state from existing participants; reconnecting clients restore their presence.
The service runs as a single instance; room history is not persisted after every
participant leaves or across a full restart. Room codes provide access, without
account authentication. This is an in-progress prototype, not a hardened public
service. Production rate limits and persistence remain future work.

## Validation

```sh
npm test
npm run test:realtime
npm run build
```

The realtime integration test checks ten simultaneous connections, isolated
rooms, membership updates, event forwarding, and reconnects. The app's `/docs`
page describes playback synchronization and failure handling. Targets of 250 ms
control latency at p95 and 500 ms corrected drift require measurement on the
actual deployment; unit tests do not establish those guarantees.

## Streaming services

The `/streaming` page provides the installable companion extension and honest
compatibility notes. Select **Streaming service** in a room, copy its extension
setup, and connect from each viewer's own streaming tab. See
[extension/README.md](extension/README.md) for installation, service adapters,
permissions, deployment, and limitations.

The streaming relay owns host-authoritative playback state and restores it for
late joiners. It shares room chat with the website, while direct-video playback
remains a separate mode. The first streaming participant becomes host. Every
participant must have authorized access to the same title; protected video is
never captured or forwarded.

Commercial service adapters require signed-in testing before claiming verified
support. This package currently targets desktop Chrome and Edge.

## Film clubs and screening features

- `/clubs` creates and remembers reusable film-club invite links. Redis stores the
  shared shelf, scheduled screenings, RSVPs, history and reviews without a room TTL.
- The creator's separate host key is stored in their browser. Save a private copy
  from the club's Host key & recovery section to restore scheduling privileges on
  another device. The public invite never contains the host key. Anyone with the
  invite can view the club, add films, RSVP and review completed screenings; names
  are not verified accounts. Owner writes, origin checks, bounded input and atomic
  compare-and-set updates are enforced by the club API.
- Scheduled screenings use a stable room link and offer an iCalendar download.
  Dates are shown in the visitor's local timezone. A club host ending the scheduled
  film records it in history; post-film reviews can then be saved to the club.
- Direct-video rooms start paused. Each viewer marks ready after their player
  loads; the host starts or resumes together. Anyone can request an intermission.
- Theatre mode hides room navigation and the video-link form. Chat can remain visible,
  stay hidden, or appear only when playback is paused.
- Companion v0.2 adds a narrowly scoped website handshake. Send room to extension
  stages the setup, then the user opens the film and clicks the extension to approve
  site access. No silent installation or permission grant occurs. Existing unpacked
  users must replace the files, reload the extension and refresh their room.
- Commercial streaming adapters remain experimental pending signed-in service
  testing. The compatibility page distinguishes this from fixture-tested HTML5
  behavior. No protected video is captured or forwarded.

Additional validation:

```sh
node --test server/clubs.test.mjs
node --env-file=.env.local --test server/clubs.integration.test.mjs realtime/distributed.test.mjs
```

## Screen sharing and service selection

The homepage has two viewing paths and no recommended/sample films. Screen-share
mode (`?watch=share`) uses `getDisplayMedia` after a host click and WebRTC peers
signalled through the existing authenticated-by-room-invite WebSocket transport.
The relay forwards SDP/ICE, not captured media. Streams and peers close on stop,
unmount or host loss; late viewers request the current session. Google’s public
STUN server discovers connectivity; there is no TURN service, so restrictive NAT
and firewalls can prevent delivery. A host uploads one copy per viewer; this is
not an SFU and ten-viewer bandwidth/latency has not been certified.

Ordinary YouTube/Twitch and non-DRM Vimeo videos are capture candidates, not a
blanket promise of capture or permission to retransmit. Protected titles use
separate playback with the companion, each viewer having their own access.
Current subscription-service integrations remain experimental. Sources and
installation instructions are linked on `/streaming`. Legacy sample IDs are
resolved only to keep previously saved rooms/screenings working; there is no
catalog browsing, default sample or recommendation engine in the UI.

Screen signalling tests cover stale/foreign messages, early ICE, negotiation,
multiple viewers, retries and cleanup using fake peer connections. Live browser
capture and signed-in service compatibility require manual verification.

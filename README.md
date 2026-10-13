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

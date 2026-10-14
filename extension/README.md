# Watch Together streaming companion — v0.2 preview

A Manifest V3 extension for desktop Chrome 116+ and Chromium-based Edge.
The video stays on the streaming service. Every viewer uses their own authorized
service access. Only sanitized page URLs, titles, nicknames, playback state,
and messages are sent to your configured Watch Together server.

## Install

1. Download the ZIP from the website's `/streaming` page and extract it, or use
   this repository's `extension/` directory directly.
2. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.
4. Pin the extension. It has not been published to the Chrome Web Store.

## Connect

1. Create a Watch Together room and select **Streaming service**.
2. Click **Send room to extension** in the room (v0.2). The setup and nickname are
   staged for the popup. **Copy extension setup** remains a fallback.
3. Open a movie/episode on the streaming service and press play once.
4. Click the extension **on the video tab**, paste the setup, choose a nickname,
   and connect (the setup is already filled after a website handoff). Approve access to the selected site, detected player frames, and room server.
5. Each friend repeats this from their own streaming tab and account.
6. Mark **I’m ready** in the popup after opening the host’s title. The first streaming
   participant hosts; host player actions are sent to ready guests. Use **Intermission**
   for a shared break; the host resumes once everyone marks ready again.
   Use **Pass host** in the popup to transfer control. Guests must match the host's
   selected page before following playback. The popup can navigate to that page
   only after a user's explicit **Open the host's video** click.

Keep the video tab open. Navigating on the same permitted origin is detected and
re-attached. A new origin requires reconnecting and granting that origin.
Closing or disconnecting the selected tab leaves the streaming room. If the
host leaves, the next participant becomes host. Rooms are in-memory and are
removed after their last streaming viewer and website observer leave.

## Adapters and limits

- Netflix: guarded access to the page's own player controls; HTML5 fallback.
- YouTube: page player controls; HTML5 fallback.
- Prime Video, Disney+, Hulu, Max/HBO Max: HTML5 discovery, player selectors,
  and best-effort ad markers.
- Apple TV+, Paramount+, Crunchyroll, Vimeo: HTML5 discovery.
- Other sites: generic HTML5 discovery, including accessible open shadow roots.

These adapters are **not verified against signed-in commercial service players**.
They can need updates when the service changes. Local player and relay behavior
are tested; that does not establish universal compatibility.

Ad detection suspends synchronization; it does not skip advertisements. Different
ad schedules can require waiting and manual resync. Closed shadow roots,
restricted APIs, cross-origin player frames without permission, live/non-seekable
streams, region differences, and autoplay rules limit synchronization. The
extension never captures video, extracts media URLs, or bypasses DRM.

At connection time the popup requests the current site, recognized embedded player
origins (including Crunchyroll/Vimeo player hosts), and the room server. It does
not grant access to every website at installation. Cross-origin embedded players may not be detected. Reconnect on
the actual video page or grant the required player origin through your browser's
extension site-access controls. Mobile apps, TVs, Safari, and Firefox are not
supported by this package.

## Server deployment

Local default: `ws://localhost:3001` with website `http://localhost:3000`.
That connects only to the same computer. Friends elsewhere need your LAN address
or a deployed HTTPS website and public WSS realtime server. Copying the setup
from a correctly configured website includes its backend URL automatically.

Set `VITE_REALTIME_URL=wss://your-realtime-host` before building the website.
The popup's **Server settings** allows manual configuration when entering a plain
six-character room code.

If `REALTIME_ORIGINS` is set, add each allowed
`chrome-extension://<extension-id>` origin alongside the website origin. The
unpacked extension ID is visible in the browser's extensions page and can differ
between computers. Do not disable the origin restriction on a public server.
A store-published extension would have one stable signed extension ID.

The streaming protocol is host-authoritative. It is separate from sample-video
replication, and both transports share room chat. Sessions persist across service
worker restarts using `chrome.storage.session`; reconnects restore membership.
Room codes are the current access mechanism. Accounts, persistent history, and
production-grade abuse protection are not implemented. A 60-message-per-second
connection limit and 64 KiB payload cap protect the relay from simple floods.

## Build and verify

```sh
npm run package:extension
npm run test:extension
npm run test:realtime
npm test
npm run build
```

The ZIP builder uses only Node.js and excludes tests and fixtures. It runs before
production builds, placing `watch-together-extension.zip` in `public/`.
Chrome service-worker, content-script, and permission guidance:
https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets
https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions

Website handoff accepts only the production Watch Together room origin and local
development room pages. It cannot execute scripts, grant video-site permission,
or connect a tab silently. Refresh the website after reloading an updated extension.

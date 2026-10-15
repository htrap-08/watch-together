# Submission guide — Watch Together

Updated: 15 October 2026. Live app: https://watch-together-lyart.vercel.app/

## Original requirement mapping

| Requirement                                           | Implementation / evidence                                                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invite links and room codes                           | Homepage create/join, mode-preserving room links                                                                                                                |
| Synchronized play, pause, seek                        | Shared host-clock anchors, deterministic control sequences, native HTML video synchronization                                                                   |
| Movie recommendations, category filters, fuzzy search | Real India movie/series discovery on the homepage; format, genre and platform filters; typo tolerance; preferred-genre ranking; dated source and provider links |
| Reactions, chat, playlists, polls, host transfer      | Website chat/polls/host controls; reactions in all modes; direct-video shared queue with voting; companion host controls                                        |
| Automatic drift correction                            | 50 ms checks; ±6% speed nudges above 120 ms; seek at 500 ms; paused-player seek correction                                                                      |
| Late join/reconnect/concurrent actions                | Full snapshot restore, recovery readiness gating, host election, deterministic playback and poll ordering; permanent regressions for both audited bugs          |
| At least ten concurrent users                         | Ten WebSocket participants in integration tests and ten simultaneous native browser players in the recorded workload                                            |
| ≤250 ms p95 local control latency                     | 132.5 ms measured in the recorded single-computer loopback run; physical-LAN validation remains separate                                                        |
| ≤500 ms corrected drift                               | 98.3 ms maximum settled drift in the recorded loopback run, including a deliberate 0.8 s error; physical-LAN validation remains separate                        |
| Measurements, test conditions, failure handling       | Raw `public/verification/loopback.json`, website `/docs`, repeatable `/diagnostics`, per-viewer room export, regression and integration tests                   |

## Recorded browser run

- Start/end: `2026-10-15T07:08:39.660Z` to `2026-10-15T07:09:07.914Z` (UTC).
- Browser: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36`.
- Topology: ten native video elements and ten independent room clients, in one browser page on one computer. HTTP app `localhost:3002`, local Node WebSocket relay `localhost:3003`. This is loopback, not ten physical LAN devices.
- Fixture: the repository's fixed W3C media test clip, muted. Ten independently controlled players, using the same `syncPlayer` function as the real room.
- Timing: 50 ms player checks; 900 ms between workload controls; 500 ms settling window.
- Workload: thirty play/pause/seek controls plus a final cleanup pause; a 0.8 s drift injected into one remote viewer while playing.
- Remote latency samples: 279 (31 applied controls × 9 non-host viewers).
- Settled drift samples: 2565, with excessive values retained rather than filtered out.
- Remote native-state latency: p50 38.5 ms; p95 132.5 ms.
- Maximum absolute settled drift: 98.3 ms.
- Both targets passed under those conditions. These measure native video state, not display-photon latency. Clock estimation, decoding, buffering and device scheduling introduce uncertainty.

## Reproduce and extend

1. `npm ci`, then `npm run dev`.
2. Open `/diagnostics` in the foreground and click **Run ten-player check**. Download the JSON. The page reports failures or incomplete sampling rather than treating missing observations as passes.
3. For the assignment's physical LAN requirement, open one Video link room across ten viewers on your LAN, load one accessible MP4/WebM and complete readiness.
4. Record devices, browsers, video resolution, wired/Wi-Fi topology and buffering. Exercise thirty controls, leaving time to settle after each.
5. Export **Playback measurements** from every viewer. Aggregate remote control samples for p95 and examine every viewer's drift. Report both successes and failures.
6. Exercise reconnects, late joins, simultaneous controls/polls, and host departure. Dedicated regression tests cover queue/chat/poll restoration and concurrent poll convergence; relay tests cover room isolation and failover.

## Demo sequence

1. Show the homepage's India film and series picks. Search `shaqe` to demonstrate typo tolerance, filter by format/genre/platform and select **Plan a watch party**.
2. Explain protected playback: each person needs their own service access and the unpacked companion. The site carries the selected title into setup; it never forwards protected video. Commercial service players still need signed-in manual verification.
3. For a dependable core demo, choose **Video link** and use the diagnostic fixture URL on this deployment (`/diagnostics/fixture.mp4`) as a complete HTTP/HTTPS URL. Invite another viewer, load the queue item and mark ready.
4. Start together, pause/seek, exchange chat/reactions, vote in a poll, change the host and request an intermission.
5. Show a club's shared shelf, scheduled screening, RSVP/calendar export and after-film review.
6. Open `/docs` and the recorded JSON. Explain the measured scope and the remaining physical-LAN/device verification honestly.

## Checks and limits

Run the README check commands before submission. The prior reconnect and poll regressions are permanent passing tests now. The source metadata cleanup, lint errors and misleading documentation were corrected.

Screen sharing uses peer-to-peer media without TURN or an SFU; restrictive networks and host bandwidth remain limitations. Streaming service adapters are preview integrations, including JioHotstar's generic HTML5 selector; signed-in Netflix/Prime/JioHotstar behavior is not certified by fixture tests. Extension installation is manual and documented on `/streaming`. Core queue/review behavior uses the direct player, while protected-title selection stays on its service.

Recommendations are a curated, sourced snapshot checked on 15 October, not an automatic real-time feed. Refresh the data before claiming later availability. No account or browser-store publication is required for the direct-video core demo.

# Final submission checks

Checked on 15 October 2026 against application revision `5c66fa5`.
Repository: https://github.com/htrap-08/watch-together
Live app: https://watch-together-lyart.vercel.app/

The checks below passed. This report records the tested scope; it does not certify
physical-LAN performance or every protected streaming service.

## Reproducible source

- GitHub `main`, the working repository and Desktop checkout matched `5c66fa5` before this documentation-only audit commit.
- Cloned GitHub into an empty temporary directory and ran `npm ci` successfully.
- Clean checkout: all 33 app tests passed; TypeScript, ESLint and production build passed.
- Tested runtime: Node.js 24.21.0, npm 11.19.0, macOS.
- Clean install produced upstream deprecation notices, but no install or build failures.
- The README now includes an explicit environment-file command for local Redis-backed clubs and a reproducible two-viewer demo.

## Automated verification

| Check                                                               | Result                              |
| ------------------------------------------------------------------- | ----------------------------------- |
| App, room recovery, playback, discovery and routing tests           | 33 passed                           |
| Extension, room relay and club tests, including Redis integrations  | 26 passed; zero skipped             |
| Total distinct automated tests                                      | 59 passed; zero failures            |
| TypeScript (`npx tsc --noEmit`)                                     | Passed                              |
| ESLint (`npm run lint`)                                             | Passed with no warnings             |
| Production build (`npm run build`)                                  | Passed                              |
| Extension worker and distributed relay, repeated against public WSS | 2 passed                            |
| `git diff --check`                                                  | Passed                              |
| Production dependency audit (`npm audit --omit=dev`)                | Zero known advisories at check time |

Redis-backed tests used isolated test records and did not expose credentials.
The public WSS checks rerun two existing tests; they are not counted twice in the
59 distinct tests. Commands are listed in the README. Redis integration tests need
server-only configuration and explicitly skip when it is absent.

## Public application checks

- `/`, `/streaming`, `/clubs`, `/docs` and `/diagnostics`: HTTP 200.
- Recorded benchmark and extension download: HTTP 200.
- An unknown route: HTTP 404.
- Downloaded extension ZIP passed integrity checks and matched the source package byte-for-byte: version 0.2.1, ten packaged files.
- International catalogue search returned Amélie and other movie matches with artwork; both providers responded. Non-film musical results were excluded.
- Recommendation cards have actual artwork, separate Movies/Series headings, no recommendation counters and no per-card source or chart labels.
- In an isolated production room, two browser tabs joined, restored the shared queue, loaded the documented direct-video fixture and marked ready.
- **Start together** started both native players. Both reported usable media with no media error.
- Shared pause and +10-second seek converged to the same paused native time (17.828086 seconds in this spot check). This is functional evidence, not a latency benchmark.
- A chat message reached the other viewer. A new poll and its vote propagated.
- Refreshing the guest restored the selected video, playback position, chat and poll vote.
- Host transfer gave the guest the hosting role. No browser console errors were recorded on the refreshed guest during the checked flow.
- Test viewers left after verification; no test room is needed for the submission demo.

## Tracked files and credentials

- Only `.env.example` is tracked; `.env.local`, dependencies and deployment credentials are ignored.
- High-confidence credential patterns found only the intentionally fake Redis URL in `.env.example`.
- The active backend credential value was absent from all 446 scanned Git objects and from all 32 built public asset files.
- Current tracked paths contain no generator metadata. Published Git history was preserved.
- These scoped checks are not a guarantee against every possible secret or security defect.

## Remaining manual verification

1. **Assignment performance conditions:** the recorded ten-player loopback run passed with p95 applied-control latency 132.5 ms and maximum settled drift 98.3 ms. It uses one computer, not ten physical LAN viewers. Run the procedure in [SUBMISSION.md](SUBMISSION.md) on the actual LAN/devices before claiming that requirement has been measured under those conditions.
2. **Protected commercial players:** signed-in Netflix, Prime Video, JioHotstar and other commercial service behavior remains experimental. Fixture tests verify companion/relay behavior, not those services' current authenticated players. Everyone needs their own title access and the manually installed companion.
3. **Network limits:** screen sharing has no TURN server or SFU. Restrictive networks or host upload bandwidth may prevent or limit delivery. The direct-video mode is the dependable core demonstration path.

These limitations are already disclosed in the README, submission guide and site documentation.

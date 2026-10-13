# Watch Together

create this site
Watch Party

Goal: Build a real-time watch-party app where multiple users watch videos together with synchronized playback and shared movie discovery.

Core Requirements

﻿﻿Create and join rooms via invite link or room code.

﻿﻿Sync play, pause and seek across all participants.

﻿﻿Movie recommendations with categories, filters and fuzzy search.

﻿﻿Emoji reactions, live chat, shared playlists, group polls and host transfer.

﻿﻿Automatic playback drift detection and correction.

﻿﻿Reliable handling of late joins, reconnections and concurrent actions.

Constraints

﻿﻿At least 10 concurrent users per room.

﻿﻿Playback control propagation ≤ 250 ms at p95 on a local network.

﻿﻿Playback drift ≤ 500 ms after correction.

﻿﻿Document latency measurements, test conditions and failure handling.

Bonus: Creative features carry higher weightage. Evaluation favors originality, depth, multi-user interaction and reliability over basic functionality.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8ed3e03f-f62a-4fc1-ba88-65cfa8212aaf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

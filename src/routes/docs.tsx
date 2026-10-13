import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "How sync works — Watch Party" },
      { name: "description", content: "Sync protocol, latency measurement method and failure handling for Watch Party." },
      { property: "og:title", content: "How sync works — Watch Party" },
      { property: "og:description", content: "Sync protocol, latency measurement and failure handling." },
    ],
  }),
  component: Docs,
});

function Docs() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
      <h1 className="text-4xl font-extrabold">How sync works</h1>
      <p className="text-muted-foreground">Playback is a shared anchor: position + host-clock timestamp + sequence number. Every viewer computes where the video should be right now.</p>
      <h2 className="text-2xl font-bold">Clock & latency</h2>
      <p className="text-muted-foreground">Viewers estimate their offset to the host clock with NTP-style pings (lowest round-trip sample of the last 12). Each control message carries its send time, so receive delay is measured per message; p50/p95 are computed in-app.</p>
      <h2 className="text-2xl font-bold">Drift correction</h2>
      <p className="text-muted-foreground">Drift under 120 ms is ignored; 120 ms–1 s is fixed by ±6% playback speed; above 1 s triggers a seek. Target after correction: under 500 ms.</p>
      <h2 className="text-2xl font-bold">Failure handling</h2>
      <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
        <li>Late join / reconnect: newcomer requests state; host (or longest-present guest) replies.</li>
        <li>Concurrent actions: higher sequence wins, ties go to the lowest user id.</li>
        <li>Host leaves: after 3 s the longest-present viewer takes over and re-anchors playback.</li>
        <li>Missed messages: the host re-broadcasts the anchor every 3 s.</li>
      </ul>
      <p className="text-sm text-muted-foreground">Test conditions and measured numbers have not been recorded yet.</p>
    </main>
  );
}

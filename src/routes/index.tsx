import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clapperboard, Gauge, Users, Vote, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATALOG } from "@/lib/catalog";
import { loadMe, newRoomCode, saveMe } from "@/lib/identity";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Watch Party — watch together, perfectly in sync" },
      { name: "description", content: "Open a room, share the code, and watch videos together with synced playback, live chat, reactions and polls." },
      { property: "og:title", content: "Watch Party — watch together, perfectly in sync" },
      { property: "og:description", content: "Synced playback, live chat, reactions, polls and shared queues for up to dozens of friends." },
    ],
  }),
  component: Index,
});

function Index() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => {
    setName(loadMe()?.name ?? "");
  }, []);

  const go = (c: string) => {
    if (!name.trim()) return;
    saveMe(name);
    void nav({ to: "/room/$code", params: { code: c.toUpperCase() } });
  };

  const posters = [...CATALOG, ...CATALOG];

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <Clapperboard className="h-6 w-6 text-primary" /> Watch Party
        </div>
        <Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          How sync works →
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Sub-250ms control sync
          </p>
          <h1 className="text-5xl font-extrabold leading-[0.95] md:text-7xl">
            Same frame.
            <br />
            <span className="text-marquee">Every couch.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            Open a room, send the code, and everyone presses play at exactly the same moment — then argue about it in chat.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-screen">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your name</label>
          <Input className="mt-2 h-12 text-base" placeholder="e.g. Popcorn Paula" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
          <Button variant="marquee" size="lg" className="mt-4 w-full" disabled={!name.trim()} onClick={() => go(newRoomCode())}>
            Start a new party
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or join one <div className="h-px flex-1 bg-border" />
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim().length >= 4) go(code.trim());
            }}
          >
            <Input className="h-12 font-mono text-lg uppercase tracking-[0.3em]" placeholder="ROOM CODE" value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, ""))} maxLength={8} />
            <Button type="submit" variant="secondary" size="lg" className="h-12" disabled={!name.trim() || code.length < 4}>
              Join
            </Button>
          </form>
        </div>
      </section>

      <div className="relative py-4">
        <div className="flex w-max animate-marquee-scroll gap-4">
          {posters.map((m, i) => (
            <img key={i} src={m.thumb} alt={m.title} loading="lazy" className="h-36 w-64 rounded-xl object-cover opacity-70" />
          ))}
        </div>
      </div>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-16 md:grid-cols-4">
        {[
          { i: Zap, t: "Scheduled starts", d: "Play commands are timestamped slightly in the future so everyone starts on the same frame." },
          { i: Gauge, t: "Drift doctor", d: "Each viewer silently speeds up or slows down to stay within half a second." },
          { i: Users, t: "Pass the remote", d: "Hand host powers to anyone; if the host leaves, the longest-watching guest takes over." },
          { i: Vote, t: "Room democracy", d: "Vote the queue, run polls, and see where the room laughed on the reaction heatmap." },
        ].map(({ i: Icon, t, d }) => (
          <div key={t} className="rounded-2xl border border-border bg-card/60 p-5">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-bold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

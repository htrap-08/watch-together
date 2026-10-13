import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATALOG, resolveVideo } from "@/lib/catalog";
import { loadMe, saveMe } from "@/lib/identity";
import { useRoom, type Me } from "@/lib/room-engine";
import { correctionFor, expectedPosition, shouldBePlaying } from "@/lib/sync";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — Watch Party` },
      { name: "description", content: "Join this watch party and watch in sync." },
      { property: "og:title", content: `Room ${params.code} — Watch Party` },
      { property: "og:description", content: "Join this watch party and watch in sync." },
    ],
  }),
  component: Room,
});

function Room() {
  const { code } = Route.useParams();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  useEffect(() => setMe(loadMe()), []);
  const room = useRoom(code, me);
  const v = useRef<HTMLVideoElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      const el = v.current;
      const pb = room.state.playback;
      const vid = resolveVideo(pb.videoId);
      if (!el || !vid) return;
      if (el.src !== vid.src) { el.src = vid.src; return; }
      const now = room.hostNow();
      const exp = expectedPosition(pb, now);
      const play = shouldBePlaying(pb, now);
      if (play && el.paused) void el.play().catch(() => {});
      if (!play && !el.paused) el.pause();
      if (el.readyState < 2) return;
      const c = correctionFor(el.currentTime, exp);
      if (c.kind === "seek") el.currentTime = c.target;
      el.playbackRate = c.rate;
      room.driftRef.current = el.currentTime - exp;
    }, 250);
    return () => clearInterval(id);
  });

  if (!me)
    return (
      <main className="mx-auto max-w-sm space-y-3 px-6 py-24">
        <h1 className="text-3xl font-bold">Join room {code}</h1>
        <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button variant="marquee" className="w-full" disabled={!name.trim()} onClick={() => setMe(saveMe(name))}>Join</Button>
      </main>
    );

  const s = room.state;
  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold">Watch Party</Link>
          <span className="font-mono text-sm text-muted-foreground">{code} · {room.status} · {room.members.length} watching{room.isHost ? " · host" : ""}</span>
        </div>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-screen shadow-screen">
          <video ref={v} className="h-full w-full" playsInline />
          {room.floats.map((f) => (
            <span key={f.id} className="pointer-events-none absolute bottom-4 animate-float-up text-3xl" style={{ left: `${f.x}%` }}>{f.emoji}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => (s.playback.playing ? room.api.pause() : room.api.play())}>{s.playback.playing ? "Pause" : "Play"}</Button>
          <Button variant="secondary" onClick={() => room.api.seek((v.current?.currentTime ?? 0) - 10)}>-10s</Button>
          <Button variant="secondary" onClick={() => room.api.seek((v.current?.currentTime ?? 0) + 10)}>+10s</Button>
          <Button variant="secondary" onClick={() => room.api.countdownPlay()}>3-2-1 start</Button>
          {["😂", "😱", "🔥", "❤️", "👏"].map((e) => (
            <Button key={e} variant="ghost" onClick={() => room.api.react(e, v.current?.currentTime ?? 0)}>{e}</Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATALOG.map((m) => (
            <button key={m.id} onClick={() => room.api.load(m.id)} className="overflow-hidden rounded-xl border border-border bg-card text-left">
              <img src={m.thumb} alt={m.title} className="aspect-video w-full object-cover" loading="lazy" />
              <p className="p-2 text-sm font-semibold">{m.title}</p>
            </button>
          ))}
        </div>
      </section>
      <aside className="flex h-[80vh] flex-col rounded-2xl border border-border bg-card p-3">
        <div className="flex-1 space-y-1 overflow-y-auto text-sm">
          {s.chat.map((c) => (
            <p key={c.id} className={c.system ? "text-muted-foreground italic" : ""}>
              {!c.system && <b style={{ color: c.color }}>{c.name}: </b>}{c.text}
            </p>
          ))}
        </div>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); room.api.chat(text); setText(""); }}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something" />
          <Button type="submit">Send</Button>
        </form>
      </aside>
    </main>
  );
}

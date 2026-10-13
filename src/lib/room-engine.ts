import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptHostClaim,
  electHost,
  estimateClock,
  expectedPosition,
  isNewerPlayback,
  type ClockSample,
  type Playback,
} from "./sync";

export type Me = { id: string; name: string; color: string };
export type Member = Me & { joinedAt: number; drift: number | null; rtt: number | null; status: string };
export type ChatMsg = { id: string; userId: string; name: string; color: string; text: string; at: number; system?: boolean };
export type QueueItem = { uid: string; videoId: string; addedBy: string; votes: string[] };
export type Poll = { id: string; question: string; options: { text: string; votes: string[] }[]; by: string; closed: boolean };
export type Reaction = { id: string; emoji: string; userId: string; videoId: string; t: number };

export type RoomState = {
  hostId: string;
  hostEpoch: number;
  controlMode: "host" | "all";
  playback: Playback;
  queue: QueueItem[];
  history: string[];
  poll: Poll | null;
  chat: ChatMsg[];
  reactions: Reaction[];
};

type Ev = { type: string; from: string; sentAt: number; [k: string]: unknown };

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const emptyState = (): RoomState => ({
  hostId: "",
  hostEpoch: 0,
  controlMode: "all",
  playback: { videoId: null, playing: false, position: 0, at: 0, seq: 0, by: "" },
  queue: [],
  history: [],
  poll: null,
  chat: [],
  reactions: [],
});

export type ConnStatus = "connecting" | "live" | "reconnecting";
export type FloatReaction = { id: string; emoji: string; x: number; name: string };

/** Realtime room engine: replicated state over broadcast, membership via presence. */
export function useRoom(code: string, me: Me | null) {
  const stateRef = useRef<RoomState>(emptyState());
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [members, setMembers] = useState<Member[]>([]);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [floats, setFloats] = useState<FloatReaction[]>([]);
  const [ready, setReady] = useState(false);
  const chRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef(me);
  meRef.current = me;
  const joinedAt = useRef(0);
  const offsetRef = useRef(0);
  const rttRef = useRef<number | null>(null);
  const samples = useRef<ClockSample[]>([]);
  const ctrlLatency = useRef<number[]>([]);
  const pingLatency = useRef<number[]>([]);
  const driftRef = useRef<number | null>(null);
  const syncedRef = useRef(false);
  const membersRef = useRef<Member[]>([]);
  const statsListeners = useRef(new Set<() => void>());

  const hostNow = useCallback(() => Date.now() + offsetRef.current, []);
  const isHost = () => !!meRef.current && stateRef.current.hostId === meRef.current.id;

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const ch = chRef.current;
    const m = meRef.current;
    if (!ch || !m) return;
    void ch.send({ type: "broadcast", event: "ev", payload: { type, from: m.id, sentAt: Date.now() + offsetRef.current, ...payload } });
  }, []);

  const commit = useCallback((fn: (s: RoomState) => void) => {
    fn(stateRef.current);
    rerender();
  }, []);

  const pushSystem = (s: RoomState, text: string) => {
    s.chat = [...s.chat, { id: uid(), userId: "", name: "", color: "", text, at: Date.now(), system: true }].slice(-150);
  };

  const spawnFloat = useCallback((emoji: string, name: string) => {
    const f = { id: uid(), emoji, name, x: 10 + Math.random() * 80 };
    setFloats((p) => [...p.slice(-30), f]);
    setTimeout(() => setFloats((p) => p.filter((q) => q.id !== f.id)), 2600);
  }, []);

  /** New host rebases playback into its own clock and announces it. */
  const becomeHostRebase = useCallback(() => {
    const s = stateRef.current;
    const pos = expectedPosition(s.playback, Date.now() + offsetRef.current);
    const scheduled = s.playback.playing && s.playback.at > Date.now() + offsetRef.current;
    const delay = scheduled ? s.playback.at - (Date.now() + offsetRef.current) : 0;
    offsetRef.current = 0;
    samples.current = [];
    rttRef.current = 0;
    s.playback = { ...s.playback, position: scheduled ? s.playback.position : pos, at: Date.now() + delay };
    send("anchor", { pb: s.playback, rebase: true });
  }, [send]);

  const handle = useCallback(
    (ev: Ev) => {
      const m = meRef.current;
      if (!m || ev.from === m.id) return;
      const s = stateRef.current;
      switch (ev.type) {
        case "sync_req": {
          const hostPresent = membersRef.current.some((x) => x.id === s.hostId);
          const fallback = !hostPresent && electHost(membersRef.current.filter((x) => x.id !== ev.from))?.id === m.id;
          if (syncedRef.current && (isHost() || fallback)) send("sync_state", { to: ev.from, state: s });
          break;
        }
        case "sync_state": {
          if (ev["to"] !== m.id) break;
          const inc = ev["state"] as RoomState;
          if (!syncedRef.current || acceptHostClaim({ hostId: s.hostId, epoch: s.hostEpoch }, { hostId: inc.hostId, epoch: inc.hostEpoch })) {
            stateRef.current = inc;
            syncedRef.current = true;
            samples.current = [];
            offsetRef.current = (ev.sentAt as number) - Date.now(); // coarse until first pong
            setReady(true);
            rerender();
            // fast initial clock sync burst
            for (let i = 0; i < 5; i++) setTimeout(() => send("ping", { to: stateRef.current.hostId, t0: Date.now() }), 150 * i);
          }
          break;
        }
        case "ping": {
          if (ev["to"] === m.id && isHost()) send("pong", { to: ev.from, t0: ev["t0"], th: Date.now() });
          break;
        }
        case "pong": {
          if (ev["to"] !== m.id || ev.from !== s.hostId) break;
          const t1 = Date.now();
          samples.current = [...samples.current, { t0: ev["t0"] as number, th: ev["th"] as number, t1 }].slice(-12);
          const c = estimateClock(samples.current);
          if (c) {
            offsetRef.current = c.offset;
            rttRef.current = c.rtt;
          }
          break;
        }
        case "lat_ping":
          send("lat_pong", { to: ev.from, t0: ev["t0"] });
          break;
        case "lat_pong":
          if (ev["to"] === m.id) {
            pingLatency.current = [...pingLatency.current, (Date.now() - (ev["t0"] as number)) / 2].slice(-1000);
            statsListeners.current.forEach((l) => l());
          }
          break;
        case "ctrl":
        case "anchor": {
          const inc = ev["pb"] as Playback;
          if (ev.type === "anchor" && ev["rebase"] && ev.from === s.hostId) {
            samples.current = [];
            offsetRef.current = ev.sentAt - Date.now();
            s.playback = inc;
            rerender();
            for (let i = 0; i < 4; i++) setTimeout(() => send("ping", { to: s.hostId, t0: Date.now() }), 120 * i);
            break;
          }
          if (ev.type === "ctrl") {
            ctrlLatency.current = [...ctrlLatency.current, Math.max(0, Date.now() + offsetRef.current - ev.sentAt)].slice(-500);
            statsListeners.current.forEach((l) => l());
          }
          if (isNewerPlayback(s.playback, inc) || (ev.type === "anchor" && inc.seq === s.playback.seq && inc.by === s.playback.by)) {
            const changedVideo = inc.videoId !== s.playback.videoId;
            s.playback = inc;
            if (changedVideo && inc.videoId) s.history = [...s.history.filter((h) => h !== inc.videoId), inc.videoId].slice(-20);
            rerender();
          }
          break;
        }
        case "host": {
          const claim = { hostId: ev["hostId"] as string, epoch: ev["epoch"] as number };
          if (!acceptHostClaim({ hostId: s.hostId, epoch: s.hostEpoch }, claim)) break;
          const wasHost = isHost();
          s.hostId = claim.hostId;
          s.hostEpoch = claim.epoch;
          const name = membersRef.current.find((x) => x.id === claim.hostId)?.name ?? "Someone";
          pushSystem(s, `${name} is now the host`);
          if (claim.hostId === m.id) becomeHostRebase();
          else if (wasHost && ev.from !== m.id && !ev["transfer"]) {
            // lost a split-brain race: resync from the winner
            syncedRef.current = false;
            send("sync_req");
          }
          rerender();
          break;
        }
        case "chat":
          s.chat = [...s.chat, ev["msg"] as ChatMsg].slice(-150);
          rerender();
          break;
        case "react": {
          const r = ev["r"] as Reaction;
          s.reactions = [...s.reactions, r].slice(-400);
          spawnFloat(r.emoji, membersRef.current.find((x) => x.id === r.userId)?.name ?? "");
          rerender();
          break;
        }
        case "q_add": {
          const it = ev["item"] as QueueItem;
          if (!s.queue.some((q) => q.uid === it.uid)) s.queue = [...s.queue, it];
          rerender();
          break;
        }
        case "q_vote": {
          s.queue = s.queue.map((q) => (q.uid === ev["uid"] ? { ...q, votes: toggle(q.votes, ev.from) } : q));
          rerender();
          break;
        }
        case "q_remove":
          s.queue = s.queue.filter((q) => q.uid !== ev["uid"]);
          rerender();
          break;
        case "poll":
          s.poll = ev["poll"] as Poll;
          rerender();
          break;
        case "poll_vote": {
          if (s.poll && s.poll.id === ev["pollId"] && !s.poll.closed) {
            const idx = ev["option"] as number;
            s.poll = { ...s.poll, options: s.poll.options.map((o, i) => ({ ...o, votes: i === idx ? addOnce(o.votes, ev.from) : o.votes.filter((v) => v !== ev.from) })) };
            rerender();
          }
          break;
        }
        case "poll_close":
          if (s.poll && s.poll.id === ev["pollId"]) s.poll = { ...s.poll, closed: true };
          rerender();
          break;
        case "mode":
          if (ev.from === s.hostId) s.controlMode = ev["mode"] as RoomState["controlMode"];
          rerender();
          break;
      }
    },
    [send, becomeHostRebase, spawnFloat],
  );

  // channel lifecycle
  useEffect(() => {
    if (!me) return;
    joinedAt.current = Date.now();
    stateRef.current = emptyState();
    syncedRef.current = false;
    const ch = supabase.channel(`watchparty:${code}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: me.id } },
    });
    chRef.current = ch;
    let bootTimer: ReturnType<typeof setTimeout> | undefined;

    ch.on("broadcast", { event: "ev" }, ({ payload }) => handle(payload as Ev));
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<Member>();
      const list = Object.values(st)
        .map((arr) => arr[0])
        .filter((x): x is Member & { presence_ref: string } => !!x)
        .map(({ presence_ref: _r, ...rest }) => rest as Member)
        .sort((a, b) => a.joinedAt - b.joinedAt);
      membersRef.current = list;
      setMembers(list);
    });
    ch.on("presence", { event: "join" }, ({ newPresences }) => {
      if (!syncedRef.current) return;
      for (const p of newPresences) {
        const pm = p as unknown as Member;
        if (pm.id !== me.id && !membersRef.current.some((x) => x.id === pm.id)) commit((s) => pushSystem(s, `${pm.name} joined`));
      }
    });
    ch.on("presence", { event: "leave" }, ({ leftPresences }) => {
      for (const p of leftPresences) {
        const pm = p as unknown as Member;
        commit((s) => pushSystem(s, `${pm.name} left`));
      }
    });

    ch.subscribe((st) => {
      if (st === "SUBSCRIBED") {
        setStatus("live");
        void ch.track({ ...me, joinedAt: joinedAt.current, drift: null, rtt: null, status: "watching" });
        // ask existing members for state (late join / reconnect)
        send("sync_req");
        clearTimeout(bootTimer);
        bootTimer = setTimeout(() => {
          if (syncedRef.current) return;
          // nobody answered: the room is empty, we create it
          const s = stateRef.current;
          s.hostId = me.id;
          s.hostEpoch = Math.max(1, s.hostEpoch + 1);
          pushSystem(s, `${me.name} opened the room`);
          syncedRef.current = true;
          setReady(true);
          send("host", { hostId: me.id, epoch: s.hostEpoch });
          rerender();
        }, 1800);
      } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") {
        setStatus("reconnecting");
      }
    });

    return () => {
      clearTimeout(bootTimer);
      void supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [code, me, handle, send, commit]);

  // host heartbeat + clock pings + presence stats + host failover
  useEffect(() => {
    if (!me) return;
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      const s = stateRef.current;
      if (!syncedRef.current) return;
      if (isHost()) {
        if (tick % 3 === 0) send("anchor", { pb: s.playback });
      } else if (s.hostId && tick % 2 === 0) {
        send("ping", { to: s.hostId, t0: Date.now() });
      }
      if (tick % 3 === 0 && chRef.current) {
        void chRef.current.track({ ...me, joinedAt: joinedAt.current, drift: driftRef.current, rtt: isHost() ? 0 : rttRef.current, status: "watching" });
      }
      // failover: host disappeared from presence
      const present = membersRef.current;
      if (present.length && s.hostId && !present.some((x) => x.id === s.hostId)) {
        missingHostTicks.current++;
        if (missingHostTicks.current >= 3) {
          missingHostTicks.current = 0;
          const elected = electHost(present);
          if (elected?.id === me.id) {
            s.hostId = me.id;
            s.hostEpoch += 1;
            pushSystem(s, `Host left — ${me.name} took the remote`);
            send("host", { hostId: me.id, epoch: s.hostEpoch });
            becomeHostRebase();
            rerender();
          }
        }
      } else missingHostTicks.current = 0;
    }, 1000);
    return () => clearInterval(id);
  }, [me, send, becomeHostRebase]);
  const missingHostTicks = useRef(0);

  const canControl = () => stateRef.current.controlMode === "all" || isHost();

  const control = useCallback(
    (patch: Partial<Playback>, leadMs = 0) => {
      const m = meRef.current;
      if (!m) return false;
      if (!(stateRef.current.controlMode === "all" || stateRef.current.hostId === m.id)) return false;
      const s = stateRef.current;
      const now = Date.now() + offsetRef.current;
      const pos = expectedPosition(s.playback, now);
      const next: Playback = { ...s.playback, position: pos, ...patch, at: now + leadMs, seq: s.playback.seq + 1, by: m.id };
      if (next.videoId && next.videoId !== s.playback.videoId) s.history = [...s.history.filter((h) => h !== next.videoId), next.videoId].slice(-20);
      s.playback = next;
      send("ctrl", { pb: next });
      rerender();
      return true;
    },
    [send],
  );

  const api = {
    play: () => control({ playing: true }),
    pause: () => control({ playing: false }),
    seek: (t: number) => control({ position: Math.max(0, t) }),
    load: (videoId: string) => control({ videoId, position: 0, playing: true }, 600),
    countdownPlay: () => control({ playing: true }, 3500),
    chat: (text: string) => {
      const m = meRef.current;
      if (!m || !text.trim()) return;
      const msg: ChatMsg = { id: uid(), userId: m.id, name: m.name, color: m.color, text: text.trim().slice(0, 500), at: Date.now() };
      commit((s) => (s.chat = [...s.chat, msg].slice(-150)));
      send("chat", { msg });
    },
    react: (emoji: string, t: number) => {
      const m = meRef.current;
      const s = stateRef.current;
      if (!m || !s.playback.videoId) return;
      const r: Reaction = { id: uid(), emoji, userId: m.id, videoId: s.playback.videoId, t };
      commit((st) => (st.reactions = [...st.reactions, r].slice(-400)));
      spawnFloat(emoji, m.name);
      send("react", { r });
    },
    enqueue: (videoId: string) => {
      const m = meRef.current;
      if (!m) return;
      const item: QueueItem = { uid: uid(), videoId, addedBy: m.name, votes: [m.id] };
      commit((s) => (s.queue = [...s.queue, item]));
      send("q_add", { item });
    },
    voteQueue: (u: string) => {
      const m = meRef.current;
      if (!m) return;
      commit((s) => (s.queue = s.queue.map((q) => (q.uid === u ? { ...q, votes: toggle(q.votes, m.id) } : q))));
      send("q_vote", { uid: u });
    },
    removeQueue: (u: string) => {
      commit((s) => (s.queue = s.queue.filter((q) => q.uid !== u)));
      send("q_remove", { uid: u });
    },
    playNext: () => {
      const s = stateRef.current;
      const next = [...s.queue].sort((a, b) => b.votes.length - a.votes.length)[0];
      if (!next) return false;
      if (!control({ videoId: next.videoId, position: 0, playing: true }, 600)) return false;
      commit((st) => (st.queue = st.queue.filter((q) => q.uid !== next.uid)));
      send("q_remove", { uid: next.uid });
      return true;
    },
    createPoll: (question: string, options: string[]) => {
      const m = meRef.current;
      if (!m) return;
      const poll: Poll = { id: uid(), question, options: options.map((text) => ({ text, votes: [] })), by: m.id, closed: false };
      commit((s) => (s.poll = poll));
      send("poll", { poll });
    },
    votePoll: (option: number) => {
      const m = meRef.current;
      const p = stateRef.current.poll;
      if (!m || !p || p.closed) return;
      commit((s) => {
        if (s.poll) s.poll = { ...s.poll, options: s.poll.options.map((o, i) => ({ ...o, votes: i === option ? addOnce(o.votes, m.id) : o.votes.filter((v) => v !== m.id) })) };
      });
      send("poll_vote", { pollId: p.id, option });
    },
    closePoll: () => {
      const p = stateRef.current.poll;
      if (!p) return;
      commit((s) => s.poll && (s.poll = { ...s.poll, closed: true }));
      send("poll_close", { pollId: p.id });
    },
    transferHost: (to: string) => {
      if (!isHost()) return;
      const s = stateRef.current;
      // re-anchor in my clock so the new host can rebase with its own offset estimate
      s.playback = { ...s.playback, position: expectedPosition(s.playback, Date.now()), at: Date.now() };
      s.hostId = to;
      s.hostEpoch += 1;
      const name = membersRef.current.find((x) => x.id === to)?.name ?? "Someone";
      pushSystem(s, `Remote passed to ${name}`);
      send("anchor", { pb: s.playback });
      send("host", { hostId: to, epoch: s.hostEpoch, transfer: true });
      rerender();
    },
    setMode: (mode: RoomState["controlMode"]) => {
      if (!isHost()) return;
      commit((s) => (s.controlMode = mode));
      send("mode", { mode });
    },
    latencyTest: async (n = 40) => {
      pingLatency.current = [];
      for (let i = 0; i < n; i++) {
        send("lat_ping", { t0: Date.now() });
        await new Promise((r) => setTimeout(r, 160));
      }
    },
  };

  return {
    state: stateRef.current,
    members,
    status,
    ready,
    floats,
    api,
    hostNow,
    isHost: !!me && stateRef.current.hostId === me.id,
    canControl: canControl(),
    driftRef,
    stats: {
      offset: () => offsetRef.current,
      rtt: () => rttRef.current,
      ctrl: () => ctrlLatency.current,
      ping: () => pingLatency.current,
      subscribe: (l: () => void) => {
        statsListeners.current.add(l);
        return () => statsListeners.current.delete(l);
      },
    },
  };
}

function toggle(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
function addOnce(arr: string[], v: string) {
  return arr.includes(v) ? arr : [...arr, v];
}

export type RoomApi = ReturnType<typeof useRoom>;

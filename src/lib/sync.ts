// Pure synchronization math shared by the room engine. No I/O here so it can be unit-tested.

export type Playback = {
  videoId: string | null;
  playing: boolean;
  /** media position (seconds) at host-clock time `at` */
  position: number;
  /** host-clock epoch ms. For scheduled starts this can be in the future. */
  at: number;
  /** monotonically increasing control sequence number */
  seq: number;
  /** user id that issued the control (deterministic tie-break) */
  by: string;
};

export const SEEK_THRESHOLD = 0.5; // s — hard seek above this drift
export const NUDGE_THRESHOLD = 0.12; // s — rate nudge above this drift
export const NUDGE_RATE = 0.06; // ±6% playback rate while catching up

export function expectedPosition(pb: Playback, hostNow: number): number {
  if (!pb.playing) return pb.position;
  return pb.position + Math.max(0, hostNow - pb.at) / 1000;
}

export function shouldBePlaying(pb: Playback, hostNow: number): boolean {
  return pb.playing && hostNow >= pb.at;
}

/** True if `incoming` should replace `current` (last-writer-wins on seq, then lowest user id). */
export function isNewerPlayback(current: Playback, incoming: Playback): boolean {
  if (incoming.seq !== current.seq) return incoming.seq > current.seq;
  return incoming.by < current.by;
}

export type Correction =
  | { kind: "none"; rate: 1 }
  | { kind: "nudge"; rate: number }
  | { kind: "seek"; rate: 1; target: number };

/** drift = actual - expected. Positive means we are ahead. */
export function correctionFor(actual: number, expected: number): Correction {
  const drift = actual - expected;
  const abs = Math.abs(drift);
  if (abs >= SEEK_THRESHOLD) return { kind: "seek", rate: 1, target: expected };
  if (abs >= NUDGE_THRESHOLD)
    return { kind: "nudge", rate: drift > 0 ? 1 - NUDGE_RATE : 1 + NUDGE_RATE };
  return { kind: "none", rate: 1 };
}

export type HostClaim = { hostId: string; epoch: number };

export function acceptHostClaim(current: HostClaim, incoming: HostClaim): boolean {
  if (!current.hostId) return true;
  if (incoming.epoch !== current.epoch) return incoming.epoch > current.epoch;
  return incoming.hostId < current.hostId;
}

export type ElectableMember = { id: string; joinedAt: number };

/** Longest-present member becomes host; ties broken by id. */
export function electHost<T extends ElectableMember>(members: T[]): T | null {
  if (!members.length) return null;
  return (
    [...members].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0] ?? null
  );
}

export type ClockSample = { t0: number; th: number; t1: number };

/** NTP-style offset from the lowest-RTT sample. hostClock ≈ localClock + offset */
export function estimateClock(samples: ClockSample[]): { offset: number; rtt: number } | null {
  if (!samples.length) return null;
  let best = samples[0]!;
  for (const s of samples) if (s.t1 - s.t0 < best.t1 - best.t0) best = s;
  const rtt = best.t1 - best.t0;
  return { offset: best.th - (best.t0 + best.t1) / 2, rtt };
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

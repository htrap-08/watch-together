import { describe, expect, it } from "vitest";
import { acceptHostClaim, correctionFor, electHost, estimateClock, expectedPosition, isNewerPlayback, percentile, shouldBePlaying, type Playback } from "./sync";
import { fuzzyScore } from "./fuzzy";

const pb = (p: Partial<Playback>): Playback => ({ videoId: "x", playing: true, position: 10, at: 1000, seq: 1, by: "b", ...p });

describe("sync math", () => {
  it("advances expected position while playing", () => {
    expect(expectedPosition(pb({}), 3000)).toBeCloseTo(12);
    expect(expectedPosition(pb({ playing: false }), 3000)).toBe(10);
  });
  it("holds scheduled starts until their start time", () => {
    expect(shouldBePlaying(pb({ at: 5000 }), 4000)).toBe(false);
    expect(expectedPosition(pb({ at: 5000 }), 4000)).toBe(10);
  });
  it("resolves concurrent controls by seq then lowest user id", () => {
    expect(isNewerPlayback(pb({ seq: 2 }), pb({ seq: 3 }))).toBe(true);
    expect(isNewerPlayback(pb({ seq: 3, by: "b" }), pb({ seq: 3, by: "a" }))).toBe(true);
    expect(isNewerPlayback(pb({ seq: 3, by: "a" }), pb({ seq: 3, by: "b" }))).toBe(false);
  });
  it("seeks above 1s drift, nudges above 120ms, ignores below", () => {
    expect(correctionFor(12, 10).kind).toBe("seek");
    expect(correctionFor(10.3, 10)).toEqual({ kind: "nudge", rate: 0.94 });
    expect(correctionFor(9.7, 10)).toEqual({ kind: "nudge", rate: 1.06 });
    expect(correctionFor(10.05, 10).kind).toBe("none");
  });
  it("host claims: higher epoch wins, then lower id", () => {
    expect(acceptHostClaim({ hostId: "b", epoch: 1 }, { hostId: "c", epoch: 2 })).toBe(true);
    expect(acceptHostClaim({ hostId: "b", epoch: 1 }, { hostId: "a", epoch: 1 })).toBe(true);
    expect(acceptHostClaim({ hostId: "a", epoch: 2 }, { hostId: "b", epoch: 1 })).toBe(false);
  });
  it("elects the longest-present member", () => {
    expect(electHost([{ id: "z", joinedAt: 5 }, { id: "y", joinedAt: 2 }])?.id).toBe("y");
  });
  it("estimates clock offset from the lowest-RTT sample", () => {
    const c = estimateClock([{ t0: 0, th: 600, t1: 200 }, { t0: 1000, th: 1520, t1: 1040 }]);
    expect(c).toEqual({ offset: 500, rtt: 40 });
  });
  it("computes p95", () => {
    expect(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95)).toBe(95);
  });
});

describe("fuzzy search", () => {
  it("tolerates typos and partial words", () => {
    expect(fuzzyScore("sintle", ["Sintel"])).toBeGreaterThan(0);
    expect(fuzzyScore("bunn", ["Big Buck Bunny"])).toBeGreaterThan(0);
    expect(fuzzyScore("robot zebra", ["Tears of Steel robots"])).toBe(0);
  });
});

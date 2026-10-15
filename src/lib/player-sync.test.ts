import { describe, expect, it, vi } from "vitest";
import { syncPlayer } from "./player-sync";
import type { Playback } from "./sync";
const playback: Playback = {
  videoId: "fixture",
  position: 10,
  playing: false,
  at: 1000,
  seq: 1,
  by: "host",
};
it("corrects a paused player instead of nudging a clock that is not running", () => {
  const video = {
    currentTime: 10.8,
    readyState: 4,
    paused: true,
    seeking: true,
    playbackRate: 1,
  } as HTMLVideoElement;
  syncPlayer(video, playback, 1000);
  expect(video.currentTime).toBe(10);
});
describe("native-player observations", () => {
  it("does not mark a pending seek as an applied command", () => {
    const video = {
      currentTime: 10,
      readyState: 4,
      paused: true,
      seeking: true,
      playbackRate: 1,
    } as HTMLVideoElement;
    expect(syncPlayer(video, playback, 1000)?.applied).toBe(false);
  });
  it("applies pause before reporting the matching native state", () => {
    const video = {
      currentTime: 10,
      readyState: 4,
      paused: false,
      seeking: false,
      playbackRate: 1,
      pause: vi.fn(function (this: { paused: boolean }) {
        this.paused = true;
      }),
    } as unknown as HTMLVideoElement;
    expect(syncPlayer(video, playback, 1000)?.applied).toBe(true);
    expect(video.pause).toHaveBeenCalledOnce();
  });
});

import {
  correctionFor,
  expectedPosition,
  NUDGE_THRESHOLD,
  shouldBePlaying,
  type Playback,
} from "./sync";
/** Shared by the screening player and browser benchmark. Media stays in native video elements. */
export function syncPlayer(
  video: HTMLVideoElement,
  playback: Playback,
  now: number,
  onPlayError: (blocked: boolean) => void = () => {},
) {
  const expected = expectedPosition(playback, now);
  const playing = shouldBePlaying(playback, now);
  if (playing && video.paused)
    void video
      .play()
      .then(() => onPlayError(false))
      .catch(() => onPlayError(true));
  if (!playing && !video.paused) video.pause();
  if (video.readyState < 2) return;
  const correction = correctionFor(video.currentTime, expected);
  // A paused player cannot close drift by changing speed.
  if (!playing && Math.abs(video.currentTime - expected) >= NUDGE_THRESHOLD) {
    video.currentTime = expected;
    video.playbackRate = 1;
  } else {
    if (correction.kind === "seek") video.currentTime = correction.target;
    video.playbackRate = correction.rate;
  }
  return {
    sampleable: !video.seeking,
    actual: video.currentTime,
    expected,
    applied:
      !video.seeking && video.paused !== playing && Math.abs(video.currentTime - expected) < 0.5,
  };
}

import type { RoomState } from "./room-engine";
export type Review = { name: string; score: number; text: string; at: number };
export type FeatureEvent = {
  type: string;
  from: string;
  sentAt: number;
  name?: unknown;
  score?: unknown;
  text?: unknown;
  videoId?: unknown;
  pb?: unknown;
};
export function applyRoomFeature(s: RoomState, ev: FeatureEvent): boolean {
  if (ev.type === "break") {
    if (s.intermission || !s.playback.videoId || s.ended) return true;
    s.intermission = {
      by: ev.from,
      name: String(ev.name ?? "A friend").slice(0, 24),
      at: ev.sentAt,
    };
    s.playback = {
      ...s.playback,
      position: Math.max(
        0,
        s.playback.position +
          (s.playback.playing ? Math.max(0, ev.sentAt - s.playback.at) / 1000 : 0),
      ),
      playing: false,
      at: ev.sentAt,
      seq: s.playback.seq + 1,
      by: ev.from,
    };
    return true;
  }
  if (ev.type === "screening_start" && ev.from === s.hostId) {
    s.started = true;
    s.intermission = null;
    s.ended = false;
    return true;
  }
  if (ev.type === "film_end" && ev.from === s.hostId && ev.videoId === s.playback.videoId) {
    s.ended = true;
    s.playback.position += s.playback.playing ? Math.max(0, ev.sentAt - s.playback.at) / 1000 : 0;
    s.playback.at = ev.sentAt;
    s.playback.playing = false;
    s.intermission = null;
    return true;
  }
  if (
    ev.type === "review" &&
    s.ended &&
    ev.videoId === s.playback.videoId &&
    typeof ev.score === "number" &&
    Number.isInteger(ev.score) &&
    ev.score >= 1 &&
    ev.score <= 5
  ) {
    const video = String(ev.videoId);
    s.reviews[video] ??= {};
    s.reviews[video][ev.from] = {
      name: String(ev.name ?? "A friend").slice(0, 24),
      score: ev.score,
      text: String(ev.text ?? "").slice(0, 500),
      at: ev.sentAt,
    };
    return true;
  }
  return false;
}

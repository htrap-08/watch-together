import { describe, it, expect } from "vitest";
import { applyRoomFeature } from "./room-features";
import { emptyState } from "./room-engine";
describe("screening lifecycle", () => {
  it("a guest break pauses at the projected position and keeps the first requester", () => {
    const s = emptyState();
    s.playback = { videoId: "film", playing: true, position: 10, at: 1000, seq: 5, by: "host" };
    applyRoomFeature(s, { type: "break", from: "guest", name: "Guest", sentAt: 6000 });
    expect(s.playback.position).toBe(15);
    expect(s.playback.playing).toBe(false);
    expect(s.intermission?.name).toBe("Guest");
    applyRoomFeature(s, { type: "break", from: "another", name: "Other", sentAt: 9000 });
    expect(s.intermission?.name).toBe("Guest");
    expect(s.playback.seq).toBe(6);
  });
  it("only the host can start or finish the selected film, and spoilers cannot be reviewed early", () => {
    const s = emptyState();
    s.hostId = "host";
    s.playback.videoId = "film";
    applyRoomFeature(s, { type: "screening_start", from: "guest", sentAt: 1000 });
    expect(s.started).toBe(false);
    applyRoomFeature(s, { type: "review", from: "guest", sentAt: 1000, videoId: "film", score: 5 });
    expect(s.reviews).toEqual({});
    applyRoomFeature(s, { type: "screening_start", from: "host", sentAt: 1000 });
    expect(s.started).toBe(true);
    applyRoomFeature(s, { type: "film_end", from: "host", sentAt: 2000, videoId: "wrong" });
    expect(s.ended).toBe(false);
    applyRoomFeature(s, { type: "film_end", from: "host", sentAt: 2000, videoId: "film" });
    expect(s.ended).toBe(true);
    applyRoomFeature(s, {
      type: "review",
      from: "guest",
      name: "Guest",
      sentAt: 3000,
      videoId: "film",
      score: 4,
      text: "A favourite scene.",
    });
    expect(s.reviews["film"]?.["guest"]?.score).toBe(4);
  });
});

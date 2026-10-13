import test from "node:test";
import assert from "node:assert/strict";
import {
  serviceFor,
  relayUrl,
  parseSetup,
  cleanPageUrl,
  correction,
  expectedPosition,
} from "../core.js";

test("service identity honors hostname boundaries and falls back for generic sites", () => {
  assert.equal(serviceFor("https://www.netflix.com/watch/123").name, "Netflix");
  assert.equal(serviceFor("https://netflix.com.attacker.example/watch/123").name, "HTML5 video");
  assert.equal(serviceFor("https://www.amazon.in/gp/video/detail/123").name, "Prime Video");
  assert.equal(serviceFor("https://tv.apple.com/show/example").name, "Apple TV+");
});
test("share only canonical title pages, never session parameters", () => {
  assert.equal(
    cleanPageUrl("https://www.netflix.com/watch/123?token=private&tracking=1#debug"),
    "https://www.netflix.com/watch/123",
  );
  assert.equal(
    cleanPageUrl("https://www.youtube.com/watch?v=abc123&auth=private"),
    "https://www.youtube.com/watch?v=abc123",
  );
  assert.throws(() => cleanPageUrl("javascript:alert(1)"));
  assert.throws(() => cleanPageUrl("https://user:secret@example.com/video"));
});
test("setup codes include correct room and server and reject unsafe public relays", () => {
  const payload = {
    room: "ABC123",
    relay: "wss://relay.example.com/realtime",
    roomUrl: "https://watch.example.com/room/ABC123",
  };
  const setup = `wt1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  const config = parseSetup(setup);
  assert.equal(config.room, "ABC123");
  assert.equal(config.relay, payload.relay);
  assert.equal(config.roomUrl, "https://watch.example.com/room/ABC123?watch=stream");
  assert.equal(parseSetup("abc123").room, "ABC123");
  assert.equal(parseSetup("https://watch.example.com/room/abc123").room, "ABC123");
  assert.throws(() => parseSetup("BAD"));
  assert.throws(() => parseSetup("wt1.invalid"));
  assert.throws(() => relayUrl("ws://public.example.com"));
  assert.throws(() => relayUrl("wss://user:secret@example.com"));
  assert.throws(() => relayUrl("wss://relay.example.com?token=secret"));
  assert.equal(relayUrl("ws://192.168.1.2:3001"), "ws://192.168.1.2:3001/");
});
test("clock projection and drift correction handle playing, paused, and stale clocks", () => {
  assert.equal(expectedPosition({ position: 12, playing: true, at: 1000 }, 3500), 14.5);
  assert.equal(expectedPosition({ position: 12, playing: false, at: 1000 }, 3500), 12);
  assert.equal(expectedPosition({ position: 12, playing: true, at: 5000 }, 3500), 12);
  assert.deepEqual(correction(20, 14, true), { seek: 14, rate: 1 });
  assert.deepEqual(correction(14.4, 14, true), { seek: null, rate: 0.94 });
  assert.deepEqual(correction(13.6, 14, true), { seek: null, rate: 1.06 });
  assert.deepEqual(correction(14.4, 14, false), { seek: 14, rate: 1 });
});

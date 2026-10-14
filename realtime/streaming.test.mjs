import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createRealtimeServer } from "./server.mjs";

const waitFor = (ws, predicate) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", listener);
      reject(new Error("Message timeout"));
    }, 3000);
    const listener = (data) => {
      const m = JSON.parse(data.toString());
      if (predicate(m)) {
        clearTimeout(timer);
        ws.off("message", listener);
        resolve(m);
      }
    };
    ws.on("message", listener);
  });
async function fixture(t) {
  const { server, wss } = createRealtimeServer();
  const clients = [];
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    clients.forEach((ws) => ws.terminate());
    await new Promise((r) => wss.close(r));
    await new Promise((r) => server.close(r));
  });
  return async (key, room = "ABC123") => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}?room=${room}&key=${key}`);
    clients.push(ws);
    await once(ws, "open");
    return ws;
  };
}
const send = (ws, type, payload = {}) => ws.send(JSON.stringify({ type, payload }));
const join = async (ws, name, url = "https://www.netflix.com/watch/123?tracking=1") => {
  const snapshot = waitFor(
    ws,
    (m) => m.type === "stream_snapshot" && m.payload.members.some((x) => x.name === name),
  );
  send(ws, "stream_join", { name, url, service: "Netflix", title: "A movie" });
  return (await snapshot).payload;
};

test("late joiners receive authoritative playback; observers and guests cannot control", async (t) => {
  const connect = await fixture(t);
  const web = await connect("web");
  const host = await connect("host");
  const initial = waitFor(web, (m) => m.type === "stream_snapshot");
  send(web, "stream_watch");
  assert.equal((await initial).payload.hostId, "");
  assert.equal((await join(host, "Host")).hostId, "host");
  const control = waitFor(
    host,
    (m) => m.type === "stream_snapshot" && m.payload.playback.position === 42,
  );
  send(host, "stream_control", { position: 42, playing: true });
  const pb = (await control).payload.playback;
  const guest = await connect("guest");
  const incoming = await join(guest, "Guest");
  assert.equal(incoming.playback.position, 42);
  assert.equal(incoming.playback.playing, true);
  assert.equal(incoming.target.url, "https://www.netflix.com/watch/123");
  const extras = await Promise.all(Array.from({ length: 8 }, (_, i) => connect(`viewer${i}`)));
  const joined = await Promise.all(extras.map((ws, i) => join(ws, `Viewer ${i}`)));
  assert.equal(joined.at(-1).members.length, 10);
  for (const ws of [web, guest]) {
    const denied = waitFor(ws, (m) => m.type === "stream_error");
    send(ws, "stream_control", { position: 99, playing: false });
    assert.match((await denied).payload.reason, /Only the streaming host/);
  }
  const next = waitFor(
    guest,
    (m) => m.type === "stream_snapshot" && m.payload.playback.position === 15,
  );
  send(host, "stream_control", { position: 15, playing: false });
  const paused = (await next).payload.playback;
  assert.equal(paused.playing, false);
  assert.ok(paused.revision > pb.revision);
});

test("streaming and website chat share the room; host transfer, failover, and reconnect", async (t) => {
  const connect = await fixture(t);
  const host = await connect("host");
  const guest = await connect("guest");
  const web = await connect("web");
  await join(host, "Host");
  await join(guest, "Guest");
  send(web, "stream_watch");
  const delivered = waitFor(web, (m) => m.type === "broadcast" && m.payload.type === "chat");
  send(guest, "stream_chat", { text: "hello from Netflix" });
  assert.equal((await delivered).payload.msg.text, "hello from Netflix");
  const websiteChat = waitFor(
    guest,
    (m) => m.type === "broadcast" && m.payload.msg?.id === "site-chat",
  );
  send(web, "broadcast", {
    type: "chat",
    msg: {
      id: "site-chat",
      name: "Website viewer",
      text: "hello from the website",
      at: Date.now(),
    },
  });
  await websiteChat;
  const transfer = waitFor(
    guest,
    (m) => m.type === "stream_snapshot" && m.payload.hostId === "guest",
  );
  send(host, "stream_transfer", { to: "guest" });
  const transferred = (await transfer).payload;
  assert.equal(transferred.chat.length, 2);
  const restored = await connect("guest");
  const afterReconnect = await join(restored, "Guest");
  assert.equal(afterReconnect.hostId, "guest");
  assert.equal(afterReconnect.members.filter((m) => m.id === "guest").length, 1);
  const failover = waitFor(
    host,
    (m) => m.type === "stream_snapshot" && m.payload.hostId === "host",
  );
  restored.close();
  await failover;
});

test("mismatched titles, ad breaks, and malformed controls cannot move the shared timeline", async (t) => {
  const connect = await fixture(t);
  const host = await connect("host");
  const guest = await connect("guest");
  await join(host, "Host");
  await join(guest, "Guest", "https://www.netflix.com/watch/999");
  const mismatch = waitFor(host, (m) => m.type === "stream_error");
  send(host, "stream_transfer", { to: "guest" });
  assert.match((await mismatch).payload.reason, /same title/);
  const ad = waitFor(host, (m) => m.type === "stream_snapshot" && m.payload.members[0].ad);
  send(host, "stream_status", { ad: true, status: "Ad break" });
  await ad;
  const adDenied = waitFor(host, (m) => m.type === "stream_error");
  send(host, "stream_control", { position: 500, playing: true });
  assert.match((await adDenied).payload.reason, /advertisement/);
  const clear = waitFor(host, (m) => m.type === "stream_snapshot" && !m.payload.members[0].ad);
  send(host, "stream_status", { ad: false, status: "Playing" });
  await clear;
  const bad = waitFor(host, (m) => m.type === "stream_error");
  send(host, "stream_control", { position: -1, playing: true });
  assert.match((await bad).payload.reason, /Invalid/);
  // Numeric message types are harmless and must not crash the relay.
  send(host, 42, {});
  const good = waitFor(
    host,
    (m) => m.type === "stream_snapshot" && m.payload.playback.position === 9,
  );
  send(host, "stream_control", { position: 9, playing: false });
  await good;
});

test("separate rooms remain isolated and noisy clients are disconnected", async (t) => {
  const connect = await fixture(t);
  const first = await connect("first");
  const second = await connect("second", "XYZ789");
  await join(first, "First");
  assert.equal((await join(second, "Second")).hostId, "second");
  const noisy = await connect("noisy");
  const closed = once(noisy, "close");
  for (let i = 0; i < 65; i++) send(noisy, "stream_ping", { t0: Date.now() });
  assert.equal((await closed)[0], 1008);
});

test("new companions wait for readiness; intermission pauses all players and only the host resumes", async (t) => {
  const connect = await fixture(t);
  const host = await connect("ready-host");
  const guest = await connect("ready-guest");
  async function joinNew(ws, name) {
    const update = waitFor(
      ws,
      (m) => m.type === "stream_snapshot" && m.payload.members.some((x) => x.name === name),
    );
    send(ws, "stream_join", {
      name,
      url: "https://www.netflix.com/watch/321",
      service: "Netflix",
      features: 2,
    });
    return (await update).payload;
  }
  await joinNew(host, "Host");
  await joinNew(guest, "Guest");
  let update = waitFor(host, (m) => m.type === "stream_error");
  send(host, "stream_control", { position: 5, playing: true });
  assert.match((await update).payload.reason, /ready/);
  update = waitFor(
    guest,
    (m) => m.type === "stream_snapshot" && m.payload.members.every((x) => x.ready),
  );
  send(host, "stream_ready", { ready: true });
  send(guest, "stream_ready", { ready: true });
  await update;
  update = waitFor(guest, (m) => m.type === "stream_snapshot" && m.payload.playback.playing);
  send(host, "stream_control", { position: 5, playing: true });
  await update;
  update = waitFor(host, (m) => m.type === "stream_snapshot" && m.payload.intermission);
  send(guest, "stream_break");
  const paused = (await update).payload;
  assert.equal(paused.playback.playing, false);
  assert.equal(paused.intermission.name, "Guest");
  assert.equal(
    paused.members.some((x) => x.ready),
    false,
  );
  update = waitFor(host, (m) => m.type === "stream_error");
  send(host, "stream_resume");
  assert.match((await update).payload.reason, /ready/);
  update = waitFor(
    guest,
    (m) => m.type === "stream_snapshot" && m.payload.members.every((x) => x.ready),
  );
  send(host, "stream_ready", { ready: true });
  send(guest, "stream_ready", { ready: true });
  await update;
  update = waitFor(
    guest,
    (m) => m.type === "stream_snapshot" && !m.payload.intermission && m.payload.playback.playing,
  );
  send(host, "stream_resume");
  await update;
});

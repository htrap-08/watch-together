import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { createDistributedRelay } from "./distributed.mjs";

const waitFor = (ws, predicate) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", listener);
      reject(new Error("Room event timeout"));
    }, 15000);
    const listener = (data) => {
      const message = JSON.parse(data.toString());
      if (predicate(message)) {
        clearTimeout(timeout);
        ws.off("message", listener);
        resolve(message);
      }
    };
    ws.on("message", listener);
  });
const send = (ws, type, payload = {}) => ws.send(JSON.stringify({ type, payload }));
test(
  "independent relay instances share presence, host authority, playback, chat and failover",
  { skip: !process.env.REDIS_URL && !process.env.TEST_REALTIME_URL },
  async (t) => {
    const room = "test-" + randomUUID();
    const relays = process.env.TEST_REALTIME_URL
      ? []
      : [
          createDistributedRelay(process.env.REDIS_URL),
          createDistributedRelay(process.env.REDIS_URL),
        ];
    const servers = relays.map((relay) => {
      const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
      server.on("connection", (ws, req) =>
        relay.connect(ws, room, new URL(req.url, "http://test").searchParams.get("key")),
      );
      return server;
    });
    await Promise.all(servers.map((server) => once(server, "listening")));
    const clients = [];
    t.after(async () => {
      clients.forEach((ws) => ws.terminate());
      await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
      await Promise.all(relays.map((relay) => relay.close()));
    });
    async function connect(instance, key) {
      const endpoint = new URL(
        process.env.TEST_REALTIME_URL || `ws://127.0.0.1:${servers[instance].address().port}`,
      );
      endpoint.searchParams.set("room", room);
      endpoint.searchParams.set("key", key);
      const ws = new WebSocket(endpoint);
      clients.push(ws);
      await once(ws, "open");
      return ws;
    }
    const host = await connect(0, "host");
    let incoming = waitFor(
      host,
      (m) => m.type === "stream_snapshot" && m.payload.hostId === "host",
    );
    send(host, "stream_join", {
      name: "Host",
      url: "https://www.netflix.com/watch/123",
      service: "Netflix",
    });
    await incoming;
    const guest = await connect(1, "guest");
    incoming = waitFor(host, (m) => m.type === "stream_snapshot" && m.payload.members.length === 2);
    send(guest, "stream_join", {
      name: "Guest",
      url: "https://www.netflix.com/watch/123",
      service: "Netflix",
    });
    await incoming;
    incoming = waitFor(
      guest,
      (m) => m.type === "stream_snapshot" && m.payload.playback.position === 42,
    );
    send(host, "stream_control", { position: 42, playing: true });
    assert.equal((await incoming).payload.hostId, "host");
    incoming = waitFor(guest, (m) => m.type === "stream_error");
    send(guest, "stream_control", { position: 100, playing: false });
    assert.match((await incoming).payload.reason, /Only.*host/);
    incoming = waitFor(host, (m) => m.type === "broadcast" && m.payload.msg?.text === "hello");
    send(guest, "stream_chat", { text: "hello" });
    await incoming;
    incoming = waitFor(guest, (m) => m.type === "sync" && m.state.host);
    send(host, "track", { name: "Host" });
    await incoming;
    incoming = waitFor(guest, (m) => m.type === "stream_snapshot" && m.payload.hostId === "guest");
    const breakUpdate = waitFor(
      guest,
      (m) => m.type === "stream_snapshot" && m.payload.intermission,
    );
    send(guest, "stream_break");
    assert.equal((await breakUpdate).payload.playback.playing, false);
    const readyUpdate = waitFor(
      guest,
      (m) => m.type === "stream_snapshot" && m.payload.members.every((member) => member.ready),
    );
    send(host, "stream_ready", { ready: true });
    send(guest, "stream_ready", { ready: true });
    await readyUpdate;
    const resumed = waitFor(
      guest,
      (m) => m.type === "stream_snapshot" && !m.payload.intermission && m.payload.playback.playing,
    );
    send(host, "stream_resume");
    await resumed;
    host.close();
    assert.equal((await incoming).payload.members.length, 1);
  },
);

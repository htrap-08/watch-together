import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createRealtimeServer } from "./server.mjs";

const waitFor = (ws, predicate) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Message timeout"));
    }, 3000);
    const listener = (data) => {
      const message = JSON.parse(data.toString());
      if (predicate(message)) {
        cleanup();
        resolve(message);
      }
    };
    function cleanup() {
      clearTimeout(timeout);
      ws.off("message", listener);
    }
    ws.on("message", listener);
  });

test("ten participants, room isolation, leave, reconnect and restored membership", async (t) => {
  const { server, wss } = createRealtimeServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const sockets = [];
  t.after(async () => {
    for (const ws of sockets) ws.terminate();
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });
  const connect = async (room, key) => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}?room=${room}&key=${key}`);
    sockets.push(ws);
    await once(ws, "open");
    return ws;
  };
  const clients = await Promise.all(
    Array.from({ length: 10 }, (_, i) => connect("party", `user${i}`)),
  );
  const allPresent = waitFor(
    clients[0],
    (m) => m.type === "sync" && Object.keys(m.state).length === 10,
  );
  clients.forEach((ws, i) =>
    ws.send(
      JSON.stringify({
        type: "track",
        payload: { id: `user${i}`, name: `User ${i}`, joinedAt: i },
      }),
    ),
  );
  await allPresent;
  const other = await connect("other", "outsider");
  const unwanted = [];
  other.on("message", (data) => {
    if (JSON.parse(data.toString()).type === "broadcast") unwanted.push(data);
  });
  const senderEvents = [];
  clients[0].on("message", (data) => {
    if (JSON.parse(data.toString()).type === "broadcast") senderEvents.push(data);
  });
  const delivery = clients.slice(1).map((ws) => waitFor(ws, (m) => m.type === "broadcast"));
  clients[0].send(
    JSON.stringify({ type: "broadcast", payload: { type: "play", from: "spoofed", position: 12 } }),
  );
  for (const message of await Promise.all(delivery)) {
    assert.equal(message.payload.from, "user0");
    assert.equal(message.payload.position, 12);
  }
  assert.equal(unwanted.length, 0);
  assert.equal(senderEvents.length, 0);
  const left = waitFor(clients[0], (m) => m.type === "leave");
  const ninePresent = waitFor(
    clients[0],
    (m) => m.type === "sync" && Object.keys(m.state).length === 9,
  );
  clients[9].close();
  assert.equal((await left).leftPresences[0].id, "user9");
  await ninePresent;
  const returning = await connect("party", "user9");
  const restored = waitFor(
    clients[0],
    (m) => m.type === "sync" && Object.keys(m.state).length === 10,
  );
  returning.send(JSON.stringify({ type: "track", payload: { name: "Returning", joinedAt: 9 } }));
  await restored;
  const lateState = waitFor(
    returning,
    (m) => m.type === "broadcast" && m.payload.type === "sync_state",
  );
  clients[0].send(
    JSON.stringify({
      type: "broadcast",
      payload: { type: "sync_state", to: "user9", state: { position: 12 } },
    }),
  );
  assert.equal((await lateState).payload.state.position, 12);
});

test("configured origin restriction rejects unapproved origins", async (t) => {
  const { server, wss } = createRealtimeServer({ origins: ["https://watch.example.com"] });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}?room=party&key=user`, {
    origin: "https://other.example.com",
  });
  const [error] = await once(ws, "error");
  assert.match(error.message, /403/);
});

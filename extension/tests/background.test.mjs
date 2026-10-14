import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createRealtimeServer } from "../../realtime/server.mjs";
const eventually = async (fn) => {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Condition timed out");
};

test("worker connects, applies remote controls to the selected frame, shares chat, and restores a session", async (t) => {
  const { server, wss } = createRealtimeServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const sessionStore = {},
    localStore = {};
  const calls = [],
    handlers = [];
  const storage = (store) => ({
    get: async (key) => ({ [key]: store[key] }),
    set: async (obj) => Object.assign(store, obj),
    remove: async (key) => {
      delete store[key];
    },
  });
  const tab = {
    id: 12,
    url: "https://video.example.com/watch/film?tracking=private",
    title: "A film",
  };
  globalThis.chrome = {
    runtime: {
      id: "test-extension",
      getManifest: () => ({ version: "0.2.0" }),
      onMessage: { addListener: (fn) => handlers.push(fn) },
      onStartup: { addListener: () => {} },
    },
    storage: { session: storage(sessionStore), local: storage(localStore) },
    tabs: {
      get: async () => tab,
      sendMessage: async (id, message, options) => {
        calls.push({ id, message, options });
        return { ok: true };
      },
      update: async () => {},
      onRemoved: { addListener: () => {} },
      onUpdated: { addListener: () => {} },
    },
    permissions: { contains: async () => true },
    action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
    scripting: {
      unregisterContentScripts: async () => {},
      registerContentScripts: async (scripts) => {
        calls.push({ scripts });
      },
      executeScript: async (options) => {
        calls.push({ inject: options });
      },
    },
  };
  globalThis.WebSocket = WebSocket;
  await import(`../background.js?test=${Date.now()}`);
  const sender = { id: "test-extension" };
  let handler = handlers.at(-1);
  const request = (type, payload, from = sender) =>
    new Promise((resolve) => handler({ type, payload }, from, resolve));
  const website = {
    id: "test-extension",
    tab: { id: 55 },
    url: "https://watch-together-lyart.vercel.app/room/ABC123",
  };
  const token =
    "wt1." +
    Buffer.from(
      JSON.stringify({
        room: "ABC123",
        relay: "wss://watch-together-lyart.vercel.app/api/realtime",
        roomUrl: website.url,
      }),
    ).toString("base64url");
  assert.equal((await request("WT_SITE_HELLO", {}, website)).result.version, "0.2.0");
  assert.equal(
    (await request("WT_SITE_PREPARE", { setup: token, name: "Guest" }, website)).ok,
    true,
  );
  assert.equal(sessionStore.pendingSetup.setup, token);
  assert.equal(
    (
      await request(
        "WT_SITE_PREPARE",
        { setup: token, name: "Guest" },
        { ...website, url: "https://evil.example/room/ABC123" },
      )
    ).ok,
    false,
  );
  const relay = `ws://127.0.0.1:${server.address().port}`;
  const host = new WebSocket(`${relay}?room=ABC123&key=external-host`);
  await once(host, "open");
  host.send(
    JSON.stringify({
      type: "stream_join",
      payload: {
        name: "Original host",
        service: "HTML5 video",
        url: "https://video.example.com/watch/film",
        title: "A film",
      },
    }),
  );
  await new Promise((r) => setTimeout(r, 20));
  t.after(async () => {
    await request("WT_DISCONNECT");
    host.terminate();
    for (const ws of wss.clients) ws.terminate();
    await new Promise((r) => wss.close(r));
    await new Promise((r) => server.close(r));
    delete globalThis.chrome;
    delete globalThis.WebSocket;
  });
  const result = await request("WT_CONNECT", {
    setup: "ABC123",
    relay,
    roomUrl: "http://localhost:3000",
    name: "Guest",
    tabId: 12,
  });
  assert.equal(result.ok, true);
  assert.equal(
    (await request("WT_READY", { ready: true })).ok,
    false,
    "A missing player cannot be marked ready",
  );
  await eventually(async () => (await request("WT_STATUS")).result.snapshot?.members.length === 2);
  assert.deepEqual(calls.find((c) => c.scripts)?.scripts[0].matches, [
    "https://video.example.com/*",
  ]);
  await request(
    "WT_REPORT",
    {
      position: 0,
      playing: false,
      ready: true,
      seeking: false,
      ended: false,
      score: 250000,
      ad: false,
    },
    { id: "test-extension", tab: { id: 12 }, frameId: 7 },
  );

  assert.equal((await request("WT_READY", { ready: true })).ok, true);
  host.send(JSON.stringify({ type: "stream_control", payload: { position: 42, playing: false } }));
  await eventually(() =>
    calls.some(
      (c) =>
        c.message?.type === "WT_APPLY" &&
        c.message.payload.position === 42 &&
        c.options.frameId === 7,
    ),
  );
  await request("WT_CHAT", { text: "hello from popup" });
  await eventually(async () =>
    (await request("WT_STATUS")).result.snapshot?.chat.some((m) => m.text === "hello from popup"),
  );
  assert.equal(
    (await request("WT_CONNECT", {}, { id: "test-extension", tab: { id: 99 } })).ok,
    false,
    "Content pages cannot attach arbitrary tabs",
  );
  const beforeTakeover = calls.filter((c) => c.message?.type === "WT_APPLY").length;
  host.close();
  await eventually(async () => {
    const current = (await request("WT_STATUS")).result;
    return current.snapshot?.hostId === current.session?.id;
  });
  assert.ok(
    calls.filter((c) => c.message?.type === "WT_APPLY").length > beforeTakeover,
    "The new host must first align to the inherited timeline",
  );
  const saved = structuredClone(sessionStore.watchTogether);
  await request("WT_DISCONNECT");
  sessionStore.watchTogether = saved;
  await import(`../background.js?restore=${Date.now()}`);
  handler = handlers.at(-1);
  await eventually(async () => (await request("WT_STATUS")).result.connection === "Connected");
  assert.equal((await request("WT_STATUS")).result.session.id, saved.id);
  assert.equal(
    (await request("WT_STATUS")).result.session.url,
    "https://video.example.com/watch/film",
  );
});

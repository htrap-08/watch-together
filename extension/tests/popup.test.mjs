import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import { parseSetup, relayUrl, serviceFor } from "../core.js";
const html = await readFile(new URL("../popup.html", import.meta.url), "utf8");
const source = (await readFile(new URL("../popup.js", import.meta.url), "utf8")).replace(
  /^import .*;\n/,
  "",
);
const flush = () => new Promise((r) => setImmediate(r));
async function setup(t, granted, pendingSetup = undefined) {
  const dom = new JSDOM(html, {
    url: "https://extension.example/popup",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const requests = [],
    permissions = [];
  const { window } = dom;
  Object.assign(window, { parseSetup, relayUrl, serviceFor });
  window.setInterval = () => 1;
  window.chrome = {
    tabs: {
      query: async () => [
        { id: 1, url: "https://www.crunchyroll.com/watch/abc", title: "Episode" },
      ],
    },
    scripting: {
      executeScript: async () => [
        { result: ["https://static.crunchyroll.com/player", "https://ads.example.com/frame"] },
      ],
    },
    permissions: {
      request: async (input) => {
        permissions.push(input);
        return granted;
      },
    },
    storage: {
      session: { get: async () => ({ pendingSetup }) },
      local: { get: async () => ({ nickname: "Viewer" }), set: async () => {} },
    },
    runtime: {
      sendMessage: async (message) => {
        requests.push(message);
        return { ok: true, result: { session: null } };
      },
    },
  };
  await window.eval(`(async () => { ${source} })()`);
  return { window, requests, permissions };
}
test("popup decodes setup and requests only the video site, recognized player frames, and relay", async (t) => {
  const { window, requests, permissions } = await setup(t, true);
  const code = `wt1.${Buffer.from(JSON.stringify({ room: "ABC123", relay: "wss://relay.example.com", roomUrl: "https://watch.example.com" })).toString("base64url")}`;
  window.document.querySelector("#setup-code").value = code;
  window.document
    .querySelector("#connect-form")
    .dispatchEvent(new window.Event("submit", { cancelable: true }));
  await flush();
  assert.deepEqual(
    JSON.parse(JSON.stringify(permissions[0].origins)).sort(),
    [
      "https://www.crunchyroll.com/*",
      "https://static.crunchyroll.com/*",
      "https://relay.example.com/*",
    ].sort(),
  );
  const connect = requests.find((m) => m.type === "WT_CONNECT");
  assert.equal(connect.payload.tabId, 1);
  assert.equal(connect.payload.relay, "wss://relay.example.com/");
  assert.ok(!connect.payload.playerOrigins.includes("https://relay.example.com/*"));
});
test("permission refusal leaves the extension disconnected with a visible error", async (t) => {
  const { window, requests } = await setup(t, false);
  window.document.querySelector("#setup-code").value = "ABC123";
  window.document
    .querySelector("#connect-form")
    .dispatchEvent(new window.Event("submit", { cancelable: true }));
  await flush();
  assert.equal(
    requests.some((m) => m.type === "WT_CONNECT"),
    false,
  );
  assert.match(window.document.querySelector("#error").textContent, /permission/);
  assert.equal(window.document.querySelector("#error").hidden, false);
});

test("website handoff prefills the room and nickname without requesting video access", async (t) => {
  const { window, permissions } = await setup(t, true, {
    setup: "ABC123",
    name: "From the room",
    at: Date.now(),
  });
  assert.equal(window.document.getElementById("setup-code").value, "ABC123");
  assert.equal(window.document.getElementById("nickname").value, "From the room");
  assert.equal(permissions.length, 0);
});

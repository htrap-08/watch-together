import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const source = await readFile(new URL("../site-bridge.js", import.meta.url), "utf8");
test("website bridge forwards only supported same-window messages and preserves the request nonce", async (t) => {
  const dom = new JSDOM("<body></body>", {
    url: "https://watch-together-lyart.vercel.app/room/ABC123",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const calls = [],
    replies = [];
  dom.window.chrome = {
    runtime: {
      sendMessage: async (message) => {
        calls.push(message);
        return { ok: true, result: { version: "0.2.0" } };
      },
    },
  };
  dom.window.postMessage = (message, origin) => replies.push({ message, origin });
  dom.window.eval(source);
  const event = (data) =>
    new dom.window.MessageEvent("message", {
      source: dom.window,
      origin: dom.window.location.origin,
      data,
    });
  dom.window.dispatchEvent(
    event({ source: "WT_SITE", nonce: "n1", action: "prepare", setup: "wt1.test", name: "Guest" }),
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, "WT_SITE_PREPARE");
  assert.equal(replies[0].message.nonce, "n1");
  dom.window.dispatchEvent(event({ source: "WT_SITE", nonce: "n2", action: "executeScript" }));
  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      source: dom.window,
      origin: "https://evil.example",
      data: { source: "WT_SITE", nonce: "n3", action: "prepare" },
    }),
  );
  assert.equal(calls.length, 1);
});

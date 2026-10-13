import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { JSDOM } from "jsdom";
const source = await readFile(new URL("../content.js", import.meta.url), "utf8");
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function setup(t, { shadow = false, ad = false } = {}) {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", {
    url: "https://video.example.com/watch/film",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const root = shadow
    ? window.document.querySelector("#root").attachShadow({ mode: "open" })
    : window.document;
  const video = window.document.createElement("video");
  if (shadow) root.append(video);
  else window.document.body.append(video);
  let paused = true;
  Object.defineProperties(video, {
    readyState: { get: () => 4 },
    paused: { get: () => paused },
    duration: { get: () => 600 },
    ended: { get: () => false },
    seekable: { get: () => ({ length: 1 }) },
  });
  video.play = async () => {
    paused = false;
    video.dispatchEvent(new window.Event("play"));
  };
  video.pause = () => {
    paused = true;
    video.dispatchEvent(new window.Event("pause"));
  };
  video.getBoundingClientRect = () => ({ width: 640, height: 360 });
  window.crypto.randomUUID = randomUUID;
  const reports = [];
  let listener;
  let tick;
  window.setInterval = (fn) => {
    tick = fn;
    return 1;
  };
  window.chrome = {
    runtime: {
      sendMessage: async (message) => {
        if (message.type === "WT_HELLO")
          return {
            ok: true,
            result: { active: true, service: { name: "HTML5 video", ads: [".ad"] } },
          };
        if (message.type === "WT_REPORT") reports.push(message.payload);
        return { ok: true };
      },
      onMessage: {
        addListener: (fn) => {
          listener = fn;
        },
      },
    },
  };
  if (ad) {
    const marker = window.document.createElement("div");
    marker.className = "ad";
    marker.getBoundingClientRect = () => ({ width: 50, height: 20 });
    window.document.body.append(marker);
  }
  window.eval(source);
  await flush();
  const apply = (payload) =>
    new Promise((resolve) => listener({ type: "WT_APPLY", payload }, {}, resolve));
  return { video, apply, reports, tick, window, listener };
}
test("generic adapter discovers a real video and follows play, pause, seek, and revision ordering", async (t) => {
  const { video, apply, reports } = await setup(t);
  assert.equal(reports[0].score, 230400);
  await apply({ position: 42, playing: true, revision: 3 });
  assert.equal(video.currentTime, 42);
  assert.equal(video.paused, false);
  await apply({ position: 12, playing: false, revision: 4 });
  assert.equal(video.currentTime, 12);
  assert.equal(video.paused, true);
  await apply({ position: 99, playing: true, revision: 2 });
  assert.equal(video.currentTime, 12);
  assert.equal(video.paused, true);
  assert.equal(reports.length, 1, "Remote events must not echo back as local controls");
});
test("open shadow-root players are discoverable and small drift is corrected gradually", async (t) => {
  const { video, apply, reports } = await setup(t, { shadow: true });
  video.currentTime = 40.4;
  await apply({ position: 40, playing: true, revision: 1 });
  assert.ok(reports[0].score > 0);
  assert.equal(video.currentTime, 40.4);
  assert.equal(video.playbackRate, 0.94);
});
test("ads suspend remote controls and disconnect resets local playback rate", async (t) => {
  const { video, apply, reports, listener } = await setup(t, { ad: true });
  video.currentTime = 10;
  await apply({ position: 50, playing: true, revision: 1 });
  assert.equal(reports[0].ad, true);
  assert.equal(video.currentTime, 10);
  assert.equal(video.paused, true);
  video.playbackRate = 0.94;
  listener({ type: "WT_STOP" }, {}, () => {});
  assert.equal(video.playbackRate, 1);
});

test("service API can synchronize playback without an accessible video element", async (t) => {
  const dom = new JSDOM("<!doctype html>", {
    url: "https://www.netflix.com/watch/123",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  let position = 10,
    playing = false,
    listener;
  const reports = [];
  window.crypto.randomUUID = randomUUID;
  window.setInterval = () => 1;
  window.addEventListener("wt-player-request", (event) => {
    const d = event.detail;
    if (d.op === "apply") {
      if (d.seek != null) position = d.seek;
      playing = d.playing;
    }
    window.dispatchEvent(
      new window.CustomEvent("wt-player-result", {
        detail: { nonce: d.nonce, result: { position, playing, duration: 600 } },
      }),
    );
  });
  window.chrome = {
    runtime: {
      sendMessage: async (message) => {
        if (message.type === "WT_HELLO")
          return { ok: true, result: { active: true, service: { name: "Netflix", ads: [] } } };
        reports.push(message.payload);
        return { ok: true };
      },
      onMessage: {
        addListener: (fn) => {
          listener = fn;
        },
      },
    },
  };
  window.eval(source);
  await flush();
  assert.equal(reports[0].ready, true);
  assert.equal(reports[0].score, 180000);
  await new Promise((resolve) =>
    listener(
      { type: "WT_APPLY", payload: { position: 42, playing: true, revision: 2 } },
      {},
      resolve,
    ),
  );
  assert.equal(position, 42);
  assert.equal(playing, true);
});

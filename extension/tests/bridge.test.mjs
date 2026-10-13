import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../bridge.js", import.meta.url), "utf8");
function request(window, op, extra = {}) {
  let result;
  const receive = (event) => {
    result = event.detail.result;
  };
  window.addEventListener("wt-player-result", receive);
  window.dispatchEvent(
    new window.CustomEvent("wt-player-request", { detail: { nonce: "test", op, ...extra } }),
  );
  window.removeEventListener("wt-player-result", receive);
  return result;
}
test("Netflix adapter converts milliseconds and ignores preview sessions", (t) => {
  const dom = new JSDOM("<!doctype html>", {
    url: "https://www.netflix.com/watch/123",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  let time = 12000,
    paused = true;
  const player = {
    getCurrentTime: () => time,
    getDuration: () => 600000,
    isPaused: () => paused,
    seek: (value) => {
      time = value;
    },
    play: () => {
      paused = false;
    },
    pause: () => {
      paused = true;
    },
  };
  dom.window.netflix = {
    appContext: {
      state: {
        playerApp: {
          getAPI: () => ({
            videoPlayer: {
              getAllPlayerSessionIds: () => ["preview-1", "movie-1"],
              getVideoPlayerBySessionId: (id) => {
                assert.equal(id, "movie-1");
                return player;
              },
            },
          }),
        },
      },
    },
  };
  dom.window.eval(source);
  assert.deepEqual(JSON.parse(JSON.stringify(request(dom.window, "read"))), {
    position: 12,
    playing: false,
    duration: 600,
  });
  request(dom.window, "apply", { seek: 42.5, playing: true });
  assert.equal(time, 42500);
  assert.equal(paused, false);
  request(dom.window, "apply", { seek: null, playing: false });
  assert.equal(paused, true);
});
test("YouTube adapter uses the existing page player's controls; missing APIs safely fall back", (t) => {
  const dom = new JSDOM("<!doctype html><div id='movie_player'></div>", {
    url: "https://www.youtube.com/watch?v=abc",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const p = dom.window.document.querySelector("#movie_player");
  let time = 5,
    state = 2;
  Object.assign(p, {
    getCurrentTime: () => time,
    getDuration: () => 600,
    getPlayerState: () => state,
    seekTo: (value) => {
      time = value;
    },
    playVideo: () => {
      state = 1;
    },
    pauseVideo: () => {
      state = 2;
    },
  });
  dom.window.eval(source);
  request(dom.window, "apply", { seek: 30, playing: true });
  assert.equal(time, 30);
  assert.equal(state, 1);
  p.remove();
  assert.equal(request(dom.window, "read"), null);
});

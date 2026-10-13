(() => {
  if (window.__watchTogetherContent) {
    window.__watchTogetherContent.rescan();
    return;
  }
  let active = false,
    service = null,
    player = null,
    revision = -1,
    applyingUntil = 0,
    blocked = "";
  let lastSample = null,
    lastReportAt = 0,
    reporting = false,
    reportQueued = false;
  const pending = new Map();
  const bridge = (op, data = {}) =>
    new Promise((resolve) => {
      const nonce = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(nonce);
        resolve(null);
      }, 150);
      pending.set(nonce, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      window.dispatchEvent(
        new CustomEvent("wt-player-request", { detail: { nonce, op, ...data } }),
      );
    });
  window.addEventListener("wt-player-result", (event) => {
    const response = event.detail;
    const done = pending.get(response?.nonce);
    if (done) {
      pending.delete(response.nonce);
      done(response.result);
    }
  });
  const message = (type, payload) =>
    chrome.runtime.sendMessage({ type, payload }).catch(() => {
      active = false;
    });
  function videos(root = document, result = []) {
    for (const el of root.querySelectorAll("video")) result.push(el);
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) videos(el.shadowRoot, result);
    return result;
  }
  function score(video) {
    const rect = video.getBoundingClientRect();
    const style = getComputedStyle(video);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      rect.width < 80 ||
      rect.height < 45
    )
      return 0;
    const preferred = (service?.selectors ?? [])
      .filter((selector) => selector !== "video")
      .some((selector) => video.matches(selector));
    return rect.width * rect.height + (!video.paused ? 100000 : 0) + (preferred ? 50000 : 0);
  }
  function adPlaying() {
    return (service?.ads ?? []).some((selector) =>
      [...document.querySelectorAll(selector)].some((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      }),
    );
  }
  async function report(fast = false) {
    if (!active) return;
    if (reporting) {
      if (!fast) reportQueued = true;
      return;
    }
    reporting = true;
    try {
      const chosen = fast ? player : videos().sort((a, b) => score(b) - score(a))[0];
      if (chosen !== player) {
        if (player)
          for (const event of ["play", "pause", "seeked"])
            player.removeEventListener(event, changed);
        player = chosen;
        blocked = "";
        revision = -1;
        if (player)
          for (const event of ["play", "pause", "seeked"]) player.addEventListener(event, changed);
      }
      const api = ["Netflix", "YouTube"].includes(service?.name) ? await bridge("read") : null;
      if (!active) return;
      const apiReady = Number.isFinite(api?.position);
      const position = apiReady
        ? api.position
        : Number.isFinite(player?.currentTime)
          ? player.currentTime
          : 0;
      const playing = api?.playing ?? (!!player && !player.paused && !player.ended);
      const now = Date.now();
      if (fast && lastSample && now - lastReportAt < 2000) {
        const expected =
          lastSample.position + (lastSample.playing ? (now - lastSample.at) / 1000 : 0);
        if (lastSample.playing === playing && Math.abs(position - expected) < 0.5) return;
      }
      lastSample = { position, playing, at: now };
      lastReportAt = now;
      await message("WT_REPORT", {
        position,
        playing,
        ready: !api?.buffering && (player ? player.readyState >= 2 : apiReady),
        seeking: !!player?.seeking,
        ended:
          player?.ended ??
          (!!apiReady &&
            Number.isFinite(api.duration) &&
            api.duration > 0 &&
            position >= api.duration - 0.05),
        score: player ? score(player) : apiReady ? 180000 : 0,
        ad: adPlaying(),
        blocked,
      });
    } finally {
      reporting = false;
      if (reportQueued) {
        reportQueued = false;
        void report();
      }
    }
  }
  function changed() {
    // Remote changes must not echo back into a host command or overwrite a pending seek.
    if (Date.now() >= applyingUntil) {
      blocked = "";
      void report();
    }
  }
  async function apply(d) {
    if (!active || adPlaying() || !Number.isFinite(d.position) || d.revision < revision) return;
    const api = ["Netflix", "YouTube"].includes(service?.name) ? await bridge("read") : null;
    if ((!player && !Number.isFinite(api?.position)) || (player && player.readyState < 2)) return;
    revision = d.revision;
    const current = Number.isFinite(api?.position) ? api.position : player.currentTime;
    const drift = current - d.position;
    const shouldSeek = Math.abs(drift) > (d.playing ? (player ? 1 : 0.5) : 0.15);
    const duration = player?.duration ?? api?.duration;
    const target = Number.isFinite(duration)
      ? Math.max(0, Math.min(d.position, duration - 0.05))
      : d.position;
    const seekable = !!api || (!!player && player.seekable.length > 0);
    applyingUntil = Date.now() + 1000;
    const bridged = api
      ? await bridge("apply", { seek: shouldSeek && seekable ? target : null, playing: d.playing })
      : null;
    try {
      if (!bridged) {
        if (!player) {
          blocked = "Service player controls unavailable — find player again";
          return;
        }
        if (shouldSeek && seekable) player.currentTime = target;
        if (d.playing && player.paused) await player.play();
        else if (!d.playing && !player.paused) player.pause();
      }
      if (player)
        player.playbackRate =
          !d.playing || shouldSeek || Math.abs(drift) < 0.15 ? 1 : drift > 0 ? 0.94 : 1.06;
      blocked =
        shouldSeek && !seekable ? "Live or non-seekable video — position sync unavailable" : "";
    } catch {
      blocked = "Press play once on this site to enable playback";
    }
  }
  async function rescan() {
    const response = await message("WT_HELLO");
    if (response?.ok && response.result?.active) {
      active = true;
      service = response.result.service;
      await report();
    } else active = false;
  }
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg.type === "WT_APPLY") {
      void apply(msg.payload).then(() => respond({ ok: true }));
      return true;
    }
    if (msg.type === "WT_STOP") {
      active = false;
      if (player) player.playbackRate = 1;
      respond({ ok: true });
    }
  });
  window.__watchTogetherContent = { rescan };
  setInterval(() => {
    void report();
  }, 2000);
  setInterval(() => {
    if (
      active &&
      !player &&
      ["Netflix", "YouTube"].includes(service?.name) &&
      Date.now() >= applyingUntil
    )
      void report(true);
  }, 250);
  void rescan();
})();

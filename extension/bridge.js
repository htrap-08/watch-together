// Player API access runs in the page's MAIN world. No credentials or room data enter this bridge.
(() => {
  if (window.__watchTogetherBridge) return;
  window.__watchTogetherBridge = true;
  function playerApi() {
    if (location.hostname.endsWith("netflix.com")) {
      try {
        const api = window.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer;
        const sessions = api?.getAllPlayerSessionIds?.() ?? [];
        const id = sessions.find((s) => !String(s).includes("preview")) ?? sessions[0];
        const p = id && api.getVideoPlayerBySessionId(id);
        if (p?.getCurrentTime && p?.seek && p?.play && p?.pause)
          return {
            read: () => ({
              position: p.getCurrentTime() / 1000,
              playing: !p.isPaused(),
              duration: p.getDuration?.() / 1000,
            }),
            apply: (d) => {
              if (d.seek != null) p.seek(Math.round(d.seek * 1000));
              if (d.playing) p.play();
              else p.pause();
            },
          };
      } catch {
        /* Fall back to the normal HTML video when the service API changes. */
      }
    }
    if (location.hostname.endsWith("youtube.com")) {
      const p = document.getElementById("movie_player");
      if (p?.getCurrentTime && p?.seekTo && p?.playVideo)
        return {
          read: () => ({
            position: p.getCurrentTime(),
            playing: [1, 3].includes(p.getPlayerState()),
            duration: p.getDuration(),
          }),
          apply: (d) => {
            if (d.seek != null) p.seekTo(d.seek, true);
            if (d.playing) p.playVideo();
            else p.pauseVideo();
          },
        };
    }
    return null;
  }
  window.addEventListener("wt-player-request", (event) => {
    const d = event.detail;
    if (!d || typeof d.nonce !== "string" || !["read", "apply"].includes(d.op)) return;
    let result = null;
    try {
      const api = playerApi();
      if (api) {
        if (
          d.op === "apply" &&
          typeof d.playing === "boolean" &&
          (d.seek == null || (Number.isFinite(d.seek) && d.seek >= 0))
        )
          api.apply(d);
        result = api.read();
      }
    } catch {
      /* A changing or unavailable player is reported as a DOM fallback. */
    }
    window.dispatchEvent(
      new CustomEvent("wt-player-result", { detail: { nonce: d.nonce, result } }),
    );
  });
})();

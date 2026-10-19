/** Validate locally; never proxy arbitrary viewer URLs through the server. */
export function directVideoUrl(value: string, secure = location.protocol === "https:") {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a complete HTTP or HTTPS video link.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Use a public HTTP or HTTPS video link without login credentials.");
  if (secure && url.protocol !== "https:")
    throw new Error(
      "Use an HTTPS video link. Your browser blocks HTTP videos on this secure site.",
    );
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    [
      "youtube.com",
      "youtu.be",
      "netflix.com",
      "primevideo.com",
      "disneyplus.com",
      "hotstar.com",
      "jiohotstar.com",
      "vimeo.com",
    ].some((site) => host === site || host.endsWith(`.${site}`))
  )
    throw new Error(
      "That is a streaming-service page. Use Share a tab or Streaming sync above. Video links need the media file itself, such as an MP4 or WebM.",
    );
  return url.href;
}

export function videoLoadError(code?: number) {
  if (code === 3)
    return "Your browser cannot decode this video. Try an MP4 with H.264 video and AAC audio, or a WebM file.";
  if (code === 2)
    return "The video download failed. Check your connection and whether the host allows playback from other sites.";
  return "This link did not open as a playable video. Use a public MP4 or WebM file link, not a webpage, cloud preview, or a link requiring sign-in. The host must allow playback from other sites.";
}

export function checkDirectVideo(url: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const finish = (error?: Error) => {
      clearTimeout(timer);
      video.onloadeddata = null;
      video.onerror = null;
      signal.removeEventListener("abort", abort);
      video.removeAttribute("src");
      video.load();
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new Error("Video check cancelled."));
    if (signal.aborted) {
      reject(new Error("Video check cancelled."));
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    video.preload = "auto";
    video.muted = true;
    video.onloadeddata = () => finish();
    video.onerror = () => finish(new Error(videoLoadError(video.error?.code)));
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "The video did not respond within 15 seconds. Check the link opens as a video without signing in, then try again.",
          ),
        ),
      15000,
    );
    video.src = url;
    video.load();
  });
}

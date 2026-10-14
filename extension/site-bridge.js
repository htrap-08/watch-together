// A narrow handshake on Watch Together's own room pages. No video-site commands
// or arbitrary script execution are exposed to the web page.
window.addEventListener("message", async (event) => {
  if (
    event.source !== window ||
    event.origin !== location.origin ||
    event.data?.source !== "WT_SITE"
  )
    return;
  const { nonce, action, setup, name } = event.data;
  if (typeof nonce !== "string" || nonce.length > 80 || !["hello", "prepare"].includes(action))
    return;
  try {
    const response = await chrome.runtime.sendMessage({
      type: action === "hello" ? "WT_SITE_HELLO" : "WT_SITE_PREPARE",
      payload: { setup, name },
    });
    window.postMessage(
      {
        source: "WT_EXTENSION",
        nonce,
        ok: !!response?.ok,
        result: response?.result,
        error: response?.error,
      },
      location.origin,
    );
  } catch {
    window.postMessage(
      {
        source: "WT_EXTENSION",
        nonce,
        ok: false,
        error: "Reload the extension and this room page.",
      },
      location.origin,
    );
  }
});

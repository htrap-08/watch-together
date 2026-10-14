export function extensionMessage(
  action: "hello" | "prepare",
  payload: { setup?: string; name?: string } = {},
): Promise<{ version?: string }> {
  return new Promise((resolve, reject) => {
    const nonce = crypto.randomUUID();
    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        event.data?.source !== "WT_EXTENSION" ||
        event.data.nonce !== nonce
      )
        return;
      cleanup();
      if (event.data.ok) resolve(event.data.result ?? {});
      else reject(new Error(event.data.error || "Extension unavailable."));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Install or reload extension v0.2, then refresh this room."));
    }, 1500);
    window.addEventListener("message", receive);
    window.postMessage({ source: "WT_SITE", nonce, action, ...payload }, location.origin);
  });
}

import { parseSetup, relayUrl, serviceFor } from "./core.js";
const $ = (id) => document.getElementById(id);
let state = null;
const request = async (type, payload) => {
  const response = await chrome.runtime.sendMessage({ type, payload });
  if (!response?.ok)
    throw new Error(response?.error ?? "The extension is unavailable. Reload it and try again.");
  return response.result;
};
const error = (message) => {
  $("error").textContent = message;
  $("error").hidden = !message;
};
const action = (fn) => async (event) => {
  event?.preventDefault();
  error("");
  try {
    await fn(event);
  } catch (e) {
    error(e.message);
  }
};
const text = (tag, value) => {
  const el = document.createElement(tag);
  el.textContent = value;
  return el;
};
function render(next) {
  state = next;
  $("setup").hidden = !!next.session;
  $("connected").hidden = !next.session;
  if (!next.session) return;
  const { session, snapshot, connection } = next;
  const host = snapshot?.hostId === session.id;
  const viewer = snapshot?.members.find((member) => member.id === session.id);
  $("viewer-ready").textContent = viewer?.ready ? "Ready ✓ · undo" : "I’m ready";
  $("break-status").textContent = snapshot?.intermission
    ? "Intermission — " + snapshot.intermission.name
    : "Mark ready after opening the host’s title.";
  $("resume-screening").hidden = !host || !snapshot?.intermission;

  $("connection").textContent = connection;
  $("role").textContent = host ? "HOST" : "VIEWER";
  $("title").textContent = snapshot?.target?.title ?? "Connecting to your room…";
  $("status").textContent = next.status || "Open a video on this site and press play once.";
  $("room-code").textContent = `ROOM ${session.room}`;
  $("service").textContent = session.service.name;
  $("open-host").hidden = !snapshot?.target || snapshot.target.url === session.url;
  $("members").replaceChildren();
  for (const member of snapshot?.members ?? []) {
    const row = document.createElement("div");
    row.className = "member";
    row.append(
      text(
        "span",
        `${member.name}${member.id === session.id ? " (you)" : ""}${member.id === snapshot.hostId ? " · host" : ""}`,
      ),
    );
    if (host && member.id !== session.id) {
      const button = text("button", "Pass host");
      button.addEventListener(
        "click",
        action(() => request("WT_TRANSFER", { to: member.id })),
      );
      row.append(button);
    }
    $("members").append(row);
  }
  const messages = $("messages");
  const atEnd = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 30;
  messages.replaceChildren();
  for (const message of snapshot?.chat ?? []) {
    const row = document.createElement("p");
    row.append(text("b", message.name), text("span", message.text));
    messages.append(row);
  }
  if (atEnd) messages.scrollTop = messages.scrollHeight;
  $("chat-form").querySelector("button").disabled = connection !== "Connected";
}
$("connect-form").addEventListener(
  "submit",
  action(async () => {
    $("connect").disabled = true;
    try {
      const config = parseSetup(
        $("setup-code").value.trim(),
        $("relay").value.trim(),
        $("room-site").value.trim(),
      );
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !/^https?:\/\//.test(tab.url))
        throw new Error("Open the streaming video in a normal browser tab first.");
      const backend = new URL(relayUrl(config.relay));
      backend.protocol = backend.protocol === "wss:" ? "https:" : "http:";
      const service = serviceFor(tab.url);
      let embedded = [];
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => [...document.querySelectorAll("iframe[src]")].map((frame) => frame.src),
        });
        embedded = (results[0]?.result ?? [])
          .filter((url) => {
            try {
              return serviceFor(url).name !== "HTML5 video";
            } catch {
              return false;
            }
          })
          .map((url) => `${new URL(url).origin}/*`);
      } catch {
        /* The top-level origin still works when frame discovery is unavailable. */
      }
      const playerOrigins = [
        ...new Set([`${new URL(tab.url).origin}/*`, ...(service.frameOrigins ?? []), ...embedded]),
      ];
      const origins = [...new Set([...playerOrigins, `${backend.origin}/*`])];
      const granted = await chrome.permissions.request({ origins });
      if (!granted) throw new Error("Site permission is needed to control this video's playback.");
      const next = await request("WT_CONNECT", {
        setup: $("setup-code").value.trim(),
        relay: config.relay,
        roomUrl: config.roomUrl,
        name: $("nickname").value,
        tabId: tab.id,
        playerOrigins,
      });
      await chrome.storage.local.set({ nickname: $("nickname").value.trim() });
      render(next);
    } finally {
      $("connect").disabled = false;
    }
  }),
);
$("disconnect").addEventListener(
  "click",
  action(async () => render(await request("WT_DISCONNECT"))),
);
$("open-host").addEventListener(
  "click",
  action(() => request("WT_OPEN_HOST")),
);
$("rescan").addEventListener(
  "click",
  action(() => request("WT_RESCAN")),
);
$("open-room").addEventListener(
  "click",
  action(() => chrome.tabs.create({ url: state.session.roomUrl })),
);
$("chat-form").addEventListener(
  "submit",
  action(async () => {
    await request("WT_CHAT", { text: $("chat").value });
    $("chat").value = "";
  }),
);
const pending = (await chrome.storage.session.get("pendingSetup")).pendingSetup;
if (pending && Date.now() - pending.at < 3600000) {
  $("setup-code").value = pending.setup;
  $("nickname").value = pending.name;
}
const stored = await chrome.storage.local.get("nickname");
$("nickname").value = $("nickname").value || stored.nickname || "";
try {
  render(await request("WT_STATUS"));
} catch (e) {
  error(e.message);
}
setInterval(() => {
  void request("WT_STATUS")
    .then(render)
    .catch((e) => error(e.message));
}, 1000);

$("viewer-ready").addEventListener(
  "click",
  action(() =>
    request("WT_READY", {
      ready: !state.snapshot?.members.find((member) => member.id === state.session?.id)?.ready,
    }),
  ),
);
$("take-break").addEventListener(
  "click",
  action(() => request("WT_BREAK")),
);
$("resume-screening").addEventListener(
  "click",
  action(() => request("WT_RESUME")),
);

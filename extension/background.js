import { serviceFor, cleanPageUrl, parseSetup, expectedPosition, relayUrl } from "./core.js";

let session = null;
let socket = null;
let snapshot = null;
let reports = new Map();
let leader = 0;
let reconnectTimer, heartbeat;
let generation = 0;
let reconnectDelay = 500;
let lastStatus = "",
  lastMedia = "",
  lastAd = false;
let offset = 0;
let bestRtt = Infinity;
let connection = "Disconnected";
let restoring;

const write = (type, payload = {}) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, payload }));
};
const save = () => chrome.storage.session.set({ watchTogether: session });
const view = () => ({ session, snapshot, connection, status: lastStatus, frame: leader, offset });
const badge = () => {
  chrome.action.setBadgeText({
    text: !session
      ? ""
      : connection !== "Connected"
        ? "…"
        : snapshot?.hostId === session.id
          ? "H"
          : "•",
  });
  chrome.action.setBadgeBackgroundColor({ color: "#34474b" });
};
async function restore() {
  if (session) return;
  if (!restoring)
    restoring = (async () => {
      const stored = (await chrome.storage.session.get("watchTogether")).watchTogether;
      if (!stored) return;
      try {
        await chrome.tabs.get(stored.tabId);
        session = stored;
        connect();
      } catch {
        await chrome.storage.session.remove("watchTogether");
      }
    })().finally(() => {
      restoring = null;
    });
  await restoring;
}
async function sendToPlayer(type, payload) {
  if (!session) return;
  try {
    return await chrome.tabs.sendMessage(session.tabId, { type, payload }, { frameId: leader });
  } catch {
    return null;
  }
}
function updateStatus(status, ad = false) {
  if (status === lastStatus && ad === lastAd) return;
  lastStatus = status;
  lastAd = ad;
  write("stream_status", { status, ad });
}
function apply(takingHost = false) {
  if (!session || !snapshot?.target) return;
  const report = reports.get(leader);
  if (!report?.score) return;
  const mine = snapshot.members.find((m) => m.id === session.id);
  const host = snapshot.members.find((m) => m.id === snapshot.hostId);
  if (mine?.url !== snapshot.target.url) {
    updateStatus("Different title — open the host's video");
    return;
  }
  if (report.ad || host?.ad) {
    updateStatus("Waiting for advertisements to finish", !!report.ad);
    return;
  }
  if (snapshot.hostId === session.id && !takingHost && !snapshot.intermission) return;
  void sendToPlayer("WT_APPLY", {
    position: expectedPosition(snapshot.playback, Date.now() + offset),
    playing: snapshot.playback.playing,
    revision: snapshot.playback.revision,
  });
}
function connect() {
  if (!session) return;
  clearTimeout(reconnectTimer);
  clearInterval(heartbeat);
  const run = ++generation;
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  const url = new URL(relayUrl(session.relay));
  url.searchParams.set("room", session.room);
  url.searchParams.set("key", session.id);
  const ws = new WebSocket(url);
  socket = ws;
  connection = "Connecting";
  badge();
  ws.onopen = () => {
    if (run !== generation || !session) return;
    connection = "Connected";
    reconnectDelay = 500;
    lastStatus = "";
    bestRtt = Infinity;
    write("stream_join", {
      name: session.name,
      url: session.url,
      service: session.service.name,
      title: session.title,
      features: 2,
    });
    write("stream_ping", { t0: Date.now() });
    heartbeat = setInterval(() => {
      write("stream_ping", { t0: Date.now() });
      apply();
    }, 10000);
    badge();
  };
  ws.onmessage = (event) => {
    if (run !== generation) return;
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.type === "stream_snapshot") {
      const previousHost = snapshot?.hostId;
      const previousBreak = snapshot?.intermission;
      snapshot = msg.payload;
      apply(
        !!snapshot.intermission ||
          !!previousBreak ||
          (!!previousHost && previousHost !== session?.id && snapshot.hostId === session?.id),
      );
      badge();
    }
    if (msg.type === "stream_pong") {
      const rtt = Date.now() - msg.payload.t0;
      if (rtt >= 0 && rtt < bestRtt) {
        bestRtt = rtt;
        offset = msg.payload.serverTime - (msg.payload.t0 + Date.now()) / 2;
      }
    }
    if (msg.type === "stream_error") {
      updateStatus(msg.payload.reason);
      apply(true);
    }
    if (msg.type === "broadcast" && msg.payload?.type === "chat" && snapshot) {
      const chat = msg.payload.msg;
      if (
        chat &&
        typeof chat.id === "string" &&
        typeof chat.text === "string" &&
        !snapshot.chat.some((m) => m.id === chat.id)
      )
        snapshot.chat = [...snapshot.chat, chat].slice(-150);
    }
  };
  ws.onerror = () => ws.close();
  ws.onclose = (event) => {
    if (run !== generation || !session) return;
    clearInterval(heartbeat);
    if (event.code === 4000) {
      void disconnect();
      return;
    }
    connection = "Reconnecting";
    badge();
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 15000);
  };
}
async function inject(tabId, url) {
  const target = { tabId, allFrames: true };
  try {
    await chrome.scripting.executeScript({ target, world: "MAIN", files: ["bridge.js"] });
    await chrome.scripting.executeScript({ target, files: ["content.js"] });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      files: ["bridge.js"],
    });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}
async function attach(input) {
  const config = parseSetup(input.setup, input.relay, input.roomUrl);
  const name = String(input.name ?? "")
    .trim()
    .slice(0, 24);
  if (!name) throw new Error("Choose a nickname first.");
  const tab = await chrome.tabs.get(input.tabId);
  const url = cleanPageUrl(tab.url);
  await disconnect();
  const requestedOrigins = Array.isArray(input.playerOrigins)
    ? input.playerOrigins
    : [`${new URL(url).origin}/*`];
  const playerOrigins = [];
  for (const origin of requestedOrigins) {
    if (
      typeof origin === "string" &&
      /^https?:\/\//.test(origin) &&
      (await chrome.permissions.contains({ origins: [origin] }))
    )
      playerOrigins.push(origin);
  }
  if (!playerOrigins.length) throw new Error("Site permission is required to attach this tab.");
  const stored = await chrome.storage.local.get("extensionViewerId");
  const id = stored.extensionViewerId ?? `ext-${crypto.randomUUID()}`;
  await chrome.storage.local.set({ extensionViewerId: id });
  session = {
    ...config,
    name,
    id,
    tabId: tab.id,
    url,
    service: serviceFor(url),
    title: String(tab.title ?? "Streaming video").slice(0, 160),
    playerOrigins,
  };
  snapshot = null;
  reports = new Map();
  leader = 0;
  await save();
  try {
    await chrome.scripting
      .unregisterContentScripts({ ids: ["watch-together-player"] })
      .catch(() => {});
    await chrome.scripting.registerContentScripts([
      {
        id: "watch-together-player",
        matches: playerOrigins,
        js: ["content.js"],
        allFrames: true,
        runAt: "document_idle",
        persistAcrossSessions: false,
      },
    ]);
    await inject(tab.id, url);
    connect();
  } catch (error) {
    await disconnect();
    throw new Error(`Could not attach to this tab: ${error.message}`);
  }
  return view();
}
async function disconnect() {
  const previous = session;
  ++generation;
  clearTimeout(reconnectTimer);
  clearInterval(heartbeat);
  write("stream_leave");
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  session = null;
  snapshot = null;
  reports.clear();
  connection = "Disconnected";
  lastStatus = "";
  lastMedia = "";
  await chrome.storage.session.remove("watchTogether");
  await chrome.scripting
    .unregisterContentScripts({ ids: ["watch-together-player"] })
    .catch(() => {});
  if (previous) await chrome.tabs.sendMessage(previous.tabId, { type: "WT_STOP" }).catch(() => {});
  badge();
}
async function reportPlayback(message, sender) {
  if (!session || sender.tab?.id !== session.tabId) return;
  const frameId = sender.frameId ?? 0;
  const report = message.payload;
  if (!Number.isFinite(report.score) || !Number.isFinite(report.position)) return;
  reports.set(frameId, { ...report, received: Date.now() });
  const ranked = [...reports.entries()]
    .filter(([, r]) => Date.now() - r.received < 6000)
    .sort((a, b) => b[1].score - a[1].score);
  leader = ranked[0]?.[0] ?? 0;
  if (frameId !== leader) return;
  const tab = await chrome.tabs.get(session.tabId);
  const url = cleanPageUrl(tab.url);
  const service = serviceFor(url);
  const media = `${url}|${tab.title}`;
  if (media !== lastMedia) {
    session.url = url;
    session.title = String(tab.title ?? "Streaming video").slice(0, 160);
    session.service = service;
    lastMedia = media;
    await save();
    write("stream_media", { url, title: session.title, service: service.name });
  }
  if (!report.score) {
    updateStatus("Player not detected — open a video and press play");
    return;
  }
  if (report.ad) {
    updateStatus("Advertisement — sync temporarily suspended", true);
    return;
  }
  if (report.blocked) {
    updateStatus(report.blocked);
    return;
  }
  if (snapshot?.target && snapshot.target.url !== url) {
    updateStatus("Different title — open the host's video");
    return;
  }
  if (!report.ready) {
    updateStatus("Buffering — waiting for the player");
    if (snapshot?.hostId === session.id)
      write("stream_control", { position: report.position, playing: false });
    return;
  }
  updateStatus(snapshot?.hostId === session.id ? "Hosting playback" : "Following host");
  if (snapshot?.hostId === session.id && !report.seeking && report.ready) {
    write("stream_control", {
      position: report.position,
      playing: report.ended ? false : report.playing,
    });
  } else apply();
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (typeof message?.type !== "string" || !message.type.startsWith("WT_")) return;
  const extensionPage = sender.id === chrome.runtime.id && !sender.tab;
  (async () => {
    await restore();
    if (message.type === "WT_SITE_HELLO" || message.type === "WT_SITE_PREPARE") {
      const source = new URL(sender.url ?? "about:blank");
      const allowed =
        source.origin === "https://watch-together-lyart.vercel.app" ||
        (["localhost", "127.0.0.1"].includes(source.hostname) && source.protocol === "http:");
      if (!sender.tab || !allowed || !/^\/room\/[a-zA-Z0-9]{6}$/.test(source.pathname))
        throw new Error("This request must come from a Watch Together room.");
      if (message.type === "WT_SITE_HELLO")
        return { version: chrome.runtime.getManifest().version };
      const pending = message.payload;
      const config = parseSetup(pending.setup);
      if (
        new URL(config.roomUrl).origin !== source.origin ||
        config.room !== source.pathname.split("/")[2].toUpperCase()
      )
        throw new Error("Room details do not match this page.");
      const relay = new URL(config.relay);
      if (relay.hostname !== source.hostname)
        throw new Error("Use the room server for this website.");
      await chrome.storage.session.set({
        pendingSetup: {
          setup: String(pending.setup).slice(0, 3000),
          name: String(pending.name ?? "").slice(0, 24),
          at: Date.now(),
        },
      });
      return { version: chrome.runtime.getManifest().version };
    }
    if (message.type === "WT_HELLO" && sender.tab?.id === session?.tabId) {
      const frameService = serviceFor(sender.url ?? session.url);
      if (["Netflix", "YouTube"].includes(frameService.name))
        await chrome.scripting
          .executeScript({
            target: { tabId: session.tabId, frameIds: [sender.frameId ?? 0] },
            world: "MAIN",
            files: ["bridge.js"],
          })
          .catch(() => {});
      return { service: frameService, active: true };
    }
    if (message.type === "WT_REPORT") {
      await reportPlayback(message, sender);
      return { ok: true };
    }
    if (!extensionPage) throw new Error("This action is only available in the extension popup.");
    if (message.type === "WT_CONNECT") {
      const result = await attach(message.payload);
      await chrome.storage.session.remove("pendingSetup");
      return result;
    }
    if (message.type === "WT_STATUS") return view();
    if (message.type === "WT_DISCONNECT") {
      await disconnect();
      return view();
    }
    if (message.type === "WT_READY") {
      write("stream_ready", { ready: !!message.payload.ready });
      return { ok: true };
    }
    if (message.type === "WT_BREAK") {
      write("stream_break", {});
      return { ok: true };
    }
    if (message.type === "WT_RESUME") {
      write("stream_resume", {});
      return { ok: true };
    }
    if (message.type === "WT_CHAT") {
      write("stream_chat", { text: String(message.payload.text ?? "").slice(0, 500) });
      return { ok: true };
    }
    if (message.type === "WT_TRANSFER") {
      write("stream_transfer", { to: message.payload.to });
      return { ok: true };
    }
    if (message.type === "WT_OPEN_HOST") {
      if (!snapshot?.target) throw new Error("No streaming host is connected yet.");
      const url = cleanPageUrl(snapshot.target.url);
      // Navigate only after an explicit click in the extension popup.
      await chrome.tabs.update(session.tabId, { url });
      return { ok: true };
    }
    if (message.type === "WT_RESCAN") {
      reports.clear();
      await inject(session.tabId, session.url);
      return { ok: true };
    }
    throw new Error("Unknown extension action.");
  })()
    .then((result) => respond({ ok: true, result }))
    .catch((error) => respond({ ok: false, error: error.message }));
  return true;
});
chrome.tabs.onRemoved.addListener((id) => {
  if (session?.tabId === id) void disconnect();
});
chrome.tabs.onUpdated.addListener((id, change) => {
  if (session?.tabId !== id) return;
  if (change.url) {
    try {
      session.url = cleanPageUrl(change.url);
      session.service = serviceFor(session.url);
      reports.clear();
      void save();
    } catch {
      void disconnect();
    }
  }
  if (change.status === "complete")
    void inject(id, session.url).catch(() =>
      updateStatus("Site permission needed — reconnect from the extension popup"),
    );
});
chrome.runtime.onStartup.addListener(() => {
  void restore();
});
void restore();

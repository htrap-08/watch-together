import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { createStreamingRooms } from "./streaming.mjs";

export function createRealtimeServer({ origins = [] } = {}) {
  const rooms = new Map();
  const server = createServer((request, response) => {
    response.writeHead(request.url === "/health" ? 200 : 404, {
      "content-type": "application/json",
    });
    response.end(JSON.stringify({ ok: request.url === "/health" }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, "http://localhost");
    const room = url.searchParams.get("room") ?? "";
    const key = url.searchParams.get("key") ?? "";
    const origin = request.headers.origin;
    if (
      !/^[a-zA-Z0-9_-]{1,64}$/.test(room) ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(key) ||
      (origins.length && !origins.includes(origin))
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, { room, key }));
  });
  const send = (ws, message) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };
  const broadcast = (members, message, except) => {
    for (const member of members) if (member !== except) send(member, message);
  };
  const streaming = createStreamingRooms({
    send,
    broadcast: (code, message) => broadcast(rooms.get(code) ?? [], message),
  });
  const sync = (members) => {
    const state = Object.create(null);
    for (const member of members) {
      if (member.presence) (state[member.key] ??= []).push(member.presence);
    }
    broadcast(members, { type: "sync", state });
  };
  wss.on("connection", (ws, { room, key }) => {
    const members = rooms.get(room) ?? new Set();
    rooms.set(room, members);
    members.add(ws);
    ws.key = key;
    ws.room = room;
    ws.messageCount = 0;
    ws.messageWindow = Date.now();
    ws.alive = true;
    ws.on("pong", () => {
      ws.alive = true;
    });
    ws.on("error", () => ws.terminate());
    ws.on("message", (data) => {
      if (Date.now() - ws.messageWindow > 1000) {
        ws.messageWindow = Date.now();
        ws.messageCount = 0;
      }
      if (++ws.messageCount > 60) {
        ws.close(1008, "Message rate exceeded");
        return;
      }
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (
        !message ||
        typeof message.payload !== "object" ||
        !message.payload ||
        Array.isArray(message.payload)
      )
        return;
      if (streaming.handle(ws, message)) return;
      if (message.type === "track") {
        const joining = !ws.presence;
        ws.presence = {
          ...message.payload,
          id: key,
          presence_ref: ws.presence?.presence_ref ?? randomUUID(),
        };
        if (joining) broadcast(members, { type: "join", newPresences: [ws.presence] });
        sync(members);
      } else if (message.type === "broadcast") {
        if (message.payload.type === "chat") streaming.captureChat(room, message.payload.msg);
        broadcast(members, { type: "broadcast", payload: { ...message.payload, from: key } }, ws);
      }
    });
    ws.on("close", () => {
      members.delete(ws);
      streaming.remove(ws);
      if (ws.presence) broadcast(members, { type: "leave", leftPresences: [ws.presence] });
      sync(members);
      if (!members.size) rooms.delete(room);
    });
    sync(members);
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, 15000);
  heartbeat.unref();
  server.on("close", () => clearInterval(heartbeat));
  return { server, wss };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origins = (process.env.REALTIME_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const { server, wss } = createRealtimeServer({ origins });
  server.listen(Number(process.env.REALTIME_PORT ?? 3001), "0.0.0.0", () => {
    console.log(`Watch Together realtime listening on port ${server.address().port}`);
  });
  const shutdown = () => {
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    server.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

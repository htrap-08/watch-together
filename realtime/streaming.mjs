import { randomUUID } from "node:crypto";

// Authoritative streaming playback is separate from the site's sample-video player.
export function createStreamingRooms({ broadcast, send, now = Date.now }) {
  const rooms = new Map();
  const roomFor = (code) => {
    if (!rooms.has(code))
      rooms.set(code, {
        intermission: null,
        started: false,
        hostId: "",
        target: null,
        playback: { position: 0, playing: false, at: now(), revision: 0 },
        members: new Map(),
        observers: new Set(),
        chat: [],
      });
    return rooms.get(code);
  };
  const expected = (pb) => pb.position + (pb.playing ? Math.max(0, now() - pb.at) / 1000 : 0);
  const snapshot = (room) => ({
    intermission: room.intermission,
    hostId: room.hostId,
    target: room.target,
    playback: room.playback,
    members: [...room.members.values()].map(({ socket, ...member }) => member),
    chat: room.chat,
    serverTime: now(),
  });
  const notify = (code, room) =>
    broadcast(code, { type: "stream_snapshot", payload: snapshot(room) });
  const error = (ws, reason) => send(ws, { type: "stream_error", payload: { reason } });
  function targetFor(payload) {
    try {
      const url = new URL(payload.url);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
      url.hash = "";
      const video = url.searchParams.get("v");
      url.search = "";
      if (
        (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") &&
        video &&
        /^[a-zA-Z0-9_-]{1,64}$/.test(video)
      )
        url.searchParams.set("v", video);
      return {
        service: String(payload.service ?? "Video site").slice(0, 60),
        url: url.href,
        title: String(payload.title ?? "Streaming video").slice(0, 160),
        key: url.href,
      };
    } catch {
      return null;
    }
  }
  function handle(ws, message) {
    if (typeof message.type !== "string" || !message.type.startsWith("stream_")) return false;
    const p = message.payload;
    if (message.type === "stream_ping") {
      send(ws, { type: "stream_pong", payload: { t0: p.t0, serverTime: now() } });
      return true;
    }
    const room = ["stream_watch", "stream_join"].includes(message.type)
      ? roomFor(ws.room)
      : rooms.get(ws.room);
    if (!room) return true;
    if (message.type === "stream_watch") {
      room.observers.add(ws);
      send(ws, { type: "stream_snapshot", payload: snapshot(room) });
    } else if (message.type === "stream_join") {
      const target = targetFor(p);
      if (!target || !String(p.name ?? "").trim()) {
        error(ws, "Invalid streaming setup");
        return true;
      }
      // Replace a stale connection with the same extension identity on reconnect.
      const prior = room.members.get(ws.key);
      if (prior && prior.socket !== ws) prior.socket.close(4000, "Reconnected elsewhere");
      room.members.set(ws.key, {
        socket: ws,
        id: ws.key,
        name: String(p.name).trim().slice(0, 24),
        service: target.service,
        url: target.url,
        joinedAt: prior?.joinedAt ?? now(),
        status: "Looking for player",
        ad: false,
        ready: p.features !== 2,
      });
      if (!room.hostId || !room.members.has(room.hostId)) {
        room.hostId = ws.key;
        room.target = target;
        room.intermission = null;
        room.playback = {
          position: 0,
          playing: false,
          at: now(),
          revision: room.playback.revision + 1,
        };
      }
      notify(ws.room, room);
    } else if (message.type === "stream_leave") {
      remove(ws);
    } else if (message.type === "stream_ready") {
      const member = room.members.get(ws.key);
      if (!member || member.socket !== ws) return true;
      member.ready = !!p.ready && member.url === room.target?.url && !member.ad;
      notify(ws.room, room);
    } else if (message.type === "stream_break") {
      if (room.intermission || (!room.members.has(ws.key) && !room.observers.has(ws))) return true;
      room.intermission = {
        by: ws.key,
        name: room.members.get(ws.key)?.name ?? String(p.name ?? "A friend").slice(0, 24),
        at: now(),
      };
      room.playback = {
        ...room.playback,
        position: expected(room.playback),
        playing: false,
        at: now(),
        revision: room.playback.revision + 1,
      };
      for (const member of room.members.values()) member.ready = false;
      notify(ws.room, room);
    } else if (message.type === "stream_resume") {
      if (ws.key !== room.hostId || room.members.get(ws.key)?.socket !== ws) return true;
      if (
        [...room.members.values()].some(
          (member) => !member.ready || member.url !== room.target?.url || member.ad,
        )
      ) {
        error(ws, "Wait until everyone marks ready on the same title.");
        return true;
      }
      room.intermission = null;
      room.started = true;
      room.playback = {
        ...room.playback,
        playing: true,
        at: now(),
        revision: room.playback.revision + 1,
      };
      notify(ws.room, room);
    } else if (message.type === "stream_control") {
      const member = room.members.get(ws.key);
      if (!member || member.socket !== ws || room.hostId !== ws.key) {
        error(ws, "Only the streaming host can control playback");
        return true;
      }
      if (member.url !== room.target?.url) {
        error(ws, "Open the selected title before controlling playback");
        return true;
      }
      if (member.ad) {
        error(ws, "Playback updates are suspended during an advertisement");
        return true;
      }
      if (
        !Number.isFinite(p.position) ||
        p.position < 0 ||
        p.position > 604800 ||
        typeof p.playing !== "boolean"
      ) {
        error(ws, "Invalid playback state");
        return true;
      }
      if (room.intermission) {
        if (p.playing) error(ws, "Use Resume in the extension after everyone is ready.");
        return true;
      }
      if (
        p.playing &&
        !room.started &&
        [...room.members.values()].some(
          (member) => !member.ready || member.url !== room.target?.url || member.ad,
        )
      ) {
        error(ws, "Wait until everyone marks ready on the same title.");
        return true;
      }
      if (p.playing) room.started = true;
      room.playback = {
        position: p.position,
        playing: p.playing,
        at: now(),
        revision: room.playback.revision + 1,
      };
      notify(ws.room, room);
    } else if (message.type === "stream_media") {
      const member = room.members.get(ws.key);
      const target = targetFor(p);
      if (!member || member.socket !== ws || !target) return true;
      member.service = target.service;
      if (member.url !== target.url) member.ready = false;
      member.url = target.url;
      if (ws.key === room.hostId && target.key !== room.target?.key) {
        room.intermission = null;
        room.started = false;
        for (const viewer of room.members.values()) viewer.ready = false;
        room.target = target;
        room.playback = {
          position: 0,
          playing: false,
          at: now(),
          revision: room.playback.revision + 1,
        };
      } else if (ws.key === room.hostId) {
        room.target = target;
      }
      notify(ws.room, room);
    } else if (message.type === "stream_status") {
      const member = room.members.get(ws.key);
      if (!member || member.socket !== ws) return true;
      member.status = String(p.status ?? "Connected").slice(0, 100);
      member.ad = !!p.ad;
      if (member.ad) member.ready = false;
      notify(ws.room, room);
    } else if (message.type === "stream_transfer") {
      if (
        ws.key !== room.hostId ||
        room.members.get(ws.key)?.socket !== ws ||
        !room.members.has(p.to)
      ) {
        error(ws, "Host transfer is unavailable");
        return true;
      }
      const next = room.members.get(p.to);
      if (next.url !== room.target?.url) {
        error(ws, "The next host must open the same title first");
        return true;
      }
      room.playback = {
        ...room.playback,
        position: expected(room.playback),
        at: now(),
        revision: room.playback.revision + 1,
      };
      room.hostId = p.to;
      notify(ws.room, room);
    } else if (message.type === "stream_chat") {
      const member = room.members.get(ws.key);
      if (!member || member.socket !== ws || typeof p.text !== "string" || !p.text.trim())
        return true;
      const msg = {
        id: randomUUID(),
        userId: ws.key,
        name: member.name,
        color: "#c7ae78",
        text: p.text.trim().slice(0, 500),
        at: now(),
      };
      room.chat = [...room.chat, msg].slice(-150);
      broadcast(ws.room, {
        type: "broadcast",
        payload: { type: "chat", from: ws.key, sentAt: now(), msg },
      });
    }
    return true;
  }
  function remove(ws) {
    const room = rooms.get(ws.room);
    if (!room) return;
    room.observers.delete(ws);
    if (room.members.get(ws.key)?.socket === ws) {
      room.members.delete(ws.key);
      if (room.hostId === ws.key) {
        room.playback = {
          ...room.playback,
          position: expected(room.playback),
          at: now(),
          revision: room.playback.revision + 1,
        };
        room.hostId = room.members.keys().next().value ?? "";
        if (!room.hostId) room.playback.playing = false;
        // Keep the selected title during host failover; a new host must match it.
      }
      notify(ws.room, room);
    }
    if (!room.members.size && !room.observers.size) rooms.delete(ws.room);
  }
  function captureChat(code, message) {
    const room = rooms.get(code);
    if (!room || typeof message?.text !== "string") return;
    const msg = { ...message, text: message.text.slice(0, 500) };
    if (!room.chat.some((x) => x.id === msg.id)) room.chat = [...room.chat, msg].slice(-150);
  }
  // Socket identities are supplied by the shared relay when restoring a room.
  function restore(code, saved, socketFor) {
    if (!saved) return;
    rooms.set(code, {
      ...saved,
      started: !!saved.started || saved.playback.playing,
      members: new Map(
        saved.members.map(([id, member]) => [
          id,
          { ...member, socket: socketFor(member.connection) },
        ]),
      ),
      observers: new Set(saved.observers.map(socketFor)),
    });
  }
  function serialize(code) {
    const room = rooms.get(code);
    if (!room) return null;
    return {
      ...room,
      members: [...room.members].map(([id, { socket, ...member }]) => [
        id,
        { ...member, connection: socket.connection },
      ]),
      observers: [...room.observers].map((socket) => socket.connection),
    };
  }
  return { handle, remove, captureChat, restore, serialize };
}

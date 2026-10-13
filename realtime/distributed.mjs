import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { createStreamingRooms } from "./streaming.mjs";

const prefix = "watch:v1:";
const commit = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', 3600)
redis.call('PUBLISH', KEYS[3], ARGV[3])
redis.call('DEL', KEYS[1])
return 1`;

// Each mutation holds a room lease. State and its fanout commit atomically,
// so host election and playback revisions remain consistent across instances.
export function createDistributedRelay(url) {
  const redis = new Redis(url, { maxRetriesPerRequest: 2, connectTimeout: 5000 });
  const subscriber = redis.duplicate();
  const sockets = new Map();
  const subscriptions = new Map();
  const pending = new Set();
  redis.on("error", () => {});
  subscriber.on("error", () => {});
  subscriber.on("message", (channel, raw) => {
    let events;
    try {
      events = JSON.parse(raw);
    } catch {
      return;
    }
    const room = channel.slice((prefix + "events:").length);
    for (const event of events) {
      for (const [connection, client] of sockets) {
        if (
          client.room !== room ||
          (event.to && event.to !== connection) ||
          event.except === connection
        )
          continue;
        if (event.close) client.ws.close(4000, "Reconnected elsewhere");
        else if (client.ws.readyState === 1) client.ws.send(JSON.stringify(event.message));
      }
    }
  });
  async function mutate(room, connection, key, action, message) {
    const lock = prefix + "lock:" + room;
    const stateKey = prefix + "room:" + room;
    const eventsKey = prefix + "events:" + room;
    const token = randomUUID();
    const deadline = Date.now() + 5000;
    while (!(await redis.set(lock, token, "PX", 10000, "NX"))) {
      if (Date.now() > deadline) throw new Error("Room busy");
      await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 25));
    }
    try {
      const raw = await redis.get(stateKey);
      const state = raw ? JSON.parse(raw) : { connections: {}, streaming: null };
      const events = [];
      const proxies = new Map();
      const socketFor = (id) => {
        if (!proxies.has(id))
          proxies.set(id, {
            connection: id,
            room,
            key: state.connections[id]?.key ?? key,
            close: () => events.push({ to: id, close: true }),
          });
        return proxies.get(id);
      };
      const broadcast = (msg, except) => events.push({ message: msg, except });
      const streaming = createStreamingRooms({
        send: (ws, msg) => events.push({ to: ws.connection, message: msg }),
        broadcast: (_code, msg) => broadcast(msg),
      });
      streaming.restore(room, state.streaming, socketFor);
      const remove = (id) => {
        const prior = state.connections[id];
        streaming.remove(socketFor(id));
        delete state.connections[id];
        if (prior?.presence) broadcast({ type: "leave", leftPresences: [prior.presence] });
      };
      // Expired connections include instances terminated at their time limit.
      for (const [id, prior] of Object.entries(state.connections)) {
        if (prior.seen < Date.now() - 60000) remove(id);
      }
      let client = state.connections[connection];
      if (action === "join") {
        client = { key, seen: Date.now() };
        state.connections[connection] = client;
      }
      if (client) client.seen = Date.now();
      if (action === "leave") remove(connection);
      if (action === "message" && client) {
        const ws = socketFor(connection);
        if (!streaming.handle(ws, message)) {
          if (message.type === "track") {
            const joining = !client.presence;
            client.presence = {
              ...message.payload,
              id: key,
              presence_ref: client.presence?.presence_ref ?? randomUUID(),
            };
            if (joining) broadcast({ type: "join", newPresences: [client.presence] });
          } else if (message.type === "broadcast") {
            if (message.payload.type === "chat") streaming.captureChat(room, message.payload.msg);
            broadcast(
              { type: "broadcast", payload: { ...message.payload, from: key } },
              connection,
            );
          }
        }
      }
      if (
        action === "join" ||
        action === "leave" ||
        message?.type === "track" ||
        events.some((e) => e.message?.type === "leave")
      ) {
        const presence = Object.create(null);
        for (const member of Object.values(state.connections)) {
          if (member.presence) (presence[member.key] ??= []).push(member.presence);
        }
        broadcast({ type: "sync", state: presence });
      }
      state.streaming = streaming.serialize(room);
      if (
        !(await redis.eval(
          commit,
          3,
          lock,
          stateKey,
          eventsKey,
          token,
          JSON.stringify(state),
          JSON.stringify(events),
        ))
      ) {
        throw new Error("Room lease expired");
      }
    } finally {
      await redis.eval(
        "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
        1,
        lock,
        token,
      );
    }
  }
  function connect(ws, room, key) {
    const connection = randomUUID();
    sockets.set(connection, { ws, room });
    const channel = prefix + "events:" + room;
    if (!subscriptions.has(room)) subscriptions.set(room, subscriber.subscribe(channel));
    let queue = subscriptions.get(room).then(() => mutate(room, connection, key, "join"));
    const enqueue = (action, message) => {
      queue = queue
        .then(() => mutate(room, connection, key, action, message))
        .catch(() => {
          if (ws.readyState === 1) ws.close(1011, "Room connection interrupted; reconnecting");
        });
      const task = queue;
      pending.add(task);
      task.finally(() => pending.delete(task));
    };
    let count = 0,
      window = Date.now(),
      closed = false;
    ws.on("message", (data) => {
      if (Date.now() - window > 1000) {
        count = 0;
        window = Date.now();
      }
      if (++count > 60 || data.length > 65536) {
        ws.close(1008, "Message limit exceeded");
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
        !message.payload ||
        typeof message.payload !== "object" ||
        Array.isArray(message.payload)
      )
        return;
      if (message.type === "stream_ping") {
        ws.send(
          JSON.stringify({
            type: "stream_pong",
            payload: { t0: message.payload.t0, serverTime: Date.now() },
          }),
        );
      } else enqueue("message", message);
    });
    const heartbeat = setInterval(() => enqueue("touch"), 20000);
    heartbeat.unref();
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      enqueue("leave");
      sockets.delete(connection);
      if (![...sockets.values()].some((client) => client.room === room)) {
        // Wait for the leave publication before removing the subscription.
        queue.finally(() => {
          if (![...sockets.values()].some((client) => client.room === room)) {
            subscriptions.delete(room);
            void subscriber.unsubscribe(channel);
          }
        });
      }
    };
    ws.on("close", close);
    ws.on("error", close);
    queue.catch(() => ws.close(1011, "Room storage unavailable"));
  }
  return {
    connect,
    async close() {
      for (const { ws } of sockets.values()) ws.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await Promise.allSettled([...pending]);
      await Promise.all([redis.quit(), subscriber.quit()]);
    },
  };
}

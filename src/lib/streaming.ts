import { useEffect, useState } from "react";

export type StreamingSnapshot = {
  hostId: string;
  target: { service: string; url: string; title: string; key: string } | null;
  playback: { position: number; playing: boolean; at: number; revision: number };
  members: {
    id: string;
    name: string;
    service: string;
    url: string;
    status: string;
    ad: boolean;
  }[];
};
export function realtimeEndpoint() {
  const host =
    location.hostname.includes(":") && !location.hostname.startsWith("[")
      ? `[${location.hostname}]`
      : location.hostname;
  return (
    import.meta.env["VITE_REALTIME_URL"] ||
    (import.meta.env.PROD
      ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/realtime`
      : `${location.protocol === "https:" ? "wss" : "ws"}://${host}:3001`)
  );
}
export function extensionSetup(room: string) {
  const url = new URL(location.href);
  url.pathname = `/room/${room}`;
  url.search = "watch=stream";
  url.hash = "";
  return `wt1.${btoa(JSON.stringify({ room, relay: realtimeEndpoint(), roomUrl: url.href }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;
}
export function useStreamingRoom(room: string, id: string) {
  const [snapshot, setSnapshot] = useState<StreamingSnapshot | null>(null);
  const [connection, setConnection] = useState("Connecting");
  useEffect(() => {
    let stopped = false,
      socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (stopped) return;
      const url = new URL(realtimeEndpoint());
      url.searchParams.set("room", room);
      url.searchParams.set("key", `${id}-stream-view`);
      socket = new WebSocket(url);
      socket.onopen = () => {
        setConnection("Connected");
        socket?.send(JSON.stringify({ type: "stream_watch", payload: {} }));
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "stream_snapshot") setSnapshot(message.payload);
        } catch {
          /* Ignore malformed messages. */
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (!stopped) {
          setConnection("Reconnecting");
          retry = setTimeout(connect, 1500);
        }
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [room, id]);
  return { snapshot, connection };
}

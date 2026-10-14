import { useEffect, useState, useRef } from "react";

export type StreamingSnapshot = {
  intermission?: { name: string; at: number } | null;
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
    ready?: boolean;
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
  const club = url.searchParams.get("club"),
    screening = url.searchParams.get("screening");
  url.pathname = `/room/${room}`;
  url.search = "watch=stream";
  if (club) url.searchParams.set("club", club);
  if (screening) url.searchParams.set("screening", screening);
  url.hash = "";
  return `wt1.${btoa(JSON.stringify({ room, relay: realtimeEndpoint(), roomUrl: url.href }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;
}
export function useStreamingRoom(room: string, id: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const [attempt, setAttempt] = useState(0);
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
      socketRef.current = socket;
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
  }, [room, id, attempt]);
  return {
    snapshot,
    connection,
    retry: () => setAttempt((value) => value + 1),
    send: (type: string, payload: Record<string, unknown> = {}) => {
      if (socketRef.current?.readyState === WebSocket.OPEN)
        socketRef.current.send(JSON.stringify({ type, payload }));
    },
  };
}

type Presence = Record<string, unknown> & { presence_ref: string };
type Message = {
  type: string;
  payload?: Record<string, unknown>;
  state?: Record<string, Presence[]>;
  newPresences?: Presence[];
  leftPresences?: Presence[];
};

/** Room transport, with membership restored after a dropped connection. */
export class RealtimeChannel {
  private socket: WebSocket | undefined;
  private stopped = false;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private presence: Record<string, Presence[]> = {};
  private tracked: Record<string, unknown> | undefined;
  private listeners = new Map<string, ((message: Message) => void)[]>();
  private status: ((status: string) => void) | undefined;

  constructor(
    private room: string,
    private key: string,
  ) {}

  on(
    type: string,
    filter: { event: string },
    callback: (
      message: Message & {
        payload: Record<string, unknown>;
        newPresences: Presence[];
        leftPresences: Presence[];
      },
    ) => void,
  ) {
    const event = type === "broadcast" ? "broadcast" : filter.event;
    this.listeners.set(event, [
      ...(this.listeners.get(event) ?? []),
      callback as (message: Message) => void,
    ]);
    return this;
  }

  presenceState<T>() {
    return this.presence as Record<string, (T & { presence_ref: string })[]>;
  }

  subscribe(callback: (status: string) => void) {
    this.status = callback;
    this.connect();
    return this;
  }

  private connect() {
    if (this.stopped) return;
    const hostname = location.hostname.includes(":") ? `[${location.hostname}]` : location.hostname;
    const fallback = import.meta.env.PROD
      ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/realtime`
      : `${location.protocol === "https:" ? "wss" : "ws"}://${hostname}:3001`;
    const url = new URL(import.meta.env["VITE_REALTIME_URL"] || fallback);
    url.searchParams.set("room", this.room);
    url.searchParams.set("key", this.key);
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      if (this.tracked) this.write({ type: "track", payload: this.tracked });
      this.status?.("SUBSCRIBED");
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as Message;
      if (message.type === "sync") this.presence = message.state ?? {};
      for (const callback of this.listeners.get(message.type) ?? []) callback(message);
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.stopped) return;
      this.presence = {};
      for (const callback of this.listeners.get("sync") ?? []) callback({ type: "sync" });
      this.status?.("CHANNEL_ERROR");
      this.retry = setTimeout(() => this.connect(), 1500);
    };
  }

  private write(message: Message) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  send(message: { type: string; event: string; payload: Record<string, unknown> }) {
    this.write({ type: "broadcast", payload: message.payload });
  }

  track(presence: Record<string, unknown>) {
    this.tracked = presence;
    this.write({ type: "track", payload: presence });
  }

  close() {
    this.stopped = true;
    clearTimeout(this.retry);
    this.socket?.close();
  }
}

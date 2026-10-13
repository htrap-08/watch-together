export function createDistributedRelay(url: string): {
  connect(ws: unknown, room: string, key: string): void;
  close(): Promise<void>;
};

import { experimental_upgradeWebSocket } from "@vercel/functions";
import { createDistributedRelay } from "../../realtime/distributed.mjs";

let relay: ReturnType<typeof createDistributedRelay> | undefined;
export async function realtimeRequest(request: Request): Promise<Response> {
  if (!process.env["REDIS_URL"]) return new Response("Room storage unavailable", { status: 503 });
  const url = new URL(request.url);
  const room = url.searchParams.get("room") ?? "";
  const key = url.searchParams.get("key") ?? "";
  const origin = request.headers.get("origin");
  const allowed = (process.env["REALTIME_ORIGINS"] ?? "").split(",").filter(Boolean);
  // Extension requests carry chrome-extension origins or omit Origin.
  // Ordinary browser requests must come from this app or an explicit allowlist.
  if (
    !/^[a-zA-Z0-9_-]{1,64}$/.test(room) ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(key) ||
    (origin &&
      origin !== url.origin &&
      !origin.startsWith("chrome-extension://") &&
      !allowed.includes(origin))
  ) {
    return new Response("Forbidden", { status: 403 });
  }
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket")
    return new Response("WebSocket required", { status: 426 });
  relay ??= createDistributedRelay(process.env["REDIS_URL"]);
  return experimental_upgradeWebSocket((ws) => relay!.connect(ws, room, key), {
    maxPayload: 65536,
  });
}

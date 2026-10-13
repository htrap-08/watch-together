import type { Me } from "./room-engine";

const COLORS = ["#f5b942", "#ff7a59", "#5ed6a0", "#6cb8ff", "#ff6fa8", "#c9e265", "#ffa94d", "#4dd4d4"];
const KEY = "watchparty:me";

export function loadMe(): Me | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as Me;
    // a per-tab id lets one browser open several tabs as different viewers
    const tabId = sessionStorage.getItem("watchparty:tab") ?? crypto.randomUUID().slice(0, 12);
    sessionStorage.setItem("watchparty:tab", tabId);
    return m.name ? { ...m, id: tabId } : null;
  } catch {
    return null;
  }
}

export function saveMe(name: string): Me {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
  localStorage.setItem(KEY, JSON.stringify({ id: "", name: name.trim().slice(0, 24), color }));
  return loadMe()!;
}

export function newRoomCode(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => a[b % a.length]).join("");
}

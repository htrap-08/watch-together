import { useEffect, useState } from "react";
export type ClubFilm = {
  id: string;
  title: string;
  url: string;
  source: "direct" | "stream";
  addedBy: string;
  at: number;
};
export type ClubScreening = {
  id: string;
  film: ClubFilm;
  at: number;
  room: string;
  rsvps: Record<string, { name: string; answer: "yes" | "maybe" | "no" }>;
  completed: boolean;
  completedAt?: number;
  reviews: Record<string, { name: string; score: number; text: string; at: number }>;
};
export type Club = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  watchlist: ClubFilm[];
  screenings: ClubScreening[];
};
const key = "watch:clubs";
export function savedClubs(): { id: string; name: string; ownerSecret?: string }[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
export function rememberClub(club: Club, secret?: string) {
  const previous = savedClubs();
  const entry = previous.find((c) => c.id === club.id);
  localStorage.setItem(
    key,
    JSON.stringify(
      [
        {
          id: club.id,
          name: club.name,
          ...(entry?.ownerSecret ? { ownerSecret: entry.ownerSecret } : {}),
          ...(secret ? { ownerSecret: secret } : {}),
        },
        ...previous.filter((c) => c.id !== club.id),
      ].slice(0, 50),
    ),
  );
}
export function clubActor() {
  let id = localStorage.getItem("watch:club-actor");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("watch:club-actor", id);
  }
  return id;
}
export async function clubAction(
  id: string | null,
  op: Record<string, unknown>,
): Promise<Club & { ownerSecret?: string }> {
  const secret = id ? savedClubs().find((c) => c.id === id)?.ownerSecret : undefined;
  const response = await fetch(id ? `/api/clubs/${id}` : "/api/clubs", {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret ? { "x-club-owner": secret } : {}) },
    body: JSON.stringify({ ...op, actor: clubActor() }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not save changes.");
  rememberClub(result, result.ownerSecret);
  return result;
}
export function useClub(id: string | undefined) {
  const [club, setClub] = useState<Club | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) {
      setClub(null);
      return;
    }
    let stopped = false;
    const refresh = async () => {
      try {
        const r = await fetch(`/api/clubs/${id}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (!stopped) {
          setClub(data);
          rememberClub(data);
          setError("");
        }
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "Club unavailable.");
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [id]);
  return { club, error, setClub };
}
export function screeningLink(club: Club, screening: ClubScreening) {
  const query = new URLSearchParams({ club: club.id, screening: screening.id });
  if (screening.film.source === "stream") query.set("watch", "stream");
  return `/room/${screening.room}?${query}`;
}
export function calendarText(
  club: Club,
  screening: ClubScreening,
  origin: string,
  now = Date.now(),
) {
  const stamp = (n: number) =>
    new Date(n)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Watch Together//Screening//EN",
    "BEGIN:VEVENT",
    `UID:${screening.id}@watch-together`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(screening.at)}`,
    `DURATION:PT2H`,
    `SUMMARY:${escape(screening.film.title + " — " + club.name)}`,
    `DESCRIPTION:${escape("Join the screening: " + origin + screeningLink(club, screening))}`,
    `URL:${origin + screeningLink(club, screening)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .flatMap((line) => {
      const parts: string[] = [];
      let part = "",
        bytes = 0;
      const encoder = new TextEncoder();
      for (const character of line) {
        const count = encoder.encode(character).length;
        if (bytes + count > 75) {
          parts.push(part);
          part = " ";
          bytes = 1;
        }
        part += character;
        bytes += count;
      }
      parts.push(part);
      return parts;
    })
    .join("\r\n");
  return content;
}
export function calendarFile(club: Club, screening: ClubScreening) {
  const content = calendarText(club, screening, location.origin);
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "watch-together-screening.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

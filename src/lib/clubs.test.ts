import { it, expect } from "vitest";
import { calendarText, type Club, type ClubScreening } from "./clubs";
const club: Club = {
  id: "abcdefghijklmnopqrstuvwx",
  name: "Sunday club",
  createdAt: 0,
  updatedAt: 0,
  watchlist: [],
  screenings: [],
};
const screening: ClubScreening = {
  id: "screening-1",
  film: {
    id: "film",
    title: "A film",
    url: "https://example.com/film.mp4",
    source: "direct",
    addedBy: "Host",
    at: 0,
  },
  at: Date.UTC(2026, 9, 15, 14, 30),
  room: "ABC123",
  rsvps: {},
  completed: false,
  reviews: {},
};
it("calendar exports UTC times and a reusable screening link", () => {
  const unfolded = calendarText(
    club,
    screening,
    "https://watch.example.com",
    Date.UTC(2026, 9, 14),
  ).replace(/\r\n /g, "");
  expect(unfolded).toContain("DTSTART:20261015T143000Z");
  expect(unfolded).toContain(
    "URL:https://watch.example.com/room/ABC123?club=abcdefghijklmnopqrstuvwx&screening=screening-1",
  );
  expect(unfolded).toContain("DURATION:PT2H");
});
it("calendar text escapes control characters and folds long Unicode lines without creating extra events", () => {
  const output = calendarText(
    club,
    {
      ...screening,
      film: { ...screening.film, title: "🎬".repeat(50) + "\rBEGIN:VEVENT\nAnother; film, test" },
    },
    "https://watch.example.com",
  );
  expect(output.split("\r\n").filter((line) => line === "BEGIN:VEVENT")).toHaveLength(1);
  expect(output.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
    true,
  );
  expect(output.replace(/\r\n /g, "")).toContain("\\nBEGIN:VEVENT\\nAnother\\; film\\, test");
});

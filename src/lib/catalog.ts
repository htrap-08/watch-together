const B = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/";

export type Movie = {
  id: string;
  title: string;
  year: number;
  genres: string[];
  category: "Feature Shorts" | "Quick Bites" | "Motor Club";
  minutes: number;
  rating: number;
  mood: string;
  description: string;
  src: string;
  thumb: string;
};

const m = (
  id: string,
  file: string,
  title: string,
  year: number,
  genres: string[],
  category: Movie["category"],
  minutes: number,
  rating: number,
  mood: string,
  description: string,
): Movie => ({ id, title, year, genres, category, minutes, rating, mood, description, src: `${B}${file}.mp4`, thumb: `${B}images/${file}.jpg` });

export const CATALOG: Movie[] = [
  m("bbb", "BigBuckBunny", "Big Buck Bunny", 2008, ["Animation", "Comedy", "Family"], "Feature Shorts", 10, 7.4, "Cozy", "A gentle giant rabbit takes revenge on three bullying rodents."),
  m("sintel", "Sintel", "Sintel", 2010, ["Animation", "Fantasy", "Adventure"], "Feature Shorts", 15, 7.5, "Epic", "A lone girl searches the wilderness for the baby dragon she raised."),
  m("tos", "TearsOfSteel", "Tears of Steel", 2012, ["Sci-Fi", "Action"], "Feature Shorts", 12, 6.3, "Intense", "Warriors and scientists try to save the world from destructive robots in Amsterdam."),
  m("ed", "ElephantsDream", "Elephants Dream", 2006, ["Animation", "Sci-Fi", "Surreal"], "Feature Shorts", 11, 6.5, "Weird", "Two men explore a vast, mechanical, surreal machine world."),
  m("blazes", "ForBiggerBlazes", "For Bigger Blazes", 2014, ["Action", "Fantasy"], "Quick Bites", 1, 5.9, "Hype", "Dragons, fire, and a living room full of drama."),
  m("escapes", "ForBiggerEscapes", "For Bigger Escapes", 2014, ["Adventure", "Travel"], "Quick Bites", 1, 6.0, "Chill", "Leave the couch behind for a quick escape to somewhere wild."),
  m("fun", "ForBiggerFun", "For Bigger Fun", 2014, ["Comedy", "Family"], "Quick Bites", 1, 6.1, "Cozy", "A minute of pure silliness on the big screen."),
  m("joyrides", "ForBiggerJoyrides", "For Bigger Joyrides", 2014, ["Action", "Adventure"], "Quick Bites", 1, 5.8, "Hype", "Speed, stunts and a ridiculous amount of joy."),
  m("meltdowns", "ForBiggerMeltdowns", "For Bigger Meltdowns", 2014, ["Comedy", "Drama"], "Quick Bites", 1, 5.7, "Chaotic", "When everything goes wrong, make it bigger."),
  m("subaru", "SubaruOutbackOnStreetAndDirt", "Outback on Street & Dirt", 2014, ["Automotive", "Documentary"], "Motor Club", 10, 6.4, "Chill", "A road-and-trail review of a wagon that refuses to stay clean."),
  m("gti", "VolkswagenGTIReview", "GTI Review", 2014, ["Automotive", "Documentary"], "Motor Club", 10, 6.2, "Chill", "A hot hatch pushed through city streets and backroads."),
  m("bullrun", "WeAreGoingOnBullrun", "We Are Going On Bullrun", 2014, ["Automotive", "Action", "Documentary"], "Motor Club", 1, 6.0, "Hype", "A cross-country rally of supercars and questionable decisions."),
  m("grand", "WhatCarCanYouGetForAGrand", "What Car For A Grand?", 2014, ["Automotive", "Comedy"], "Motor Club", 9, 6.6, "Chaotic", "Three hosts, one thousand dollars, and a lot of rust."),
];

export const GENRES = Array.from(new Set(CATALOG.flatMap((x) => x.genres))).sort();
export const CATEGORIES = Array.from(new Set(CATALOG.map((x) => x.category)));
export const MOODS = Array.from(new Set(CATALOG.map((x) => x.mood))).sort();

/** Resolve a catalog id or a raw media URL into something playable. */
export function resolveVideo(id: string | null): Movie | null {
  if (!id) return null;
  const found = CATALOG.find((x) => x.id === id);
  if (found) return found;
  if (/^https?:\/\//.test(id)) {
    const name = decodeURIComponent(id.split("/").pop() ?? "Custom video").replace(/\.[a-z0-9]+$/i, "");
    return { id, title: name || "Custom video", year: 0, genres: [], category: "Quick Bites", minutes: 0, rating: 0, mood: "", description: "Shared from a link", src: id, thumb: "" };
  }
  return null;
}

/** Recommend by genre/mood affinity with what the room has watched, reacted to or queued. */
export function recommend(signals: string[], exclude: Set<string>, limit = 4): Movie[] {
  const weights = new Map<string, number>();
  for (const id of signals) {
    const mv = CATALOG.find((x) => x.id === id);
    if (!mv) continue;
    for (const g of mv.genres) weights.set(g, (weights.get(g) ?? 0) + 1);
    weights.set(`mood:${mv.mood}`, (weights.get(`mood:${mv.mood}`) ?? 0) + 0.5);
  }
  return CATALOG.filter((x) => !exclude.has(x.id))
    .map((x) => ({ x, s: x.genres.reduce((a, g) => a + (weights.get(g) ?? 0), 0) + (weights.get(`mood:${x.mood}`) ?? 0) + x.rating / 20 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.x);
}

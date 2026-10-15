import data from "./discovery-data.json";
import { fuzzyScore, normalizeSearch } from "./fuzzy";
export type DiscoveryTitle = {
  id: string;
  title: string;
  kind: string;
  genres: string[];
  platform: string;
  source: string;
  url: string;
  chart: string;
  image: string;
  year?: string | undefined;
  availability?: "unverified";
  aliases?: string[];
  language?: string;
  imageLayout?: "poster";
};
export const indiaAvailabilityUrl = (query: string) =>
  `https://www.justwatch.com/in/search?q=${encodeURIComponent(query)}`;

export function mergeDiscovery(local: DiscoveryTitle[], remote: DiscoveryTitle[]) {
  const seen = new Set(local.map((t) => `${normalizeSearch(t.title)}:${t.kind}`));
  return [
    ...local,
    ...remote.filter((t) => {
      const key = `${normalizeSearch(t.title)}:${t.kind}`;
      // Preserve remakes with known different release years, and verified local service links.
      if (seen.has(key) && !t.year) return false;
      if (
        local.some(
          (l) =>
            normalizeSearch(l.title) === normalizeSearch(t.title) &&
            l.kind === t.kind &&
            (!l.year || l.year === t.year),
        )
      )
        return false;
      const identity = `${key}:${t.year || ""}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    }),
  ];
}
export const discovery = { ...data, titles: data.titles as DiscoveryTitle[] };
export function discoverTitles(
  query: string,
  kind: string,
  genre: string,
  platform: string,
  preferred: string[] = [],
  titles: DiscoveryTitle[] = discovery.titles,
) {
  return titles
    .map((title, index) => ({
      title,
      score: fuzzyScore(query, [
        title.title,
        title.kind,
        title.platform,
        title.year || "",
        title.language || "",
        ...(title.aliases || []),
        ...title.genres,
        ...(title.platform === "JioHotstar" ? ["hotstar", "disney hotstar", "jio hotstar"] : []),
        ...(title.platform === "Prime Video" ? ["amazon prime"] : []),
      ]),
      affinity: title.genres.filter((g) => preferred.includes(g)).length,
      index,
    }))
    .filter(
      ({ title, score }) =>
        score > 0 &&
        (kind === "All" || title.kind === kind) &&
        (genre === "All" || title.genres.includes(genre)) &&
        (platform === "All" || title.platform === platform),
    )
    .sort((a, b) => b.score - a.score || b.affinity - a.affinity || a.index - b.index)
    .map((x) => x.title);
}
export const selectionKey = (code: string) => `watch:selection:${code}`;

import data from "./discovery-data.json";
import { fuzzyScore } from "./fuzzy";
export type DiscoveryTitle = (typeof data.titles)[number];
export const discovery = data;
export function discoverTitles(
  query: string,
  kind: string,
  genre: string,
  platform: string,
  preferred: string[] = [],
) {
  return data.titles
    .map((title, index) => ({
      title,
      score: fuzzyScore(query, [title.title, title.kind, title.platform, ...title.genres]),
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

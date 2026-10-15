import type { DiscoveryTitle } from "./discovery";
import { indiaAvailabilityUrl } from "./discovery";
import { fuzzyScore, normalizeSearch } from "./fuzzy";

type WikiPage = {
  id: number;
  key: string;
  title: string;
  description?: string;
  matched_title?: string;
  thumbnail?: { url?: string };
};
type Show = {
  id: number;
  name: string;
  url: string;
  premiered?: string;
  genres?: string[];
  image?: { medium?: string } | null;
};
export type SearchResponse = { titles: DiscoveryTitle[]; unavailable: string[] };

export function movieResults(pages: WikiPage[], query: string): DiscoveryTitle[] {
  return pages
    .filter(
      (p) =>
        /\b(film|movie)\b/i.test(p.description || "") &&
        !/\b(actor|actress|director|filmography|list of|soundtrack|company)\b/i.test(
          p.description || "",
        ),
    )
    .map((p) => {
      const title = p.title.replace(/\s*\((?:\d{4}\s+)?(?:[^)]*\s)?film\)$/, "");
      return {
        id: `wiki:${p.id}`,
        title,
        kind: "Movie",
        genres: [
          "Action",
          "Comedy",
          "Crime",
          "Drama",
          "Fantasy",
          "Horror",
          "Romance",
          "Thriller",
          "Animation",
          "Documentary",
          "Science fiction",
        ].filter((g) => (p.description || "").toLowerCase().includes(g.toLowerCase())),
        year: p.description?.match(/\b(?:19|20)\d{2}\b/)?.[0],
        platform: "Check availability",
        availability: "unverified" as const,
        source: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.key)}`,
        url: indiaAvailabilityUrl(title),
        chart: p.description || "Wikipedia movie catalogue",
        image: p.thumbnail?.url?.startsWith("https://") ? p.thumbnail.url : "",
        imageLayout: "poster" as const,
        aliases: p.matched_title ? [p.matched_title] : [],
      };
    })
    .filter(
      (t) => fuzzyScore(query.replace(/\b(?:19|20)\d{2}\b/g, ""), [t.title, ...t.aliases]) > 0,
    )
    .sort(
      (a, b) =>
        fuzzyScore(query, [b.title, b.year || ""]) - fuzzyScore(query, [a.title, a.year || ""]),
    );
}

export function seriesResults(entries: { show: Show }[]): DiscoveryTitle[] {
  return entries
    .filter(({ show }) => show?.name && show.url?.startsWith("https://www.tvmaze.com/"))
    .map(({ show }) => ({
      id: `tvmaze:${show.id}`,
      title: show.name,
      kind: "Series",
      genres: show.genres || [],
      year: show.premiered?.slice(0, 4),
      platform: "Check availability",
      availability: "unverified",
      source: show.url,
      url: indiaAvailabilityUrl(show.name),
      chart: "TVmaze series catalogue",
      imageLayout: "poster" as const,
      image: show.image?.medium?.startsWith("https://") ? show.image.medium : "",
    }));
}
const cache = new Map<string, { until: number; result: SearchResponse }>();
const pending = new Map<string, Promise<SearchResponse>>();
async function json(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(7000),
    headers: {
      "User-Agent": "WatchTogether/1.0 (https://watch-together-lyart.vercel.app; catalogue search)",
    },
  });
  if (!response.ok) throw new Error(`Catalogue returned ${response.status}`);
  return response.json();
}
async function searchMovies(query: string): Promise<DiscoveryTitle[]> {
  const result = await json(
    `https://en.wikipedia.org/w/rest.php/v1/search/page?${new URLSearchParams({ q: `${query} film`, limit: "20" })}`,
  );
  const titles = movieResults(Array.isArray(result.pages) ? result.pages : [], query);
  if (!titles.length) return titles;
  // One batch gets actual cover art. An image failure must not erase valid title results.
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "pageimages",
      pageids: titles.map((t) => t.id.split(":")[1]).join("|"),
      piprop: "thumbnail",
      pithumbsize: "500",
      pilicense: "any",
    });
    const images = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      signal: AbortSignal.timeout(3000),
      headers: {
        "User-Agent":
          "WatchTogether/1.0 (https://watch-together-lyart.vercel.app; poster thumbnails)",
      },
    });
    if (!images.ok) return titles;
    const data = (await images.json()) as {
      query?: { pages?: { pageid: number; thumbnail?: { source?: string } }[] };
    };
    const posters = new Map(
      (data.query?.pages || []).map((p) => [`wiki:${p.pageid}`, p.thumbnail?.source]),
    );
    return titles.map((t) => ({
      ...t,
      image: posters.get(t.id)?.startsWith("https://upload.wikimedia.org/")
        ? posters.get(t.id)!
        : t.image,
    }));
  } catch {
    return titles;
  }
}
export async function catalogueSearch(query: string): Promise<SearchResponse> {
  const key = normalizeSearch(query);
  const saved = cache.get(key);
  if (saved && saved.until > Date.now()) return saved.result;
  if (pending.has(key)) return pending.get(key)!;
  const request = (async () => {
    const responses = await Promise.allSettled([
      searchMovies(query),
      json(
        `https://api.tvmaze.com/search/shows?${new URLSearchParams({ q: query.replace(/\b(?:19|20)\d{2}\b/g, "").trim() })}`,
      ),
    ]);
    const [movies, series] = responses;
    const result = {
      titles: [
        ...(movies.status === "fulfilled" ? movies.value : []),
        ...(series.status === "fulfilled"
          ? seriesResults(Array.isArray(series.value) ? series.value : [])
          : []),
      ],
      unavailable: responses.flatMap((r, i) =>
        r.status === "rejected" ? [i === 0 ? "Movies" : "Series"] : [],
      ),
    };
    // Bound memory and retry failures quickly; cache successful searches for an hour.
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + (result.unavailable.length ? 15000 : 3600000), result });
    return result;
  })();
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}
export async function discoveryRequest(request: Request) {
  if (request.method !== "GET")
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100)
    return Response.json({ error: "Enter 2–100 characters." }, { status: 400 });
  const result = await catalogueSearch(query);
  return Response.json(result, {
    headers: {
      "Cache-Control": result.unavailable.length
        ? "no-store"
        : "public, max-age=300, s-maxage=3600",
    },
  });
}

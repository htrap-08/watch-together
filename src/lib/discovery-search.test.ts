import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogueSearch, discoveryRequest, movieResults, seriesResults } from "./discovery-search";
import { discovery, discoverTitles, mergeDiscovery } from "./discovery";
import { fuzzyScore } from "./fuzzy";

afterEach(() => vi.unstubAllGlobals());
describe("worldwide discovery", () => {
  it("normalizes punctuation, accents, transposed letters and non-Latin titles", () => {
    expect(fuzzyScore("Amelie", ["Amélie"])).toBeGreaterThan(0);
    expect(fuzzyScore("Spider-Man", ["Spider Man"])).toBeGreaterThan(0);
    expect(fuzzyScore("spiderman", ["Spider-Man: Homecoming"])).toBeGreaterThan(0);
    expect(fuzzyScore("Strnager", ["Stranger"])).toBeGreaterThan(0);
    expect(fuzzyScore("千と千尋の神隠し", ["千と千尋の神隠し"])).toBeGreaterThan(0);
    expect(discoverTitles("Kimi no Na wa", "All", "All", "All")[0]?.id).toBe("your-name");
    expect(
      discoverTitles("amazon prime", "All", "All", "All").every(
        (t) => t.platform === "Prime Video",
      ),
    ).toBe(true);
  });
  it("finds a movie outside the curated list without inventing Indian streaming rights", () => {
    const titles = movieResults(
      [
        {
          id: 1,
          key: "Interstellar_(film)",
          title: "Interstellar (film)",
          description: "2014 science fiction film by Christopher Nolan",
        },
        { id: 2, key: "Nolan", title: "Christopher Nolan", description: "British film director" },
        {
          id: 3,
          key: "Soundtrack",
          title: "Interstellar (soundtrack)",
          description: "2014 soundtrack album",
        },
        {
          id: 4,
          key: "Interstellar_(musical)",
          title: "Interstellar (musical)",
          description: "Stage musical based on the 2014 film",
        },
      ],
      "interstelar",
    );
    expect(titles).toHaveLength(1);
    expect(titles[0]).toMatchObject({
      title: "Interstellar",
      year: "2014",
      availability: "unverified",
      platform: "Check availability",
    });
    expect(titles[0]?.url).toBe("https://www.justwatch.com/in/search?q=Interstellar");
  });
  it("preserves verified platform links while retaining different remakes", () => {
    const original = discovery.titles.find((t) => t.id === "inception")!;
    expect(
      mergeDiscovery(
        [original],
        [{ ...original, id: "remote", platform: "Check availability", availability: "unverified" }],
      ),
    ).toEqual([original]);
    expect(
      mergeDiscovery(
        [],
        [
          { ...original, year: "2010" },
          { ...original, year: "2010" },
          { ...original, year: "2020" },
        ],
      ),
    ).toHaveLength(2);
  });
  it("does not mistake a series' original network for Indian availability", () => {
    expect(
      seriesResults([
        {
          show: {
            id: 1,
            name: "A series",
            url: "https://www.tvmaze.com/shows/1/test",
            premiered: "2020-01-01",
            genres: ["Comedy"],
          },
        },
      ])[0],
    ).toMatchObject({ availability: "unverified", year: "2020" });
  });
  it("keeps series results when the movie provider fails, and rejects invalid requests", async () => {
    const mock = vi.fn(async (url: string) => {
      if (url.includes("wikipedia")) throw new Error("Provider unavailable");
      return Response.json([
        {
          show: {
            id: 169,
            name: "Breaking Bad",
            url: "https://www.tvmaze.com/shows/169/breaking-bad",
          },
        },
      ]);
    });
    vi.stubGlobal("fetch", mock);
    const result = await catalogueSearch("Breaking Bad");
    expect(result.unavailable).toEqual(["Movies"]);
    expect(result.titles[0]?.title).toBe("Breaking Bad");
    expect((await discoveryRequest(new Request("http://localhost/api/discovery?q=a"))).status).toBe(
      400,
    );
    expect(
      (
        await discoveryRequest(
          new Request("http://localhost/api/discovery?q=test", { method: "POST" }),
        )
      ).status,
    ).toBe(405);
  });
});

import { describe, expect, it } from "vitest";
import { discoverTitles, discovery } from "./discovery";
describe("India movie discovery", () => {
  it("finds real series despite a typo", () => {
    expect(discoverTitles("shaqe", "Series", "All", "All").map((t) => t.id)).toEqual(["shaque"]);
  });
  it("combines format, genre and service filters", () => {
    const titles = discoverTitles("", "Movie", "Drama", "Prime Video");
    expect(titles.map((t) => t.id)).toEqual(["drishyam3"]);
  });
  it("puts preferred genres first without inventing platform availability", () => {
    expect(discoverTitles("", "All", "All", "All", ["Comedy"])[0]?.genres).toContain("Comedy");
    expect(
      discovery.titles.every(
        (t) =>
          t.source.startsWith("https://") &&
          t.url.startsWith("https://") &&
          t.image.startsWith("https://"),
      ),
    ).toBe(true);
  });
});

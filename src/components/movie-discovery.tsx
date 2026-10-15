import { useEffect, useState } from "react";
import {
  discovery,
  discoverTitles,
  mergeDiscovery,
  indiaAvailabilityUrl,
  type DiscoveryTitle,
} from "@/lib/discovery";
import { DiscoveryArtwork } from "./discovery-artwork";
import type { SearchResponse } from "@/lib/discovery-search";
export function MovieDiscovery({ onChoose }: { onChoose: (title: DiscoveryTitle) => void }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("All");
  const [genre, setGenre] = useState("All");
  const [platform, setPlatform] = useState("All");
  const [preferred, setPreferred] = useState<string[]>([]);
  const [remote, setRemote] = useState<{ query: string; titles: DiscoveryTitle[] }>({
    query: "",
    titles: [],
  });
  const [status, setStatus] = useState("");
  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) {
      setStatus("");
      return;
    }
    const controller = new AbortController();
    setStatus("Searching the wider catalogue…");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/discovery?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search unavailable");
        const data: SearchResponse = await response.json();
        if (controller.signal.aborted) return;
        setRemote({ query: term, titles: data.titles });
        setStatus(
          data.unavailable.length
            ? `${data.unavailable.join(" and ")} search is temporarily unavailable. Other results are still shown.`
            : "",
        );
      } catch {
        if (!controller.signal.aborted) {
          setRemote({ query: term, titles: [] });
          setStatus(
            "Catalogue search is unavailable. Homepage matches are still shown; try again or check JustWatch below.",
          );
        }
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);
  const catalogue = mergeDiscovery(discovery.titles, remote.query === term ? remote.titles : []);
  const genres = [
    ...new Set([...catalogue.flatMap((t) => t.genres), ...(genre === "All" ? [] : [genre])]),
  ].sort();
  // Providers already rank fuzzy title matches. Do not discard them with a second, stricter text match.
  const local = discoverTitles(query, "All", "All", "All", preferred);
  const candidates = term
    ? mergeDiscovery(local, remote.query === term ? remote.titles : [])
    : catalogue;
  const results = discoverTitles("", kind, genre, platform, preferred, candidates);
  const hidden = candidates.length - results.length;
  const searching = status.startsWith("Searching");
  const filtered = kind !== "All" || genre !== "All" || platform !== "All";
  const clearFilters = () => {
    setKind("All");
    setGenre("All");
    setPlatform("All");
  };
  return (
    <section className="movie-discovery" id="discover" aria-labelledby="discovery-heading">
      <div className="discovery-title">
        <div>
          <p className="path-number">THE WATCHLIST</p>
          <h2 id="discovery-heading">Something worth staying in for.</h2>
        </div>
        <p>
          Worldwide films & series. Streaming options for India.
          <br />
          Availability checked 15 October 2026.
        </p>
      </div>
      <div className="discovery-filters">
        <label>
          Find a title
          <input
            type="search"
            placeholder="Search movies & series, or browse by genre…"
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Format
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option>All</option>
            <option>Movie</option>
            <option>Series</option>
          </select>
        </label>
        <label>
          Genre
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option>All</option>
            {genres.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label>
          Platform
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option>All</option>
            {[...new Set(discovery.titles.map((t) => t.platform))].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="discovery-tastes">
        <span>More your kind of night:</span>
        {genres.map((g) => (
          <button
            key={g}
            aria-pressed={preferred.includes(g)}
            onClick={() =>
              setPreferred((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]))
            }
          >
            {g}
          </button>
        ))}
      </div>
      <div className="discovery-results" aria-live="polite" aria-busy={searching}>
        {term && `${results.length} ${results.length === 1 ? "match" : "matches"}`}
        {preferred.length ? " · matching tastes first" : ""}
        {hidden > 0 && ` · ${hidden} hidden by filters`}
        {filtered && (
          <button className="path-choice" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        {query && (
          <button className="path-choice" onClick={() => setQuery("")}>
            Clear search
          </button>
        )}
      </div>
      {status && <p role="status">{status}</p>}
      {term.length === 1 && <p>Type at least 2 characters to search beyond the homepage picks.</p>}
      {[
        { kind: "Movie", heading: "Movies" },
        { kind: "Series", heading: "Series" },
      ].map((group) => {
        const titles = results.filter((t) => t.kind === group.kind);
        if (!titles.length) return null;
        return (
          <section className="discovery-category" key={group.kind} aria-label={group.heading}>
            <h3 className="discovery-category-heading">{group.heading}</h3>
            <div className="discovery-grid">
              {titles.map((t) => (
                <article className="discovery-film" key={t.id}>
                  <DiscoveryArtwork key={t.image} title={t} />
                  <p className="discovery-platform">
                    {t.availability === "unverified"
                      ? "Indian streaming availability unverified"
                      : `On ${t.platform} · India`}
                  </p>
                  <h4>
                    {t.title}
                    {t.year && <small> ({t.year})</small>}
                  </h4>
                  <p className="discovery-genres">{t.genres.join(" · ")}</p>
                  <button className="path-choice" onClick={() => onChoose(t)}>
                    Plan a watch party <span aria-hidden="true">↗</span>
                  </button>
                  <div className="discovery-links">
                    <a href={t.url} target="_blank" rel="noreferrer">
                      {t.availability === "unverified"
                        ? "Check where to watch in India"
                        : `${t.url.includes("/search?") ? "Find" : "Open"} on ${t.platform}`}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {!results.length && !searching && (
        <p>
          No matches{filtered ? " with these filters" : " yet"}. Try the original title, a shorter
          name or another spelling.
        </p>
      )}
      {term.length >= 2 && (
        <p className="compatibility-footnote">
          Still missing a title?{" "}
          <a href={indiaAvailabilityUrl(term)} target="_blank" rel="noreferrer">
            Search “{term}” on JustWatch India ↗
          </a>
        </p>
      )}
      <p className="compatibility-footnote">
        Search goes beyond these picks using{" "}
        <a href="https://en.wikipedia.org/" target="_blank" rel="noreferrer">
          Wikipedia
        </a>{" "}
        movie metadata and{" "}
        <a href="https://www.tvmaze.com/" target="_blank" rel="noreferrer">
          TVmaze
        </a>{" "}
        series data (
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA
        </a>
        ). These catalogues are not exhaustive. Search results do not confirm an Indian subscription
        platform; use “Check where to watch” for current options.
      </p>
      <p className="compatibility-footnote">
        Recent chart picks and international favourites, not a live ranking or a complete catalogue.
        Indian chart selections:{" "}
        <a href="https://www.justwatch.com/in/streaming-charts" target="_blank" rel="noreferrer">
          JustWatch India
        </a>{" "}
        (12–15 October). Series:{" "}
        <a href="https://www.netflix.com/tudum/top10/india/tv" target="_blank" rel="noreferrer">
          Netflix India Top 10
        </a>{" "}
        (5–11 October). International picks use JustWatch availability listings, checked 15 October.
        Subscription access is separate from this site; service integrations remain experimental.
      </p>
    </section>
  );
}

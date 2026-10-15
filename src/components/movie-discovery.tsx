import { useState } from "react";
import { discovery, discoverTitles, type DiscoveryTitle } from "@/lib/discovery";
export function MovieDiscovery({ onChoose }: { onChoose: (title: DiscoveryTitle) => void }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("All");
  const [genre, setGenre] = useState("All");
  const [platform, setPlatform] = useState("All");
  const [preferred, setPreferred] = useState<string[]>([]);
  const genres = [...new Set(discovery.titles.flatMap((t) => t.genres))].sort();
  const results = discoverTitles(query, kind, genre, platform, preferred);
  return (
    <section className="movie-discovery" id="discover" aria-labelledby="discovery-heading">
      <div className="discovery-title">
        <div>
          <p className="path-number">THE WATCHLIST / INDIA</p>
          <h2 id="discovery-heading">Something worth staying in for.</h2>
        </div>
        <p>
          Movies & series from recent streaming charts.
          <br />
          Availability checked 15 October 2026.
        </p>
      </div>
      <div className="discovery-filters">
        <label>
          Find a title
          <input
            type="search"
            placeholder="Try a title, genre or platform…"
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
      <div className="discovery-results" aria-live="polite">
        {results.length} {results.length === 1 ? "title" : "titles"}
        {preferred.length ? " · matching tastes first" : ""}
      </div>
      <div className="discovery-grid">
        {results.map((t) => (
          <article className="discovery-film" key={t.id}>
            <div className="discovery-art">
              {t.image && (
                <img
                  src={t.image}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                />
              )}
              <span>{t.kind}</span>
            </div>
            <p className="discovery-platform">On {t.platform} · India</p>
            <h3>{t.title}</h3>
            <p className="discovery-genres">{t.genres.join(" · ")}</p>
            <p className="discovery-chart">{t.chart}</p>
            <button className="path-choice" onClick={() => onChoose(t)}>
              Plan a watch party <span aria-hidden="true">↗</span>
            </button>
            <div className="discovery-links">
              <a href={t.url} target="_blank" rel="noreferrer">
                {t.url.includes("/search?") ? "Find" : "Open"} on {t.platform}
              </a>
              <a href={t.source} target="_blank" rel="noreferrer">
                Source
              </a>
            </div>
          </article>
        ))}
      </div>
      {!results.length && <p>No matches. Try another spelling or clear a filter.</p>}
      <p className="compatibility-footnote">
        A researched snapshot, not a live ranking or a complete catalogue. Movie selections:{" "}
        <a href="https://www.justwatch.com/in/streaming-charts" target="_blank" rel="noreferrer">
          JustWatch India
        </a>{" "}
        (12–15 October). Series:{" "}
        <a href="https://www.netflix.com/tudum/top10/india/tv" target="_blank" rel="noreferrer">
          Netflix India Top 10
        </a>{" "}
        (5–11 October). Subscription access is separate from this site; service integrations remain
        experimental.
      </p>
    </section>
  );
}

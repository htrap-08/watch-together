import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MovieDiscovery } from "../components/movie-discovery";
import type { DiscoveryTitle } from "../lib/discovery";
const film: DiscoveryTitle = {
  id: "outside",
  title: "Outside the picks",
  kind: "Movie",
  genres: ["Drama"],
  platform: "Check availability",
  availability: "unverified",
  source: "https://en.wikipedia.org/wiki/Test",
  url: "https://www.justwatch.com/in/search?q=test",
  chart: "Catalogue",
  image: "",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("groups cards under format headings instead of repeating format badges", () => {
  render(<MovieDiscovery onChoose={() => {}} />);
  expect(screen.getByRole("region", { name: "Movies" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Series" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Source" })).toBeNull();
  expect(document.querySelectorAll(".discovery-art > span:not(.discovery-monogram)")).toHaveLength(
    0,
  );
});
it("shows catalogue matches and exposes filters hiding them", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ titles: [film], unavailable: [] })),
  );
  render(<MovieDiscovery onChoose={() => {}} />);
  fireEvent.change(screen.getByLabelText("Platform"), { target: { value: "Netflix" } });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Outside" } });
  await waitFor(() => expect(screen.getByText(/1 hidden by filters/)).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByRole("heading", { name: "Outside the picks" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Check where to watch in India" })).toBeTruthy();
});
it("ignores a slow response for an earlier query", async () => {
  vi.useFakeTimers();
  let finishOld: (response: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.includes("Old")
        ? new Promise<Response>((resolve) => {
            finishOld = resolve;
          })
        : Promise.resolve(
            Response.json({ titles: [{ ...film, title: "New result" }], unavailable: [] }),
          ),
    ),
  );
  render(<MovieDiscovery onChoose={() => {}} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Old" } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "New" } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  await act(async () => {
    finishOld(Response.json({ titles: [{ ...film, title: "Old result" }], unavailable: [] }));
  });
  expect(screen.getByRole("heading", { name: "New result" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Old result" })).toBeNull();
});

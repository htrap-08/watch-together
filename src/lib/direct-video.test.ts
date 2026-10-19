import { afterEach, expect, it, vi } from "vitest";
import { checkDirectVideo, directVideoUrl } from "./direct-video";
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("accepts extensionless and signed media URLs without damaging query signatures", () => {
  expect(directVideoUrl(" https://cdn.example.com/play?token=a%2Bb&expires=123 ", true)).toBe(
    "https://cdn.example.com/play?token=a%2Bb&expires=123",
  );
});
it("rejects mixed content, credentials and streaming webpages", () => {
  expect(() => directVideoUrl("http://example.com/a.mp4", true)).toThrow("HTTPS");
  expect(() => directVideoUrl("https://user:password@example.com/a.mp4", true)).toThrow(
    "credentials",
  );
  expect(() => directVideoUrl("https://m.youtube.com/watch?v=123", true)).toThrow(
    "streaming-service page",
  );
  expect(() => directVideoUrl("javascript:alert(1)", false)).toThrow("HTTP");
  expect(directVideoUrl("http://localhost:3002/video.mp4", false)).toContain("localhost");
});
function media() {
  const el = document.createElement("video");
  vi.spyOn(el, "load").mockImplementation(() => {});
  vi.spyOn(document, "createElement").mockReturnValue(el);
  return el;
}
it("checks actual video data, then releases the temporary player", async () => {
  const el = media();
  const promise = checkDirectVideo("https://example.com/video", new AbortController().signal);
  el.dispatchEvent(new Event("loadeddata"));
  await expect(promise).resolves.toBeUndefined();
  expect(el.hasAttribute("src")).toBe(false);
  expect(el.onloadeddata).toBeNull();
});
it("rejects unreadable media and times out unresponsive hosts", async () => {
  vi.useFakeTimers();
  const el = media();
  const failed = checkDirectVideo("https://example.com/page", new AbortController().signal);
  const assertion = expect(failed).rejects.toThrow("not open as a playable video");
  el.dispatchEvent(new Event("error"));
  await assertion;
  const timeout = checkDirectVideo("https://example.com/slow", new AbortController().signal);
  const timed = expect(timeout).rejects.toThrow("15 seconds");
  vi.advanceTimersByTime(15000);
  await timed;
  expect(el.hasAttribute("src")).toBe(false);
});
it("cancels checks when leaving the room", async () => {
  const el = media();
  const controller = new AbortController();
  const pending = checkDirectVideo("https://example.com/video", controller.signal);
  const assertion = expect(pending).rejects.toThrow("cancelled");
  controller.abort();
  await assertion;
  expect(el.hasAttribute("src")).toBe(false);
});

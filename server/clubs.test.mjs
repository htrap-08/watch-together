import test from "node:test";
import assert from "node:assert/strict";
import { mutateClub } from "./clubs.mjs";
const club = () => ({ name: "Test club", watchlist: [], screenings: [] });
test("members add canonical titles; only owners schedule, cancel or complete screenings", () => {
  const c = club();
  mutateClub(
    c,
    {
      type: "film_add",
      name: "Viewer",
      title: "Film",
      url: "https://www.netflix.com/watch/123?session=secret#track",
      source: "stream",
    },
    false,
    1000,
  );
  assert.equal(c.watchlist[0].url, "https://www.netflix.com/watch/123");
  assert.throws(
    () => mutateClub(c, { type: "schedule", filmId: c.watchlist[0].id, at: 10000 }, false, 2000),
    /host/,
  );
  mutateClub(c, { type: "schedule", filmId: c.watchlist[0].id, at: 10000 }, true, 2000);
  assert.match(c.screenings[0].room, /^[A-Z2-9]{6}$/);
  assert.throws(
    () => mutateClub(c, { type: "complete", screeningId: c.screenings[0].id }, false),
    /host/,
  );
});
test("reviews require a completed screening; RSVP and review updates preserve other members", () => {
  const c = club();
  mutateClub(
    c,
    { type: "film_add", title: "Film", url: "https://example.com/video.mp4" },
    false,
    1000,
  );
  mutateClub(c, { type: "schedule", filmId: c.watchlist[0].id, at: 10000 }, true, 2000);
  const screeningId = c.screenings[0].id;
  mutateClub(c, { type: "rsvp", screeningId, name: "Alex", actor: "a", answer: "yes" }, false);
  mutateClub(c, { type: "rsvp", screeningId, name: "Sam", actor: "b", answer: "maybe" }, false);
  assert.equal(Object.keys(c.screenings[0].rsvps).length, 2);
  assert.throws(
    () => mutateClub(c, { type: "review", screeningId, name: "Alex", actor: "a", score: 4 }, false),
    /after/,
  );
  mutateClub(c, { type: "complete", screeningId }, true);
  mutateClub(
    c,
    { type: "review", screeningId, name: "Alex", actor: "a", score: 4, text: "Great" },
    false,
  );
  assert.equal(c.screenings[0].reviews.a.score, 4);
  assert.throws(
    () =>
      mutateClub(c, { type: "review", screeningId, name: "Alex", actor: "a", score: 99 }, false),
    /rating/,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import Redis from "ioredis";
import { clubsRequest, closeClubDatabase } from "./clubs.mjs";
test(
  "club API persists across reads, rejects non-owner writes and merges simultaneous RSVPs",
  { skip: !process.env.REDIS_URL },
  async (t) => {
    const origin = "https://watch.example.com";
    let id;
    const request = (path, body, secret, customOrigin = origin) =>
      clubsRequest(
        new Request(origin + path, {
          method: "POST",
          headers: {
            origin: customOrigin,
            "content-type": "application/json",
            ...(secret ? { "x-club-owner": secret } : {}),
          },
          body: JSON.stringify(body),
        }),
      );
    t.after(async () => {
      const db = new Redis(process.env.REDIS_URL);
      db.on("error", () => {});
      if (id) await db.del("watch:club:" + id);
      await db.quit();
      await closeClubDatabase();
    });
    let r = await request("/api/clubs", { type: "create", name: "Integration test club" });
    assert.equal(r.status, 201);
    const created = await r.json();
    id = created.id;
    const secret = created.ownerSecret;
    assert.ok(secret);
    assert.equal(created.ownerHash, undefined);
    r = await request("/api/clubs/" + id, {
      type: "film_add",
      name: "Host",
      title: "Film",
      url: "https://example.com/film.mp4",
      source: "direct",
    });
    assert.equal(r.status, 200);
    const film = (await r.json()).watchlist[0];
    r = await request("/api/clubs/" + id, {
      type: "schedule",
      filmId: film.id,
      at: Date.now() + 86400000,
    });
    assert.equal(r.status, 403);
    r = await request(
      "/api/clubs/" + id,
      { type: "schedule", filmId: film.id, at: Date.now() + 86400000 },
      secret,
      "https://evil.example",
    );
    assert.equal(r.status, 403);
    r = await request(
      "/api/clubs/" + id,
      { type: "schedule", filmId: film.id, at: Date.now() + 86400000 },
      secret,
    );
    assert.equal(r.status, 200);
    const screening = (await r.json()).screenings[0];
    const answers = await Promise.all(
      ["one", "two"].map((actor) =>
        request("/api/clubs/" + id, {
          type: "rsvp",
          screeningId: screening.id,
          actor,
          name: actor,
          answer: "yes",
        }),
      ),
    );
    assert.ok(answers.every((result) => result.status === 200));
    const read = await clubsRequest(new Request(origin + "/api/clubs/" + id));
    const saved = await read.json();
    assert.equal(Object.keys(saved.screenings[0].rsvps).length, 2);
    assert.equal(saved.ownerHash, undefined);
    r = await request("/api/clubs/" + id, {
      type: "review",
      screeningId: screening.id,
      actor: "one",
      name: "one",
      score: 4,
      text: "Spoiler",
    });
    assert.equal(r.status, 409);
  },
);

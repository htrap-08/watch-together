import Redis from "ioredis";
import { randomBytes, createHash, timingSafeEqual, randomUUID } from "node:crypto";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const text = (value, max) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const publicClub = ({ ownerHash, ...club }) => club;
const validId = (id) => /^[a-zA-Z0-9_-]{20,32}$/.test(id);
let client;
function database() {
  if (!process.env.REDIS_URL) fail("Club storage is not configured.", 503);
  if (!client) {
    client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, connectTimeout: 5000 });
    client.on("error", () => {});
  }
  return client;
}
export function mutateClub(club, op, owner, now = Date.now()) {
  const name = text(op.name, 24);
  const actor = text(op.actor, 64);
  if (op.type === "film_add") {
    if (club.watchlist.length >= 50) fail("The shelf is full (50 films).");
    let url = text(op.url, 1000);
    if (url && !/^https?:\/\//i.test(url)) fail("Use a complete HTTP or HTTPS video or title URL.");
    if (url) {
      const parsed = new URL(url);
      if (parsed.username || parsed.password) fail("URLs cannot contain credentials.");
      parsed.hash = "";
      const video = parsed.searchParams.get("v");
      parsed.search = "";
      if (["youtube.com", "www.youtube.com"].includes(parsed.hostname) && video)
        parsed.searchParams.set("v", video);
      url = parsed.href;
    }
    const title = text(op.title, 120);
    if (!title) fail("Give the film a title.");
    if (club.watchlist.some((f) => f.title === title && f.url === url))
      fail("That film is already on the shelf.");
    club.watchlist.push({
      id: randomUUID(),
      title,
      url,
      source: op.source === "stream" ? "stream" : "direct",
      addedBy: name || "A friend",
      at: now,
    });
  } else if (op.type === "film_remove") {
    if (!owner) fail("Only the club host can remove films.", 403);
    club.watchlist = club.watchlist.filter((f) => f.id !== op.filmId);
  } else if (op.type === "schedule") {
    if (!owner) fail("Only the club host can schedule screenings.", 403);
    const film = club.watchlist.find((f) => f.id === op.filmId);
    if (!film) fail("Choose a film from the shelf.");
    const at = Number(op.at);
    if (!Number.isFinite(at) || at < now - 60000 || at > now + 366 * 86400000)
      fail("Choose a future time within the next year.");
    if (club.screenings.length >= 250)
      fail("This club has reached its 250-screening archive limit.");
    if (club.screenings.filter((s) => !s.completed).length >= 20)
      fail("You can have up to 20 upcoming screenings.");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const room = [...randomBytes(6)].map((b) => alphabet[b % alphabet.length]).join("");
    club.screenings.push({
      id: randomUUID(),
      film: { ...film },
      at,
      room,
      rsvps: {},
      completed: false,
      reviews: {},
    });
  } else if (op.type === "cancel") {
    if (!owner) fail("Only the club host can cancel screenings.", 403);
    club.screenings = club.screenings.filter((s) => s.id !== op.screeningId || s.completed);
  } else if (["rsvp", "complete", "review"].includes(op.type)) {
    const screening = club.screenings.find((s) => s.id === op.screeningId);
    if (!screening) fail("Screening not found.", 404);
    if (op.type === "complete") {
      if (!owner) fail("Only the club host can finish a scheduled screening.", 403);
      screening.completed = true;
      screening.completedAt = now;
    } else {
      if (!actor || !name) fail("Add your nickname.");
      if (op.type === "rsvp") {
        if (Object.keys(screening.rsvps).length >= 100 && !screening.rsvps[actor])
          fail("RSVP list is full.");
        if (!["yes", "maybe", "no"].includes(op.answer)) fail("Invalid RSVP.");
        screening.rsvps[actor] = { name, answer: op.answer };
      }
      if (op.type === "review") {
        if (!screening.completed) fail("Reviews open after the screening.", 409);
        const score = Number(op.score);
        if (!Number.isInteger(score) || score < 1 || score > 5)
          fail("Choose a rating from 1 to 5.");
        if (Object.keys(screening.reviews).length >= 100 && !screening.reviews[actor])
          fail("Review list is full.");
        screening.reviews[actor] = { name, score, text: text(op.text, 500), at: now };
      }
    }
  } else if (op.type === "rename") {
    if (!owner) fail("Only the club host can rename the club.", 403);
    const title = text(op.title, 60);
    if (!title) fail("Give the club a name.");
    club.name = title;
  } else fail("Unknown club action.");
  club.updatedAt = now;
  return club;
}
export async function clubsRequest(request) {
  const respond = (body, status = 200) =>
    Response.json(body, {
      status,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  try {
    const url = new URL(request.url);
    const id = url.pathname.match(/^\/api\/clubs\/([a-zA-Z0-9_-]+)$/)?.[1];
    if (request.method === "GET") {
      if (!id || !validId(id)) fail("Club not found.", 404);
      const raw = await database().get("watch:club:" + id);
      if (!raw) fail("Club not found.", 404);
      return respond(publicClub(JSON.parse(raw)));
    }
    if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);
    if (request.headers.get("origin") !== url.origin)
      fail("Open the club on this website to make changes.", 403);
    const data = await request.text();
    if (data.length > 8192) fail("Request too large.", 413);
    let op;
    try {
      op = JSON.parse(data);
    } catch {
      fail("Invalid request.");
    }
    const db = database();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const bucket =
      "watch:club-rate:" + hash(ip).slice(0, 20) + ":" + Math.floor(Date.now() / 60000);
    const calls = await db.incr(bucket);
    if (calls === 1) await db.expire(bucket, 120);
    if (calls > 60) fail("Too many changes. Try again in a minute.", 429);
    if (!id) {
      if (op.type !== "create") fail("Unknown club action.");
      const name = text(op.name, 60);
      if (!name) fail("Give your club a name.");
      const clubId = randomBytes(18).toString("base64url");
      const secret = randomBytes(32).toString("base64url");
      const club = {
        id: clubId,
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerHash: hash(secret),
        watchlist: [],
        screenings: [],
      };
      await db.set("watch:club:" + clubId, JSON.stringify(club));
      return respond({ ...publicClub(club), ownerSecret: secret }, 201);
    }
    if (!validId(id)) fail("Club not found.", 404);
    const key = "watch:club:" + id;
    for (let attempt = 0; attempt < 8; attempt++) {
      const prior = await db.get(key);
      if (!prior) fail("Club not found.", 404);
      const club = JSON.parse(prior);
      const candidate = hash(request.headers.get("x-club-owner") ?? "");
      const owner = timingSafeEqual(Buffer.from(candidate), Buffer.from(club.ownerHash));
      mutateClub(club, op, owner);
      const next = JSON.stringify(club);
      const success = await db.eval(
        "if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]);return 1 end return 0",
        1,
        key,
        prior,
        next,
      );
      if (success) return respond(publicClub(club));
    }
    fail("Club is busy. Please try again.", 409);
  } catch (error) {
    return respond(
      {
        error: error.status
          ? error.message
          : "Club storage is temporarily unavailable. Please retry.",
      },
      error.status ?? 503,
    );
  }
}

export async function closeClubDatabase() {
  if (client) {
    await client.quit();
    client = undefined;
  }
}

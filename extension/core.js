export const SERVICES = [
  {
    name: "Netflix",
    hosts: ["netflix.com"],
    selectors: [".watch-video video", "video"],
    ads: ["[data-uia='ad-countdown']", "[data-uia='ads-info']"],
  },
  {
    name: "YouTube",
    hosts: ["youtube.com", "youtu.be"],
    selectors: ["#movie_player video", "video"],
    ads: [".html5-video-player.ad-showing"],
  },
  {
    name: "Prime Video",
    hosts: [
      "primevideo.com",
      "amazon.com",
      "amazon.co.uk",
      "amazon.in",
      "amazon.de",
      "amazon.co.jp",
    ],
    selectors: [".webPlayerSDKContainer video", "video"],
    ads: [".atvwebplayersdk-adtimeindicator-text", "[data-testid='ad-countdown']"],
  },
  {
    name: "Disney+",
    hosts: ["disneyplus.com"],
    selectors: ["video"],
    ads: ["[data-testid='ad-countdown']"],
  },
  {
    name: "JioHotstar",
    hosts: ["hotstar.com", "jiohotstar.com"],
    selectors: ["video"],
    ads: ["[data-testid='ad-countdown']"],
  },
  {
    name: "Hulu",
    hosts: ["hulu.com"],
    selectors: ["video"],
    ads: [".ad-countdown", "[data-testid='ad-countdown']"],
  },
  {
    name: "Max / HBO Max",
    hosts: ["max.com", "hbomax.com"],
    selectors: ["video"],
    ads: ["[data-testid='ad-countdown']"],
  },
  { name: "Apple TV+", hosts: ["tv.apple.com"], selectors: ["video"], ads: [] },
  {
    name: "Paramount+",
    hosts: ["paramountplus.com"],
    selectors: ["video"],
    ads: [".ad-countdown"],
  },
  {
    name: "Crunchyroll",
    frameOrigins: ["https://static.crunchyroll.com/*"],
    hosts: ["crunchyroll.com"],
    selectors: ["video"],
    ads: [".ad-countdown"],
  },
  {
    name: "Vimeo",
    frameOrigins: ["https://player.vimeo.com/*"],
    hosts: ["vimeo.com"],
    selectors: ["video"],
    ads: [],
  },
];
export function serviceFor(url) {
  const host = new URL(url).hostname;
  return (
    SERVICES.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`))) ?? {
      name: "HTML5 video",
      hosts: [host],
      selectors: ["video"],
      ads: [],
    }
  );
}
export function cleanPageUrl(input) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Open a regular HTTP or HTTPS video page.");
  const video = url.searchParams.get("v");
  url.hash = "";
  url.search = "";
  if (["youtube.com", "www.youtube.com"].includes(url.hostname) && video)
    url.searchParams.set("v", video);
  return url.href;
}
export function relayUrl(input) {
  const url = new URL(input);
  if (
    !["ws:", "wss:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Use a ws:// or wss:// server URL without credentials or query parameters.");
  const local =
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
  if (url.protocol !== "wss:" && !local)
    throw new Error("Public servers must use wss://. ws:// is for local networks only.");
  return url.href;
}
export function expectedPosition(pb, serverNow) {
  return Math.max(0, pb.position + (pb.playing ? Math.max(0, serverNow - pb.at) / 1000 : 0));
}
export function correction(position, expected, playing) {
  const drift = position - expected;
  if (!playing || Math.abs(drift) > 1)
    return { seek: Math.abs(drift) > 0.15 ? expected : null, rate: 1 };
  return { seek: null, rate: Math.abs(drift) < 0.15 ? 1 : drift > 0 ? 0.94 : 1.06 };
}
export function parseSetup(
  value,
  server = "ws://localhost:3001",
  roomUrl = "http://localhost:3000",
) {
  let room = value.trim().toUpperCase();
  if (value.startsWith("wt1.")) {
    try {
      const raw = value.slice(4).replace(/-/g, "+").replace(/_/g, "/");
      const setup = JSON.parse(atob(raw));
      room = String(setup.room).toUpperCase();
      server = setup.relay;
      roomUrl = setup.roomUrl;
    } catch {
      throw new Error("This setup code is invalid. Copy it again from your room.");
    }
  } else if (/^https?:\/\//i.test(value.trim())) {
    const url = new URL(value.trim());
    room = url.pathname.match(/^\/room\/([a-z0-9]{6})\/?$/i)?.[1]?.toUpperCase() ?? "";
    roomUrl = url.href;
  }
  if (!/^[A-Z0-9]{6}$/.test(room))
    throw new Error("Enter a six-character room code or paste the room setup.");
  const url = new URL(roomUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid room website URL.");
  const club = url.searchParams.get("club"),
    screening = url.searchParams.get("screening");
  url.pathname = `/room/${room}`;
  url.search = "watch=stream";
  if (club && /^[a-zA-Z0-9_-]{20,32}$/.test(club)) url.searchParams.set("club", club);
  if (screening && /^[a-zA-Z0-9-]{1,64}$/.test(screening))
    url.searchParams.set("screening", screening);
  url.hash = "";
  return { room, relay: relayUrl(server), roomUrl: url.href };
}

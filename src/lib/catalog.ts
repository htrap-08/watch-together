export type Movie = {
  id: string;
  title: string;
  year: number;
  genres: string[];
  category: "Short films" | "Trailers";
  minutes: number;
  rating: number;
  mood: string;
  description: string;
  src: string;
  thumb: string;
};

// Open films from the Blender Foundation and official W3C media demonstrations.
// Legacy IDs remain resolvable for existing rooms; these are never suggested.
const CATALOG: Movie[] = [
  {
    id: "bbb",
    title: "Big Buck Bunny",
    year: 2008,
    genres: ["Animation", "Comedy", "Family"],
    category: "Short films",
    minutes: 10,
    rating: 7.4,
    mood: "Cozy",
    description: "A gentle giant rabbit takes revenge on three bullying rodents.",
    src: "https://media.w3.org/2010/05/bunny/movie.mp4",
    thumb: "/posters/bunny.png",
  },
  {
    id: "sintel",
    title: "Sintel — Trailer",
    year: 2010,
    genres: ["Animation", "Fantasy", "Adventure"],
    category: "Trailers",
    minutes: 1,
    rating: 7.5,
    mood: "Epic",
    description: "A first look at a girl's journey to find the dragon she raised.",
    src: "https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4",
    thumb: "/posters/sintel.png",
  },
  {
    id: "tos",
    title: "Tears of Steel",
    year: 2012,
    genres: ["Sci-Fi", "Action"],
    category: "Short films",
    minutes: 12,
    rating: 6.3,
    mood: "Intense",
    description:
      "Warriors and scientists try to save the world from destructive robots in Amsterdam.",
    src: "https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov",
    thumb: "/posters/steel.svg",
  },
  {
    id: "bbb-trailer",
    title: "Big Buck Bunny — Trailer",
    year: 2008,
    genres: ["Animation", "Comedy"],
    category: "Trailers",
    minutes: 1,
    rating: 7.4,
    mood: "Cozy",
    description: "A quick taste of a very big rabbit's very bad day.",
    src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    thumb: "/posters/bunny.png",
  },
];

/** Resolve a catalog id or a raw media URL into something playable. */
export function resolveVideo(id: string | null): Movie | null {
  if (!id) return null;
  const found = CATALOG.find((x) => x.id === id);
  if (found) return found;
  if (/^https?:\/\//.test(id)) {
    let filename = new URL(id).pathname.split("/").pop() || "Custom video";
    try {
      filename = decodeURIComponent(filename);
    } catch {
      /* Keep a malformed filename readable. */
    }
    const name = filename.replace(/\.[a-z0-9]+$/i, "");
    return {
      id,
      title: name || "Custom video",
      year: 0,
      genres: [],
      category: "Trailers",
      minutes: 0,
      rating: 0,
      mood: "",
      description: "Shared from a link",
      src: id,
      thumb: "",
    };
  }
  return null;
}

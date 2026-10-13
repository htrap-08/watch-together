import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Crown,
  Expand,
  Film,
  ListPlus,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Send,
  SkipForward,
  ThumbsUp,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  Vote,
} from "lucide-react";
import { CATALOG, CATEGORIES, recommend, resolveVideo } from "@/lib/catalog";
import { fuzzyScore } from "@/lib/fuzzy";
import { loadMe, saveMe } from "@/lib/identity";
import { useRoom, type Me } from "@/lib/room-engine";
import { correctionFor, expectedPosition, shouldBePlaying } from "@/lib/sync";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — Watch Together` },
      {
        name: "description",
        content: "Your movie night with synchronized playback and live chat.",
      },
    ],
  }),
  component: Room,
});
const formatTime = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;

function Room() {
  const { code } = Route.useParams();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  useEffect(() => setMe(loadMe()), []);
  const room = useRoom(code, me);
  const v = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const initialLoaded = useRef(false);
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"chat" | "queue" | "people" | "poll">("chat");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All films");
  const [mediaUrl, setMediaUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [needsPlay, setNeedsPlay] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("");
  const movie = resolveVideo(room.state.playback.videoId);

  useEffect(() => {
    if (!room.ready || !room.isHost || initialLoaded.current) return;
    initialLoaded.current = true;
    if (room.state.playback.videoId) return;
    const first = sessionStorage.getItem("watchparty:first-video");
    sessionStorage.removeItem("watchparty:first-video");
    if (first && CATALOG.some((film) => film.id === first)) room.api.load(first);
  }, [room.ready, room.isHost, room.state.playback.videoId, room.api]);

  useEffect(() => {
    const id = setInterval(() => {
      const el = v.current;
      const pb = room.state.playback;
      const vid = resolveVideo(pb.videoId);
      if (!el || !vid) return;
      if (el.src !== vid.src) {
        el.src = vid.src;
        setMediaError("");
        setNeedsPlay(false);
        return;
      }
      const now = room.hostNow();
      const exp = expectedPosition(pb, now);
      const playing = shouldBePlaying(pb, now);
      if (playing && el.paused)
        void el
          .play()
          .then(() => setNeedsPlay(false))
          .catch(() => setNeedsPlay(true));
      if (!playing && !el.paused) el.pause();
      if (el.readyState < 2) return;
      const c = correctionFor(el.currentTime, exp);
      if (c.kind === "seek") el.currentTime = c.target;
      el.playbackRate = c.rate;
      room.driftRef.current = el.currentTime - exp;
    }, 250);
    return () => clearInterval(id);
  });
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [room.state.chat.length, tab]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const invite = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setNotice("Invite link copied. Send it to your friends.");
    } catch {
      setNotice(`Share this room code: ${code}`);
    }
  };
  if (!me)
    return (
      <main className="join-page">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Play size={18} fill="currentColor" />
          </span>
          watchtogether.
        </Link>
        <form
          className="join-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setMe(saveMe(name));
          }}
        >
          <span className="join-icon">
            <Users size={28} />
          </span>
          <p className="eyebrow">THERE’S A SEAT FOR YOU</p>
          <h1>Join the movie night.</h1>
          <p>
            You’re joining room <b>{code}</b>. Pick a nickname so your friends know it’s you.
          </p>
          <label htmlFor="guest-name">Your nickname</label>
          <input
            id="guest-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="e.g. Popcorn enthusiast"
            required
          />
          <button className="action-primary" type="submit">
            Take your seat <ArrowRight size={18} />
          </button>
          <Link to="/" className="text-link">
            <ArrowLeft size={14} /> Back home
          </Link>
        </form>
      </main>
    );

  const s = room.state;
  const connected = room.status === "live" && room.ready;
  const controls = connected && room.canControl && !!movie;
  const films = CATALOG.map((film) => ({
    film,
    score: fuzzyScore(query, [film.title, ...film.genres, film.mood]),
  }))
    .filter(
      ({ film, score }) => score > 0 && (category === "All films" || film.category === category),
    )
    .sort((a, b) => b.score - a.score);
  const picks = recommend(
    [...s.history, ...s.queue.map((q) => q.videoId)],
    new Set([s.playback.videoId ?? ""]),
    3,
  );
  return (
    <main className="room-page">
      <header className="room-header">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Play size={18} fill="currentColor" />
          </span>
          watch<span className="brand-light">together</span>.
        </Link>
        <div className="room-header-info">
          <span className={`connection ${connected ? "" : "offline"}`}>
            <i /> {connected ? "Room live" : room.status === "live" ? "Getting ready" : room.status}
          </span>
          <span className="room-code">{code}</span>
        </div>
        <button className="action-primary invite-button" onClick={() => void invite()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
          {copied ? "Link copied" : "Invite friends"}
        </button>
      </header>
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <div className="room-layout">
        <section className="watch-column">
          <div className="room-title">
            <div>
              <p className="eyebrow">WATCH TOGETHER / SCREENING ROOM</p>
              <h1>Movie night</h1>
            </div>
            <span>
              <Users size={16} /> {room.members.length} watching
            </span>
          </div>
          <div ref={screen} className="player-screen">
            <video
              ref={v}
              playsInline
              poster={movie?.thumb || undefined}
              onTimeUpdate={() => setTime(v.current?.currentTime ?? 0)}
              onDurationChange={() =>
                setDuration(Number.isFinite(v.current?.duration) ? v.current!.duration : 0)
              }
              onError={() =>
                setMediaError("This video couldn’t load. Try another film or check the video link.")
              }
              onEnded={() => {
                if (room.canControl) {
                  room.api.pause();
                  if (s.queue.length) room.api.playNext();
                }
              }}
            />
            {!movie && (
              <div className="player-empty">
                <span>
                  <Film size={34} />
                </span>
                <h2>The night starts here.</h2>
                <p>Choose a film below or add a direct video link.</p>
                <a href="#room-discover" className="action-primary">
                  Find something to watch <ChevronRight size={17} />
                </a>
              </div>
            )}
            {movie && (
              <span className="player-badge">
                <Radio size={12} /> Shared playback
              </span>
            )}
            {mediaError && (
              <div className="player-message" role="alert">
                <p>{mediaError}</p>
                <button
                  onClick={() => {
                    v.current?.load();
                    setMediaError("");
                  }}
                  className="action-secondary"
                >
                  Retry video
                </button>
              </div>
            )}
            {needsPlay && !mediaError && (
              <button
                className="enable-play"
                onClick={() => {
                  void v.current
                    ?.play()
                    .then(() => setNeedsPlay(false))
                    .catch(() =>
                      setNotice("Your browser blocked playback. Try the play button again."),
                    );
                }}
              >
                <Play size={25} fill="currentColor" /> Click to enable playback
              </button>
            )}
            {room.floats.map((f) => (
              <span
                key={f.id}
                className="floating-reaction animate-float-up"
                style={{ left: `${f.x}%` }}
              >
                {f.emoji}
              </span>
            ))}
          </div>
          <div className="player-controls">
            <div className="control-row">
              <button
                className="play-control"
                aria-label={s.playback.playing ? "Pause for everyone" : "Play for everyone"}
                disabled={!controls}
                onClick={() => (s.playback.playing ? room.api.pause() : room.api.play())}
              >
                {s.playback.playing ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
              </button>
              <button
                className="time-jump"
                disabled={!controls}
                onClick={() => room.api.seek(Math.max(0, time - 10))}
              >
                −10
              </button>
              <button
                className="time-jump"
                disabled={!controls}
                onClick={() => room.api.seek(time + 10)}
              >
                +10
              </button>
              <span className="time-label">
                {formatTime(time)} <i>/ {formatTime(duration)}</i>
              </span>
              <div className="control-spacer" />
              <button
                className="countdown-control"
                disabled={!controls}
                onClick={() => room.api.countdownPlay()}
              >
                3 · 2 · 1 start
              </button>
              <button
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  if (v.current) v.current.muted = next;
                }}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button
                aria-label="Full screen"
                onClick={() => {
                  void screen.current
                    ?.requestFullscreen()
                    .catch(() => setNotice("Full screen is unavailable in this browser."));
                }}
              >
                <Expand size={18} />
              </button>
            </div>
            <input
              className="video-progress"
              type="range"
              aria-label="Seek for everyone"
              min={0}
              max={duration || 1}
              step={0.1}
              value={Math.min(time, duration || 1)}
              disabled={!controls || !duration}
              onChange={(e) => room.api.seek(Number(e.target.value))}
            />
          </div>
          <div className="now-watching">
            <div>
              <p className="eyebrow">{movie ? "NOW WATCHING" : "THE SCREEN IS YOURS"}</p>
              <h2>{movie?.title ?? "Pick the opening act"}</h2>
              <p>
                {movie
                  ? `${movie.genres.join(" · ") || "Shared video"}${movie.minutes ? ` · ${movie.minutes} min` : ""}`
                  : "A film, your friends, and nowhere else to be."}
              </p>
            </div>
            <div className="reactions" aria-label="Send a reaction">
              {["😂", "😱", "🔥", "❤️", "👏"].map((emoji) => (
                <button
                  key={emoji}
                  disabled={!movie || !connected}
                  aria-label={`React ${emoji}`}
                  onClick={() => room.api.react(emoji, time)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          {!room.canControl && (
            <p className="host-note">
              <Crown size={14} /> The host controls playback. You can still chat, react, and add to
              the queue.
            </p>
          )}
          <section className="room-discovery" id="room-discover">
            <div className="discovery-heading">
              <div>
                <p className="eyebrow">THE SHORTLIST</p>
                <h2>Find your next watch</h2>
              </div>
              <label className="search-field">
                <Search size={16} />
                <input
                  aria-label="Search films"
                  placeholder="Search films, genres…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="category-tabs" aria-label="Film category">
              {["All films", ...CATEGORIES].map((c) => (
                <button
                  key={c}
                  aria-pressed={c === category}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="room-film-grid">
              {films.map(({ film }) => (
                <article className="room-film" key={film.id}>
                  <div className="room-film-image">
                    <img src={film.thumb} alt="" loading="lazy" />
                    <span>{film.minutes} min</span>
                    <button
                      disabled={!connected || !room.canControl}
                      className="film-play"
                      aria-label={`Play ${film.title}`}
                      onClick={() => room.api.load(film.id)}
                    >
                      <Play size={18} fill="currentColor" />
                    </button>
                  </div>
                  <div className="room-film-copy">
                    <div>
                      <h3>{film.title}</h3>
                      <p>{film.genres.slice(0, 2).join(" · ")}</p>
                    </div>
                    <button
                      disabled={!connected}
                      aria-label={`Queue ${film.title}`}
                      onClick={() => {
                        room.api.enqueue(film.id);
                        setNotice(`${film.title} added to the queue`);
                      }}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!films.length && (
              <p className="empty-results">No films found. Try another title or category.</p>
            )}
            <form
              className="video-link-form"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const url = new URL(mediaUrl);
                  if (!["http:", "https:"].includes(url.protocol)) throw new Error();
                  room.api.enqueue(url.href);
                  setMediaUrl("");
                  setTab("queue");
                  setNotice("Video link added to the queue.");
                } catch {
                  setNotice("Enter a complete HTTP or HTTPS video URL.");
                }
              }}
            >
              <div>
                <b>Bring your own video</b>
                <p>Direct MP4 or WebM links work here. Streaming-service page links don’t.</p>
              </div>
              <div>
                <input
                  type="url"
                  aria-label="Direct video URL"
                  placeholder="https://…/video.mp4"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  required
                />
                <button className="action-secondary" disabled={!connected} type="submit">
                  <Plus size={16} /> Add
                </button>
              </div>
            </form>
          </section>
        </section>
        <aside className="party-sidebar">
          <div className="sidebar-heading">
            <span>
              <span className="live-dot" /> THE PARTY
            </span>
            <span>{room.members.length} online</span>
          </div>
          <div className="sidebar-tabs" role="tablist" aria-label="Room sidebar">
            {(
              [
                { key: "chat", icon: MessageCircle, label: "Chat" },
                { key: "queue", icon: ListPlus, label: "Queue" },
                { key: "people", icon: Users, label: "People" },
                { key: "poll", icon: Vote, label: "Poll" },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                role="tab"
                aria-selected={tab === key}
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                <Icon size={16} />
                {label}
                {key === "queue" && s.queue.length > 0 && <small>{s.queue.length}</small>}
              </button>
            ))}
          </div>
          {tab === "chat" && (
            <>
              <div className="chat-feed">
                <div className="chat-welcome">
                  <span>🍿</span>
                  <h3>The conversation starts here.</h3>
                  <p>Say hello to the room.</p>
                </div>
                {s.chat.map((msg) =>
                  msg.system ? (
                    <p key={msg.id} className="system-message">
                      {msg.text}
                    </p>
                  ) : (
                    <div
                      key={msg.id}
                      className={`chat-message ${msg.userId === me.id ? "mine" : ""}`}
                    >
                      <span className="user-avatar" style={{ backgroundColor: msg.color }}>
                        {msg.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="message-meta">
                          <b>{msg.name}</b>
                          <time>
                            {new Date(msg.at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  ),
                )}
                <div ref={chatEnd} />
              </div>
              <form
                className="chat-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  room.api.chat(text);
                  setText("");
                }}
              >
                <input
                  aria-label="Chat message"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a message…"
                  maxLength={500}
                />
                <button
                  aria-label="Send message"
                  disabled={!text.trim() || !connected}
                  type="submit"
                >
                  <Send size={18} />
                </button>
              </form>
              <p className="chat-footnote">Be kind. Don’t spoil the ending.</p>
            </>
          )}
          {tab === "queue" && (
            <div className="sidebar-content">
              <h3>
                Up next <span>{s.queue.length}</span>
              </h3>
              <p className="sidebar-description">
                Vote for your favorite. The most popular pick plays next.
              </p>
              {!s.queue.length && (
                <div className="sidebar-empty">
                  <ListPlus size={30} />
                  <h4>Your double feature starts here.</h4>
                  <p>Tap + on a film to add it to the shared queue.</p>
                </div>
              )}
              {[...s.queue]
                .sort((a, b) => b.votes.length - a.votes.length)
                .map((item) => {
                  const film = resolveVideo(item.videoId);
                  return (
                    <div className="queue-item" key={item.uid}>
                      <span className="queue-thumb">
                        {film?.thumb ? <img src={film.thumb} alt="" /> : <Film size={20} />}
                      </span>
                      <div>
                        <b>{film?.title ?? "Video"}</b>
                        <small>Added by {item.addedBy}</small>
                        <button
                          className={item.votes.includes(me.id) ? "voted" : ""}
                          onClick={() => room.api.voteQueue(item.uid)}
                          aria-label={`Vote for ${film?.title}`}
                        >
                          <ThumbsUp size={12} /> {item.votes.length}
                        </button>
                      </div>
                      <button
                        aria-label={`Remove ${film?.title} from queue`}
                        onClick={() => room.api.removeQueue(item.uid)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              <button
                className="action-primary full-width"
                disabled={!s.queue.length || !room.canControl || !connected}
                onClick={() => room.api.playNext()}
              >
                <SkipForward size={16} /> Play next
              </button>
              <h4 className="picks-heading">A few ideas for the room</h4>
              {picks.map((film) => (
                <button
                  className="suggested-pick"
                  disabled={!connected}
                  key={film.id}
                  onClick={() => room.api.enqueue(film.id)}
                >
                  <span>
                    {film.title}
                    <small>
                      {film.mood} · {film.minutes} min
                    </small>
                  </span>
                  <Plus size={16} />
                </button>
              ))}
            </div>
          )}
          {tab === "people" && (
            <div className="sidebar-content">
              <h3>Your people</h3>
              <p className="sidebar-description">Different screens. One room.</p>
              {room.members.map((member) => (
                <div className="member-row" key={member.id}>
                  <span className="user-avatar" style={{ backgroundColor: member.color }}>
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <b>
                      {member.name}
                      {member.id === me.id ? " (you)" : ""}
                    </b>
                    <small>
                      {member.id === s.hostId ? "Hosting tonight" : "Here for the movie"}
                    </small>
                  </div>
                  {member.id === s.hostId ? (
                    <Crown size={17} className="host-crown" />
                  ) : (
                    room.isHost && (
                      <button
                        className="pass-remote"
                        onClick={() => room.api.transferHost(member.id)}
                        aria-label={`Make ${member.name} host`}
                      >
                        Host
                      </button>
                    )
                  )}
                </div>
              ))}
              {room.isHost && (
                <label className="host-setting">
                  Playback control
                  <select
                    aria-label="Playback control"
                    value={s.controlMode}
                    onChange={(e) => room.api.setMode(e.target.value as "host" | "all")}
                  >
                    <option value="all">Everyone can control</option>
                    <option value="host">Host only</option>
                  </select>
                </label>
              )}
              <button className="action-secondary full-width" onClick={() => void invite()}>
                <Copy size={15} /> Copy invite link
              </button>
            </div>
          )}
          {tab === "poll" && (
            <div className="sidebar-content">
              <h3>Let the room decide</h3>
              <p className="sidebar-description">Settle the important questions together.</p>
              {s.poll && (
                <div className="room-poll">
                  <h4>{s.poll.question}</h4>
                  {s.poll.options.map((option, i) => (
                    <button
                      key={i}
                      disabled={s.poll?.closed || !connected}
                      className={option.votes.includes(me.id) ? "selected" : ""}
                      onClick={() => room.api.votePoll(i)}
                    >
                      <span>{option.text}</span>
                      <b>{option.votes.length}</b>
                    </button>
                  ))}
                  {s.poll.closed ? (
                    <small>Voting closed</small>
                  ) : (
                    (s.poll.by === me.id || room.isHost) && (
                      <button className="text-link" onClick={() => room.api.closePoll()}>
                        Close voting
                      </button>
                    )
                  )}
                </div>
              )}
              <form
                className="poll-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const choices = options
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  if (choices.length < 2) {
                    setNotice("Add at least two poll options, one per line.");
                    return;
                  }
                  room.api.createPoll(question.trim(), choices.slice(0, 6));
                  setQuestion("");
                  setOptions("");
                }}
              >
                <label htmlFor="poll-question">Ask the room</label>
                <input
                  id="poll-question"
                  placeholder="What should we watch next?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={120}
                  required
                />
                <label htmlFor="poll-options">Options · one per line</label>
                <textarea
                  id="poll-options"
                  placeholder={"Something funny\nSomething thrilling"}
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  maxLength={500}
                  required
                />
                <button
                  className="action-primary full-width"
                  disabled={!connected || (!!s.poll && !s.poll.closed)}
                  type="submit"
                >
                  <Vote size={16} /> Start a vote
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>
      <footer className="room-footer">
        <Link to="/">
          <ArrowLeft size={14} /> Leave room
        </Link>
        <span>watchtogether / by Parth</span>
        <Link to="/docs">About the sync</Link>
      </footer>
    </main>
  );
}

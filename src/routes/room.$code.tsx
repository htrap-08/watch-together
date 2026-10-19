import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Crown,
  Expand,
  Monitor,
  Film,
  ListPlus,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Radio,
  Send,
  SkipForward,
  ThumbsUp,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  Vote,
} from "lucide-react";
import { resolveVideo } from "@/lib/catalog";
import { DirectVideoForm } from "@/components/direct-video-form";
import { videoLoadError } from "@/lib/direct-video";
import { ScreenSharePanel } from "@/components/screen-share-panel";
import { loadMe, saveMe } from "@/lib/identity";
import { useRoom, type Me } from "@/lib/room-engine";
import { syncPlayer } from "@/lib/player-sync";
import { RoomDiagnostics } from "@/components/room-diagnostics";
import {
  ReadyLobby,
  RoomRecovery,
  ScreeningActions,
  AfterCredits,
} from "@/components/room-features";
import { RoomClub } from "@/components/room-club";
import { useClub, clubAction } from "@/lib/clubs";
import { StreamingPanel } from "@/components/streaming-panel";

export const Route = createFileRoute("/room/$code")({
  validateSearch: (search): { watch?: "stream" | "share"; club?: string; screening?: string } => ({
    ...(search["watch"] === "stream" || search["watch"] === "share"
      ? { watch: search["watch"] as "stream" | "share" }
      : {}),
    ...(typeof search["club"] === "string" && /^[a-zA-Z0-9_-]{20,32}$/.test(search["club"])
      ? { club: search["club"] }
      : {}),
    ...(typeof search["screening"] === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(search["screening"])
      ? { screening: search["screening"] }
      : {}),
  }),
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
  const { watch, club: clubId, screening: screeningId } = Route.useSearch();
  const { club, error: clubError, setClub } = useClub(clubId);
  const scheduled = club?.screenings.find((item) => item.id === screeningId);
  const nav = useNavigate();
  const watchMode = watch === "stream" ? "stream" : watch === "share" ? "share" : "direct";
  const setWatchMode = (mode: "direct" | "stream" | "share") => {
    void nav({
      to: "/room/$code",
      params: { code },
      search: {
        ...(clubId ? { club: clubId } : {}),
        ...(screeningId ? { screening: screeningId } : {}),
        ...(mode !== "direct" ? { watch: mode } : {}),
      },
      replace: true,
    });
  };
  const [streamingPlaying, setStreamingPlaying] = useState(false);
  const [theatre, setTheatre] = useState(false);
  const [chatView, setChatView] = useState<"always" | "paused" | "hidden">("always");
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
    const element = v.current;
    return () => {
      element?.pause();
    };
  }, [watchMode]);

  useEffect(() => {
    if (watchMode !== "direct" || !room.ready || !room.isHost || initialLoaded.current) return;
    if (clubId && screeningId && !scheduled) return;
    initialLoaded.current = true;
    if (room.state.playback.videoId) return;
    if (scheduled?.film.source === "direct") {
      room.api.load(scheduled.film.url);
      return;
    }
    sessionStorage.removeItem("watchparty:first-video");
  }, [
    room.ready,
    room.isHost,
    room.state.playback.videoId,
    room.api,
    watchMode,
    scheduled,
    clubId,
    screeningId,
  ]);

  useEffect(() => {
    if (watchMode !== "direct") {
      v.current?.pause();
      room.api.setPlayerStatus("Separate playback — choose video links to join this player");
      return;
    }
    const id = setInterval(() => {
      const el = v.current;
      const pb = room.state.playback;
      const vid = resolveVideo(pb.videoId);
      if (!el || !vid) return;
      if (el.src !== vid.src) {
        el.src = vid.src;
        room.api.setPlayerStatus("Loading player");
        setMediaError("");
        setNeedsPlay(false);
        return;
      }
      const observation = syncPlayer(el, pb, room.hostNow(), setNeedsPlay);
      if (observation) {
        room.driftRef.current = observation.actual - observation.expected;
        room.api.observePlayer(
          observation.actual,
          observation.expected,
          observation.applied,
          observation.sampleable,
        );
      }
    }, 50);
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
      const inviteUrl = new URL(location.href);
      if (watchMode !== "direct") inviteUrl.searchParams.set("watch", watchMode);
      else inviteUrl.searchParams.delete("watch");
      await navigator.clipboard.writeText(inviteUrl.href);
      setCopied(true);
      setNotice("Invite link copied. Send it to your friends.");
    } catch {
      setNotice(`Share this room code: ${code}`);
    }
  };
  if (!me)
    return (
      <main className="join-page club-join">
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
          <h1>Take your seat.</h1>
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
  return (
    <main
      className={`room-page club-room ${theatre ? "theatre-mode" : ""} ${chatView === "hidden" || (chatView === "paused" && (watchMode === "stream" ? streamingPlaying : room.state.playback.playing)) ? "chat-hidden" : ""}`}
    >
      <header className="room-header">
        <Link to="/" className="club-wordmark">
          watch <em>together</em>
          <span aria-hidden="true">✳</span>
        </Link>
        <div className="theatre-tools">
          <button
            className="feature-button"
            aria-pressed={theatre}
            onClick={() => setTheatre((value) => !value)}
          >
            <Monitor size={14} />
            {theatre ? "Exit theatre" : "Theatre mode"}
          </button>
          <select
            aria-label="Chat visibility"
            value={chatView}
            onChange={(event) => setChatView(event.target.value as typeof chatView)}
          >
            <option value="always">Keep chat open</option>
            <option value="paused">Chat when paused</option>
            <option value="hidden">Hide chat</option>
          </select>
        </div>
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
      <RoomRecovery room={room} />
      {clubError && (
        <p role="alert" className="feature-recovery">
          {clubError}
        </p>
      )}
      {club && (
        <RoomClub
          club={club}
          screening={scheduled}
          ended={room.state.ended && (!scheduled || movie?.src === scheduled.film.url)}
          onUpdate={setClub}
        />
      )}
      <div className="room-layout">
        <section className="watch-column">
          <div className="room-title">
            <div>
              <h1>The screening room</h1>
            </div>
            <span>
              <Users size={16} /> {room.members.length}{" "}
              {watchMode === "stream" ? "here" : "watching"}
            </span>
          </div>
          <div className="watch-mode-tabs" role="tablist" aria-label="Where to watch">
            <button
              role="tab"
              aria-selected={watchMode === "share"}
              onClick={() => setWatchMode("share")}
            >
              Screen share
            </button>
            <button
              role="tab"
              aria-selected={watchMode === "direct"}
              onClick={() => setWatchMode("direct")}
            >
              Video link
            </button>
            <button
              role="tab"
              aria-selected={watchMode === "stream"}
              onClick={() => setWatchMode("stream")}
            >
              Streaming service
            </button>
          </div>
          {watchMode !== "direct" && (
            <div className="cross-mode-reactions">
              <div className="reactions" aria-label="Send a reaction">
                {["😂", "😱", "🔥", "❤️", "👏"].map((emoji) => (
                  <button
                    key={emoji}
                    disabled={!connected}
                    aria-label={`React ${emoji}`}
                    onClick={() => room.api.react(emoji, 0, watchMode)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="reaction-messages" aria-live="polite">
                {room.floats.map((f) => (
                  <span key={f.id}>
                    {f.name}: {f.emoji}
                  </span>
                ))}
              </div>
            </div>
          )}
          {watchMode === "share" ? (
            <ScreenSharePanel code={code} id={me.id} isHost={room.isHost} connected={connected} />
          ) : watchMode === "stream" ? (
            <StreamingPanel code={code} id={me.id} name={me.name} onPlaying={setStreamingPlaying} />
          ) : (
            <>
              <ReadyLobby room={room} me={me} />
              <div ref={screen} className="player-screen">
                <video
                  ref={v}
                  playsInline
                  poster={movie?.thumb || undefined}
                  onTimeUpdate={() => setTime(v.current?.currentTime ?? 0)}
                  onDurationChange={() =>
                    setDuration(Number.isFinite(v.current?.duration) ? v.current!.duration : 0)
                  }
                  onCanPlay={() => room.api.setPlayerStatus("Player connected")}
                  onError={() => {
                    room.api.setPlayerStatus("Player could not load");
                    setMediaError(videoLoadError(v.current?.error?.code));
                  }}
                  onEnded={() => {
                    room.api.finish();
                  }}
                />
                {!movie && (
                  <div className="player-empty">
                    <span>
                      <Film size={34} />
                    </span>
                    <h2>What are we watching?</h2>
                    <p>Load a public video file link, then start together.</p>
                    <a
                      href="#room-discover"
                      className="action-primary"
                      onClick={() =>
                        document
                          .querySelector<HTMLDetailsElement>("#room-discover")
                          ?.setAttribute("open", "")
                      }
                    >
                      Add a video link <ChevronRight size={17} />
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
                    disabled={
                      !controls ||
                      !!s.intermission ||
                      (!s.started && (!room.allReady || !room.isHost)) ||
                      s.ended
                    }
                    onClick={() =>
                      s.playback.playing
                        ? room.api.pause()
                        : !s.started
                          ? room.api.startScreening()
                          : room.api.play()
                    }
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
                  {s.started && !s.intermission && !s.ended && (
                    <button
                      className="countdown-control"
                      disabled={!controls}
                      onClick={() => room.api.countdownPlay()}
                    >
                      3 · 2 · 1 start
                    </button>
                  )}
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
                  <Crown size={14} /> The host controls playback. You can still chat, react, and add
                  to the queue.
                </p>
              )}
              <ScreeningActions room={room} />
              <AfterCredits
                room={room}
                me={me}
                onSave={
                  scheduled && club && movie?.src === scheduled.film.url
                    ? async (score, text) => {
                        await clubAction(club.id, {
                          type: "review",
                          screeningId: scheduled.id,
                          name: me.name,
                          score,
                          text,
                        });
                      }
                    : undefined
                }
              />
              <RoomDiagnostics room={room} code={code} />
              <details className="room-library" id="room-discover">
                <summary>
                  Add your own video <Plus size={16} />
                </summary>
                <section className="room-discovery">
                  <DirectVideoForm
                    connected={connected}
                    loadFirst={room.canControl && !movie}
                    onAdd={(url) => {
                      if (room.canControl && !room.state.playback.videoId) {
                        room.api.load(url);
                        setNotice("Video loaded. Mark ready, then start together.");
                      } else {
                        room.api.enqueue(url);
                        setTab("queue");
                        setNotice("Video added. The host can choose Play next in the queue.");
                      }
                    }}
                  />
                </section>
              </details>
            </>
          )}
        </section>
        <aside className="party-sidebar">
          <div className="sidebar-heading">
            <span>Your company</span>
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
            ).map(({ key, label }) => (
              <button
                role="tab"
                aria-selected={tab === key}
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                {label}
                {key === "queue" && s.queue.length > 0 && <small>{s.queue.length}</small>}
              </button>
            ))}
          </div>
          {tab === "chat" && (
            <>
              <div className="chat-feed">
                {s.chat.every((message) => message.system) && (
                  <div className="chat-welcome">
                    <h3>The lights are down.</h3>
                    <p>Say hello while everyone settles in.</p>
                  </div>
                )}
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
          {tab === "queue" &&
            (watchMode === "stream" ? (
              <div className="sidebar-content">
                <h3>Choose on your service</h3>
                <p className="sidebar-description">
                  Use chat or a poll to choose the next title. The streaming host opens it on the
                  service; viewers then click “Open the host’s video” in the extension.
                </p>
                <Link to="/streaming" className="text-link">
                  Streaming help →
                </Link>
              </div>
            ) : (
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
              </div>
            ))}
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

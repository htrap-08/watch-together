import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { checkDirectVideo, directVideoUrl } from "@/lib/direct-video";

export function DirectVideoForm({
  connected,
  onAdd,
  loadFirst,
}: {
  connected: boolean;
  onAdd: (url: string) => void;
  loadFirst: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const latest = useRef({ connected, onAdd });
  latest.current = { connected, onAdd };
  useEffect(() => () => pending.current?.abort(), []);
  return (
    <form
      className="video-link-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (checking || !connected) return;
        setError("");
        const controller = new AbortController();
        pending.current = controller;
        try {
          const url = directVideoUrl(value);
          setChecking(true);
          await checkDirectVideo(url, controller.signal);
          if (controller.signal.aborted) return;
          if (!latest.current.connected)
            throw new Error("The room disconnected. Reconnect and add the video again.");
          latest.current.onAdd(url);
          setValue("");
        } catch (reason) {
          if (!controller.signal.aborted)
            setError(reason instanceof Error ? reason.message : "Could not check this video.");
        } finally {
          if (!controller.signal.aborted) setChecking(false);
        }
      }}
    >
      <div>
        <b>Bring your own video</b>
        <p id="direct-video-help">
          Paste a public MP4 or WebM file URL. Everyone loads the same file; no extension needed.
          YouTube, Netflix and cloud preview pages belong in the other viewing modes.
        </p>
        {error && <p role="alert">{error}</p>}
        {checking && <p role="status">Checking that the video can play…</p>}
      </div>
      <div>
        <input
          type="url"
          aria-label="Direct video URL"
          aria-describedby="direct-video-help"
          aria-invalid={!!error}
          placeholder="https://…/video.mp4"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          disabled={checking}
          required
        />
        <button className="action-secondary" disabled={!connected || checking} type="submit">
          <Plus size={16} />
          {checking ? "Checking…" : loadFirst ? "Load video" : "Add to queue"}
        </button>
      </div>
    </form>
  );
}

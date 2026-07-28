import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { Check, Link2 } from "lucide-react";
import { HlsTimelinePanel } from "./hlsTimeline/HlsTimelinePanel";
import { VideoPlayer } from "./VideoPlayer";
import styles from "./App.module.css";

// const SAMPLE_STREAM =
//   "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8";
const SAMPLE_STREAM =
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/adv_dv_atmos/main.m3u8";

function isLikelyValidUrl(value: string): boolean {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

function App() {
  const inputId = useId();
  const [urlInput, setUrlInput] = useState("");
  const [streamSrc, setStreamSrc] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [playerKey, setPlayerKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const playerRef = useRef<MuxPlayerRefAttributes>(null);

  const loadStream = useCallback((rawUrl: string) => {
    const trimmed = rawUrl.trim();

    if (!trimmed) {
      setFormError("Please enter an .m3u8 URL first.");
      return;
    }

    if (!isLikelyValidUrl(trimmed)) {
      setFormError(
        "That doesn't look like a valid URL. Make sure it starts with http:// or https://",
      );
      return;
    }

    setFormError(null);
    setStreamSrc(trimmed);
    setPlayerKey((key) => key + 1);
  }, []);

  const shortLink = streamSrc
    ? `${window.location.origin}${window.location.pathname}?${new URLSearchParams(
        { url: streamSrc, ...(isLive ? { live: "true" } : {}) },
      ).toString()}`
    : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    loadStream(urlInput);
  };

  const handleCopyShortLink = useCallback(async () => {
    if (!shortLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shortLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access denied or unavailable; silently ignore.
    }
  }, [shortLink]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFromQuery = params.get("url");
    if (!urlFromQuery) {
      return;
    }

    setUrlInput(urlFromQuery);
    setIsLive(params.get("live") === "true");
    loadStream(urlFromQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadSample = () => {
    setUrlInput(SAMPLE_STREAM);
    setIsLive(false);
    loadStream(SAMPLE_STREAM);
  };

  const handleRetry = useCallback(() => {
    if (streamSrc) {
      loadStream(streamSrc);
    }
  }, [streamSrc, loadStream]);

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <main className={styles.card}>
        <header className={styles.header}>
          <span className={styles.badge}>HLS &middot; Player</span>
          <h1>Stream Tester</h1>
          <p>
            Paste any .m3u8 playlist URL and play it instantly. Captions,
            alternate audio tracks, and quality selection included out of the
            box.
          </p>
        </header>

        <form className={styles.urlForm} onSubmit={handleSubmit}>
          <label htmlFor={inputId} className={styles.srOnly}>
            HLS stream URL
          </label>
          <input
            id={inputId}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://example.com/stream.m3u8"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
          />
          <button type="submit">Load stream</button>
        </form>

        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        {shortLink && (
          <button
            type="button"
            className={`${styles.shortlinkChip}${copied ? ` ${styles.isCopied}` : ""}`}
            onClick={handleCopyShortLink}
            title={shortLink}
          >
            {copied ? <Check size={15} /> : <Link2 size={15} />}
            <span>{copied ? "Copied!" : "Copy shareable link"}</span>
          </button>
        )}

        <div className={styles.formFooter}>
          <label className={styles.liveToggle}>
            <input
              type="checkbox"
              checked={isLive}
              onChange={(event) => setIsLive(event.target.checked)}
            />
            This is a live stream
          </label>
          <button
            type="button"
            className={styles.linkButton}
            onClick={handleLoadSample}
          >
            Try a sample stream
          </button>
        </div>

        <VideoPlayer
          playerRef={playerRef}
          playerKey={playerKey}
          streamSrc={streamSrc}
          isLive={isLive}
          onRetry={handleRetry}
        />

        <HlsTimelinePanel playerRef={playerRef} resetKey={playerKey} />

        <footer className={styles.footer}>
          <p>
            Made with 💚 by{" "}
            <a href="https://line-21.com" target="_blank" rel="noreferrer">
              Line 21
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;

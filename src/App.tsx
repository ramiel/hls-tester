import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type { MediaError as MuxMediaError } from "@mux/mux-player-react";
import { Check, CirclePlay, Link2, TriangleAlert } from "lucide-react";
import "./index.css";

// const SAMPLE_STREAM =
//   "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8";
const SAMPLE_STREAM =
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/adv_dv_atmos/main.m3u8";
type Status = "idle" | "loading" | "ready" | "error";

function friendlyErrorMessage(detail: MuxMediaError | undefined): string {
  if (!detail) {
    return "Something went wrong while trying to play this stream.";
  }
  switch (detail.code) {
    case 2: // MEDIA_ERR_NETWORK
      return "The stream couldn't be reached. Check the URL, your connection, or whether the server allows cross-origin requests (CORS).";
    case 3: // MEDIA_ERR_DECODE
      return "The stream was reached but could not be decoded. It may be corrupted or use an unsupported codec.";
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      return "This doesn't look like a playable HLS stream. Double-check the .m3u8 URL is correct and publicly accessible.";
    default:
      return (
        detail.message ||
        "Unable to load this stream. Please check the URL and try again."
      );
  }
}

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
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerKey, setPlayerKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const loadStream = useCallback((rawUrl: string) => {
    const trimmed = rawUrl.trim();

    if (!trimmed) {
      setStatus("error");
      setErrorMessage("Please enter an .m3u8 URL first.");
      return;
    }

    if (!isLikelyValidUrl(trimmed)) {
      setStatus("error");
      setErrorMessage(
        "That doesn't look like a valid URL. Make sure it starts with http:// or https://",
      );
      return;
    }

    setErrorMessage(null);
    setStatus("loading");
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

  const handleError = useCallback((event: Event) => {
    const detail = (event as CustomEvent<MuxMediaError>).detail;
    setStatus("error");
    setErrorMessage(friendlyErrorMessage(detail));
  }, []);

  const handleLoadedData = useCallback(() => {
    setStatus("ready");
  }, []);

  return (
    <div className="page">
      <div className="glow" aria-hidden="true" />
      <main className="card">
        <header className="header">
          <span className="badge">HLS &middot; Player</span>
          <h1>Stream Tester</h1>
          <p>
            Paste any .m3u8 playlist URL and play it instantly. Captions,
            alternate audio tracks, and quality selection included out of the
            box.
          </p>
        </header>

        <form className="url-form" onSubmit={handleSubmit}>
          <label htmlFor={inputId} className="sr-only">
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

        {shortLink && (
          <button
            type="button"
            className={`shortlink-chip${copied ? " is-copied" : ""}`}
            onClick={handleCopyShortLink}
            title={shortLink}
          >
            {copied ? <Check size={15} /> : <Link2 size={15} />}
            <span>{copied ? "Copied!" : "Copy shareable link"}</span>
          </button>
        )}

        <div className="form-footer">
          <label className="live-toggle">
            <input
              type="checkbox"
              checked={isLive}
              onChange={(event) => setIsLive(event.target.checked)}
            />
            This is a live stream
          </label>
          <button
            type="button"
            className="link-button"
            onClick={handleLoadSample}
          >
            Try a sample stream
          </button>
        </div>

        <div className="player-shell">
          <div className="player-frame">
            {streamSrc && (
              <MuxPlayer
                key={playerKey}
                streamType={isLive ? "live" : "on-demand"}
                src={streamSrc}
                style={{ width: "100%", height: "100%" }}
                accentColor="#7c5cff"
                metadataVideoTitle="HLS Tester stream"
                onError={handleError}
                onLoadedData={handleLoadedData}
                onWaiting={() => setStatus("loading")}
                onPlaying={() => setStatus("ready")}
              />
            )}

            {!streamSrc && status !== "error" && (
              <div className="placeholder">
                <CirclePlay size={40} strokeWidth={1.5} />
                <p>Paste a stream URL above to start playing</p>
              </div>
            )}

            {streamSrc && status === "loading" && (
              <div className="loading-overlay">
                <span className="spinner" />
              </div>
            )}

            {status === "error" && errorMessage && (
              <div className="error-overlay" role="alert">
                <TriangleAlert size={32} strokeWidth={1.5} />
                <h2>Playback failed</h2>
                <p>{errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        <footer className="footer">
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

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type { MediaError as MuxMediaError } from "@mux/mux-player-react";
import "./index.css";

const SAMPLE_STREAM =
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8";

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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    loadStream(urlInput);
  };

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
            Paste any .m3u8 playlist URL and play it instantly &mdash; captions,
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
                <PlayIcon />
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
                <ErrorIcon />
                <h2>Playback failed</h2>
                <p>{errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        <footer className="footer">
          <p>
            Powered by{" "}
            <a
              href="https://www.mux.com/player"
              target="_blank"
              rel="noreferrer"
            >
              Mux Player
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="11"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <path d="M10 8.5L16 12L10 15.5V8.5Z" fill="currentColor" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 9V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 16.5V16.51"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.29 3.86L1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default App;

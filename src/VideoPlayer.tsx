import { useEffect, useState, type Ref } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type { MediaError as MuxMediaError, MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { CirclePlay, RotateCw, TriangleAlert } from "lucide-react";
import styles from "./VideoPlayer.module.css";

type Status = "idle" | "loading" | "ready" | "error";

interface VideoPlayerProps {
  playerRef: Ref<MuxPlayerRefAttributes>;
  playerKey: number;
  streamSrc: string | null;
  isLive: boolean;
  onRetry: () => void;
}

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

export function VideoPlayer({
  playerRef,
  playerKey,
  streamSrc,
  isLive,
  onRetry,
}: VideoPlayerProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!streamSrc) {
      return;
    }
    setStatus("loading");
    setErrorMessage(null);
  }, [playerKey, streamSrc]);

  const handleError = (event: Event) => {
    const detail = (event as CustomEvent<MuxMediaError>).detail;
    setStatus("error");
    setErrorMessage(friendlyErrorMessage(detail));
  };

  return (
    <div className={styles.playerShell}>
      <div className={styles.playerFrame}>
        {streamSrc && (
          <MuxPlayer
            ref={playerRef}
            key={playerKey}
            streamType={isLive ? "live" : "on-demand"}
            src={streamSrc}
            style={{ width: "100%", height: "100%" }}
            accentColor="#7c5cff"
            metadataVideoTitle="HLS Tester stream"
            onError={handleError}
            onLoadedData={() => setStatus("ready")}
            onWaiting={() => setStatus("loading")}
            onPlaying={() => setStatus("ready")}
          />
        )}

        {!streamSrc && status !== "error" && (
          <div className={styles.placeholder}>
            <CirclePlay size={40} strokeWidth={1.5} />
            <p>Paste a stream URL above to start playing</p>
          </div>
        )}

        {streamSrc && status === "loading" && (
          <div className={styles.loadingOverlay}>
            <span className={styles.spinner} />
          </div>
        )}

        {status === "error" && errorMessage && (
          <div className={styles.errorOverlay} role="alert">
            <TriangleAlert size={32} strokeWidth={1.5} />
            <h2>Playback failed</h2>
            <p>{errorMessage}</p>
            {streamSrc && (
              <button type="button" className={styles.retryButton} onClick={onRetry}>
                <RotateCw size={16} strokeWidth={2} />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import type { Ref } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type { MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { CirclePlay, RotateCw, TriangleAlert } from "lucide-react";
import styles from "./VideoPlayer.module.css";

export type Status = "idle" | "loading" | "ready" | "error";

interface VideoPlayerProps {
  playerRef: Ref<MuxPlayerRefAttributes>;
  playerKey: number;
  streamSrc: string | null;
  isLive: boolean;
  status: Status;
  errorMessage: string | null;
  onError: (event: Event) => void;
  onLoadedData: () => void;
  onWaiting: () => void;
  onPlaying: () => void;
  onRetry: () => void;
}

export function VideoPlayer({
  playerRef,
  playerKey,
  streamSrc,
  isLive,
  status,
  errorMessage,
  onError,
  onLoadedData,
  onWaiting,
  onPlaying,
  onRetry,
}: VideoPlayerProps) {
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
            onError={onError}
            onLoadedData={onLoadedData}
            onWaiting={onWaiting}
            onPlaying={onPlaying}
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

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import type { MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { useHlsTimeline } from "./useHlsTimeline";
import type { BufferedRange, FragmentRecord } from "./types";

const DEFAULT_PX_PER_SEC = 12;
const MIN_PX_PER_SEC = 2;
const MAX_PX_PER_SEC = 100;
const ZOOM_FACTOR = 1.5;
const MIN_CELL_WIDTH_PX = 2;
const MIN_LABEL_WIDTH_PX = 40;

function clampZoom(value: number): number {
  return Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, value));
}

interface HlsTimelinePanelProps {
  playerRef: RefObject<MuxPlayerRefAttributes | null>;
  resetKey: number | string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function maxEnd(ranges: BufferedRange[]): number {
  return ranges.reduce((max, range) => Math.max(max, range.end), 0);
}

function maxFragEnd(fragments: FragmentRecord[]): number {
  return fragments.reduce(
    (max, frag) => Math.max(max, frag.start + frag.duration),
    0,
  );
}

function maxFragEndAcrossTracks(
  fragmentsByTrack: Map<number, FragmentRecord[]>,
): number {
  return Array.from(fragmentsByTrack.values()).reduce(
    (max, frags) => Math.max(max, maxFragEnd(frags)),
    0,
  );
}

function FragmentCells({
  fragments,
  isTrackActive,
  currentTime,
  pxPerSec,
}: {
  fragments: FragmentRecord[];
  isTrackActive: boolean;
  currentTime: number;
  pxPerSec: number;
}) {
  return (
    <>
      {fragments.map((frag) => {
        const widthPx = Math.max(MIN_CELL_WIDTH_PX, frag.duration * pxPerSec);
        const isActive =
          isTrackActive &&
          currentTime >= frag.start &&
          currentTime < frag.start + frag.duration;
        return (
          <div
            key={frag.key}
            className={`hls-debug-cell${isActive ? " is-active" : ""}${
              frag.status === "error" ? " is-error" : ""
            }`}
            style={{ left: frag.start * pxPerSec, width: widthPx }}
            title={`sn: ${frag.sn} · ${formatTime(frag.start)}${
              frag.status === "error" ? " · load error" : ""
            }`}
          >
            {widthPx >= MIN_LABEL_WIDTH_PX && (
              <span>
                sn: {frag.sn}
                <br />
                {formatTime(frag.start)}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

export function HlsTimelinePanel({
  playerRef,
  resetKey,
}: HlsTimelinePanelProps) {
  const [open, setOpen] = useState(false);
  const [followPlayhead, setFollowPlayhead] = useState(false);
  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC);
  const panelId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const state = useHlsTimeline(playerRef, resetKey);

  const sortedLevels = useMemo(
    () => [...state.levels].sort((a, b) => a.height - b.height),
    [state.levels],
  );
  const sortedAudioTracks = useMemo(
    () => [...state.audioTracks].sort((a, b) => a.index - b.index),
    [state.audioTracks],
  );
  const sortedSubtitleTracks = useMemo(
    () => [...state.subtitleTracks].sort((a, b) => a.index - b.index),
    [state.subtitleTracks],
  );

  const durationSeconds = useMemo(() => {
    if (Number.isFinite(state.duration) && state.duration > 0) {
      return state.duration;
    }
    const observedEnd = Math.max(
      maxEnd(state.mediaBuffered),
      maxEnd(state.videoBuffered),
      maxEnd(state.audioBuffered),
      maxFragEndAcrossTracks(state.audioFragmentsByTrack),
      maxFragEndAcrossTracks(state.subtitleFragmentsByTrack),
      ...Array.from(state.fragmentsByLevel.values()).map(maxFragEnd),
      state.currentTime,
    );
    return observedEnd + 10;
  }, [state]);

  const trackWidth = Math.max(durationSeconds * pxPerSec, 320);

  const ticks = useMemo(() => {
    const niceIntervals = [
      1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600,
    ];
    const interval =
      niceIntervals.find((candidate) => candidate * pxPerSec >= 80) ??
      niceIntervals[niceIntervals.length - 1];
    const values: number[] = [];
    for (let t = 0; t <= durationSeconds; t += interval) {
      values.push(t);
    }
    return values;
  }, [durationSeconds, pxPerSec]);

  useEffect(() => {
    if (!followPlayhead || !open) {
      return;
    }
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const target = state.currentTime * pxPerSec - el.clientWidth / 2;
    el.scrollLeft = Math.max(0, target);
  }, [followPlayhead, open, state.currentTime, pxPerSec]);

  if (!open) {
    return (
      <section className="hls-debug">
        <button
          type="button"
          className="hls-debug-toggle"
          aria-expanded={false}
          aria-controls={panelId}
          onClick={() => setOpen(true)}
        >
          <ChevronRight
            size={15}
            className="hls-debug-chevron"
            aria-hidden="true"
          />
          <span>HLS debug timeline</span>
        </button>
      </section>
    );
  }

  return (
    <section className="hls-debug">
      <button
        type="button"
        className="hls-debug-toggle is-open"
        aria-expanded={true}
        aria-controls={panelId}
        onClick={() => setOpen(false)}
      >
        <ChevronRight
          size={15}
          className="hls-debug-chevron"
          aria-hidden="true"
        />
        <span>HLS debug timeline</span>
      </button>

      <div
        id={panelId}
        className="hls-debug-body"
        role="region"
        aria-label="HLS chunk timeline"
      >
        {state.availability === "detecting" && (
          <p className="hls-debug-note">
            Waiting for the hls.js engine to attach&hellip;
          </p>
        )}
        {state.availability === "unavailable" && (
          <p className="hls-debug-note">
            Per-segment timeline isn&rsquo;t available (this browser is likely
            using native HLS playback instead of hls.js). Showing overall
            buffered ranges only.
          </p>
        )}

        <div className="hls-debug-controls">
          <div className="hls-debug-zoom">
            <button
              type="button"
              className="hls-debug-zoom-button"
              onClick={() => setPxPerSec((p) => clampZoom(p / ZOOM_FACTOR))}
              disabled={pxPerSec <= MIN_PX_PER_SEC}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="hls-debug-zoom-value">
              {Math.round(pxPerSec)} px/s
            </span>
            <button
              type="button"
              className="hls-debug-zoom-button"
              onClick={() => setPxPerSec((p) => clampZoom(p * ZOOM_FACTOR))}
              disabled={pxPerSec >= MAX_PX_PER_SEC}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>
          <label className="hls-debug-follow-toggle">
            <input
              type="checkbox"
              checked={followPlayhead}
              onChange={(event) => setFollowPlayhead(event.target.checked)}
            />
            Follow playhead
          </label>
        </div>

        <div className="hls-debug-grid">
          <div className="hls-debug-labels">
            <div className="hls-debug-row-label">media buffer</div>
            <div className="hls-debug-row-label">video buffer (main)</div>
            <div className="hls-debug-row-label">audio buffer (main)</div>
            {sortedLevels.length > 0 && (
              <div className="hls-debug-row-label hls-debug-section-label">
                Video tracks
              </div>
            )}
            {sortedLevels.map((level) => (
              <div
                className="hls-debug-row-label"
                key={`video-${level.index}`}
                title={level.label}
              >
                {level.label}
              </div>
            ))}
            {sortedAudioTracks.length > 0 && (
              <div className="hls-debug-row-label hls-debug-section-label">
                Audio tracks
              </div>
            )}
            {sortedAudioTracks.map((track) => (
              <div
                className="hls-debug-row-label"
                key={`audio-${track.index}`}
                title={track.label}
              >
                {track.label}
              </div>
            ))}
            {sortedSubtitleTracks.length > 0 && (
              <div className="hls-debug-row-label hls-debug-section-label">
                Captions
              </div>
            )}
            {sortedSubtitleTracks.map((track) => (
              <div
                className="hls-debug-row-label"
                key={`subtitle-${track.index}`}
                title={track.label}
              >
                {track.label}
              </div>
            ))}
            <div className="hls-debug-axis-spacer" />
          </div>

          <div className="hls-debug-scroll" ref={scrollRef}>
            <div className="hls-debug-track" style={{ width: trackWidth }}>
              {ticks.map((t) => (
                <div
                  key={t}
                  className="hls-debug-gridline"
                  style={{ left: t * pxPerSec }}
                />
              ))}

              <div
                className="hls-debug-playhead"
                style={{ left: state.currentTime * pxPerSec }}
              />

              <div className="hls-debug-row">
                {state.mediaBuffered.map((range, i) => (
                  <div
                    key={i}
                    className="hls-debug-bar hls-debug-bar--media"
                    style={{
                      left: range.start * pxPerSec,
                      width: Math.max(
                        MIN_CELL_WIDTH_PX,
                        (range.end - range.start) * pxPerSec,
                      ),
                    }}
                    title={`${formatTime(range.start)} – ${formatTime(range.end)}`}
                  />
                ))}
              </div>

              <div className="hls-debug-row">
                {state.videoBuffered.map((range, i) => (
                  <div
                    key={i}
                    className="hls-debug-bar hls-debug-bar--video"
                    style={{
                      left: range.start * pxPerSec,
                      width: Math.max(
                        MIN_CELL_WIDTH_PX,
                        (range.end - range.start) * pxPerSec,
                      ),
                    }}
                    title={`${formatTime(range.start)} – ${formatTime(range.end)}`}
                  />
                ))}
              </div>

              <div className="hls-debug-row">
                {state.audioBuffered.map((range, i) => (
                  <div
                    key={i}
                    className="hls-debug-bar hls-debug-bar--audio"
                    style={{
                      left: range.start * pxPerSec,
                      width: Math.max(
                        MIN_CELL_WIDTH_PX,
                        (range.end - range.start) * pxPerSec,
                      ),
                    }}
                    title={`${formatTime(range.start)} – ${formatTime(range.end)}`}
                  />
                ))}
              </div>

              {sortedLevels.length > 0 && (
                <div className="hls-debug-section-row" />
              )}
              {sortedLevels.map((level) => (
                <div className="hls-debug-row" key={`video-${level.index}`}>
                  <FragmentCells
                    fragments={state.fragmentsByLevel.get(level.index) ?? []}
                    isTrackActive={state.activeLevel === level.index}
                    currentTime={state.currentTime}
                    pxPerSec={pxPerSec}
                  />
                </div>
              ))}

              {sortedAudioTracks.length > 0 && (
                <div className="hls-debug-section-row" />
              )}
              {sortedAudioTracks.map((track) => (
                <div className="hls-debug-row" key={`audio-${track.index}`}>
                  <FragmentCells
                    fragments={
                      state.audioFragmentsByTrack.get(track.index) ?? []
                    }
                    isTrackActive={state.activeAudioTrack === track.index}
                    currentTime={state.currentTime}
                    pxPerSec={pxPerSec}
                  />
                </div>
              ))}

              {sortedSubtitleTracks.length > 0 && (
                <div className="hls-debug-section-row" />
              )}
              {sortedSubtitleTracks.map((track) => (
                <div className="hls-debug-row" key={`subtitle-${track.index}`}>
                  <FragmentCells
                    fragments={
                      state.subtitleFragmentsByTrack.get(track.index) ?? []
                    }
                    isTrackActive={state.activeSubtitleTrack === track.index}
                    currentTime={state.currentTime}
                    pxPerSec={pxPerSec}
                  />
                </div>
              ))}

              <div className="hls-debug-axis">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="hls-debug-tick-label"
                    style={{ left: t * pxPerSec }}
                  >
                    {formatTime(t)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

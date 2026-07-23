import { useId, useMemo, useState, type RefObject } from "react";
import { ChevronRight } from "lucide-react";
import type { MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { useHlsTimeline } from "./useHlsTimeline";
import type { BufferedRange, FragmentRecord } from "./types";

const PX_PER_SEC = 12;
const MIN_CELL_WIDTH_PX = 2;
const MIN_LABEL_WIDTH_PX = 40;

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
  return fragments.reduce((max, frag) => Math.max(max, frag.start + frag.duration), 0);
}

export function HlsTimelinePanel({ playerRef, resetKey }: HlsTimelinePanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const state = useHlsTimeline(playerRef, resetKey);

  const sortedLevels = useMemo(
    () => [...state.levels].sort((a, b) => a.height - b.height),
    [state.levels],
  );

  const durationSeconds = useMemo(() => {
    if (Number.isFinite(state.duration) && state.duration > 0) {
      return state.duration;
    }
    const observedEnd = Math.max(
      maxEnd(state.mediaBuffered),
      maxEnd(state.videoBuffered),
      maxEnd(state.audioBuffered),
      maxFragEnd(state.audioFragments),
      ...Array.from(state.fragmentsByLevel.values()).map(maxFragEnd),
      state.currentTime,
    );
    return observedEnd + 10;
  }, [state]);

  const trackWidth = Math.max(durationSeconds * PX_PER_SEC, 320);

  const ticks = useMemo(() => {
    const interval = PX_PER_SEC * 30 >= 80 ? 30 : 60;
    const values: number[] = [];
    for (let t = 0; t <= durationSeconds; t += interval) {
      values.push(t);
    }
    return values;
  }, [durationSeconds]);

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
          <ChevronRight size={15} className="hls-debug-chevron" aria-hidden="true" />
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
        <ChevronRight size={15} className="hls-debug-chevron" aria-hidden="true" />
        <span>HLS debug timeline</span>
      </button>

      <div id={panelId} className="hls-debug-body" role="region" aria-label="HLS chunk timeline">
        {state.availability === "detecting" && (
          <p className="hls-debug-note">Waiting for the hls.js engine to attach&hellip;</p>
        )}
        {state.availability === "unavailable" && (
          <p className="hls-debug-note">
            Per-segment timeline isn&rsquo;t available (this browser is likely using native HLS
            playback instead of hls.js). Showing overall buffered ranges only.
          </p>
        )}

        <div className="hls-debug-grid">
          <div className="hls-debug-labels">
            <div className="hls-debug-row-label">media buffer</div>
            <div className="hls-debug-row-label">video buffer (main)</div>
            <div className="hls-debug-row-label">audio buffer (main)</div>
            {sortedLevels.map((level) => (
              <div className="hls-debug-row-label" key={level.index} title={level.label}>
                {level.label}
              </div>
            ))}
            <div className="hls-debug-axis-spacer" />
          </div>

          <div className="hls-debug-scroll">
            <div className="hls-debug-track" style={{ width: trackWidth }}>
              {ticks.map((t) => (
                <div key={t} className="hls-debug-gridline" style={{ left: t * PX_PER_SEC }} />
              ))}

              <div
                className="hls-debug-playhead"
                style={{ left: state.currentTime * PX_PER_SEC }}
              />

              <div className="hls-debug-row">
                {state.mediaBuffered.map((range, i) => (
                  <div
                    key={i}
                    className="hls-debug-bar hls-debug-bar--media"
                    style={{
                      left: range.start * PX_PER_SEC,
                      width: Math.max(MIN_CELL_WIDTH_PX, (range.end - range.start) * PX_PER_SEC),
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
                      left: range.start * PX_PER_SEC,
                      width: Math.max(MIN_CELL_WIDTH_PX, (range.end - range.start) * PX_PER_SEC),
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
                      left: range.start * PX_PER_SEC,
                      width: Math.max(MIN_CELL_WIDTH_PX, (range.end - range.start) * PX_PER_SEC),
                    }}
                    title={`${formatTime(range.start)} – ${formatTime(range.end)}`}
                  />
                ))}
              </div>

              {sortedLevels.map((level) => {
                const fragments = state.fragmentsByLevel.get(level.index) ?? [];
                return (
                  <div className="hls-debug-row" key={level.index}>
                    {fragments.map((frag) => {
                      const widthPx = Math.max(MIN_CELL_WIDTH_PX, frag.duration * PX_PER_SEC);
                      const isActive =
                        state.activeLevel === level.index &&
                        state.currentTime >= frag.start &&
                        state.currentTime < frag.start + frag.duration;
                      return (
                        <div
                          key={frag.key}
                          className={`hls-debug-cell${isActive ? " is-active" : ""}${
                            frag.status === "error" ? " is-error" : ""
                          }`}
                          style={{ left: frag.start * PX_PER_SEC, width: widthPx }}
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
                  </div>
                );
              })}

              <div className="hls-debug-axis">
                {ticks.map((t) => (
                  <span key={t} className="hls-debug-tick-label" style={{ left: t * PX_PER_SEC }}>
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

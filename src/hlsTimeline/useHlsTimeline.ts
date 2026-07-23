import { useEffect, useState } from "react";
import type { RefObject } from "react";
import Hls from "hls.js";
import type {
  AudioTrackSwitchedData,
  AudioTracksUpdatedData,
  BufferAppendedData,
  ErrorData,
  Events,
  FragLoadedData,
  LevelSwitchedData,
  ManifestParsedData,
  MediaPlaylist,
  SubtitleTrackSwitchData,
  SubtitleTracksUpdatedData,
} from "hls.js";
import type { MuxPlayerRefAttributes } from "@mux/mux-player-react";
import {
  createInitialTimelineState,
  type BufferedRange,
  type FragmentRecord,
  type LevelInfo,
  type TimelineState,
  type TrackInfo,
} from "./types";

const POLL_INTERVAL_MS = 150;
const ENGINE_DETECT_TIMEOUT_MS = 9000;

function toRanges(timeRanges: TimeRanges | undefined): BufferedRange[] {
  if (!timeRanges) {
    return [];
  }
  const ranges: BufferedRange[] = [];
  for (let i = 0; i < timeRanges.length; i += 1) {
    ranges.push({ start: timeRanges.start(i), end: timeRanges.end(i) });
  }
  return ranges;
}

function levelLabel(level: { width: number; height: number; bitrate: number }, index: number): string {
  return `${level.width}x${level.height}@${level.bitrate} (${level.height}) L-${index}`;
}

function audioTrackLabel(track: MediaPlaylist, index: number): string {
  const parts = [track.name || track.lang || "audio"];
  if (track.channels) {
    parts.push(`${track.channels}ch`);
  }
  return `${parts.join(" · ")} A-${index}`;
}

function subtitleTrackLabel(track: MediaPlaylist, index: number): string {
  return `${track.name || track.lang || "subtitle"} CC-${index}`;
}

function toTrackInfo(
  track: MediaPlaylist,
  index: number,
  label: (track: MediaPlaylist, index: number) => string,
): TrackInfo {
  return { index, name: track.name, lang: track.lang, label: label(track, index) };
}

export function useHlsTimeline(
  playerRef: RefObject<MuxPlayerRefAttributes | null>,
  resetKey: number | string,
): TimelineState {
  const [state, setState] = useState<TimelineState>(createInitialTimelineState);

  useEffect(() => {
    setState(createInitialTimelineState());

    let cancelled = false;
    let pollId: number | undefined;
    let hls: Hls | undefined;

    const mediaEl = playerRef.current;

    const handleTimeUpdate = () => {
      const el = playerRef.current;
      if (!el) {
        return;
      }
      setState((prev) => ({ ...prev, currentTime: el.currentTime }));
    };

    const handleDurationChange = () => {
      const el = playerRef.current;
      if (!el) {
        return;
      }
      setState((prev) => ({ ...prev, duration: el.duration }));
    };

    const handleProgress = () => {
      const el = playerRef.current;
      if (!el) {
        return;
      }
      const mediaBuffered = toRanges(el.buffered);
      setState((prev) => ({ ...prev, mediaBuffered }));
    };

    mediaEl?.addEventListener("timeupdate", handleTimeUpdate);
    mediaEl?.addEventListener("durationchange", handleDurationChange);
    mediaEl?.addEventListener("progress", handleProgress);

    function onManifestParsed(_event: Events.MANIFEST_PARSED, data: ManifestParsedData) {
      const levels: LevelInfo[] = data.levels.map((level, index) => ({
        index,
        width: level.width,
        height: level.height,
        bitrate: level.bitrate,
        label: levelLabel(level, index),
      }));
      const audioTracks = data.audioTracks.map((track, index) =>
        toTrackInfo(track, index, audioTrackLabel),
      );
      const subtitleTracks = data.subtitleTracks.map((track, index) =>
        toTrackInfo(track, index, subtitleTrackLabel),
      );
      setState((prev) => ({ ...prev, levels, audioTracks, subtitleTracks }));
    }

    function onLevelSwitched(_event: Events.LEVEL_SWITCHED, data: LevelSwitchedData) {
      setState((prev) => ({ ...prev, activeLevel: data.level }));
    }

    function onAudioTracksUpdated(_event: Events.AUDIO_TRACKS_UPDATED, data: AudioTracksUpdatedData) {
      const audioTracks = data.audioTracks.map((track, index) =>
        toTrackInfo(track, index, audioTrackLabel),
      );
      setState((prev) => ({ ...prev, audioTracks }));
    }

    function onAudioTrackSwitched(_event: Events.AUDIO_TRACK_SWITCHED, data: AudioTrackSwitchedData) {
      setState((prev) => ({ ...prev, activeAudioTrack: data.id }));
    }

    function onSubtitleTracksUpdated(
      _event: Events.SUBTITLE_TRACKS_UPDATED,
      data: SubtitleTracksUpdatedData,
    ) {
      const subtitleTracks = data.subtitleTracks.map((track, index) =>
        toTrackInfo(track, index, subtitleTrackLabel),
      );
      setState((prev) => ({ ...prev, subtitleTracks }));
    }

    function onSubtitleTrackSwitch(_event: Events.SUBTITLE_TRACK_SWITCH, data: SubtitleTrackSwitchData) {
      setState((prev) => ({ ...prev, activeSubtitleTrack: data.id }));
    }

    function recordFragment(frag: FragLoadedData["frag"], status: "loaded" | "error") {
      if (frag.sn === "initSegment") {
        return;
      }
      const record: FragmentRecord = {
        key: `${frag.type}-${frag.level}-${frag.sn}-${frag.start.toFixed(3)}-${status}`,
        trackKind: frag.type === "audio" ? "audio" : frag.type === "subtitle" ? "subtitle" : "video",
        level: frag.level,
        sn: frag.sn,
        start: frag.start,
        duration: frag.duration,
        status,
      };
      setState((prev) => {
        if (record.trackKind === "audio") {
          const next = new Map(prev.audioFragmentsByTrack);
          next.set(record.level, [...(next.get(record.level) ?? []), record]);
          return { ...prev, audioFragmentsByTrack: next };
        }
        if (record.trackKind === "subtitle") {
          const next = new Map(prev.subtitleFragmentsByTrack);
          next.set(record.level, [...(next.get(record.level) ?? []), record]);
          return { ...prev, subtitleFragmentsByTrack: next };
        }
        const next = new Map(prev.fragmentsByLevel);
        next.set(record.level, [...(next.get(record.level) ?? []), record]);
        return { ...prev, fragmentsByLevel: next };
      });
    }

    function onFragLoaded(_event: Events.FRAG_LOADED, data: FragLoadedData) {
      recordFragment(data.frag, "loaded");
    }

    function onError(_event: Events.ERROR, data: ErrorData) {
      if (data.details !== Hls.ErrorDetails.FRAG_LOAD_ERROR || !data.frag) {
        return;
      }
      recordFragment(data.frag, "error");
    }

    function onBufferAppended(_event: Events.BUFFER_APPENDED, data: BufferAppendedData) {
      setState((prev) => ({
        ...prev,
        videoBuffered: data.timeRanges.video ? toRanges(data.timeRanges.video) : prev.videoBuffered,
        audioBuffered: data.timeRanges.audio ? toRanges(data.timeRanges.audio) : prev.audioBuffered,
      }));
    }

    function attachHlsListeners(engine: Hls) {
      engine.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      engine.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
      engine.on(Hls.Events.AUDIO_TRACKS_UPDATED, onAudioTracksUpdated);
      engine.on(Hls.Events.AUDIO_TRACK_SWITCHED, onAudioTrackSwitched);
      engine.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, onSubtitleTracksUpdated);
      engine.on(Hls.Events.SUBTITLE_TRACK_SWITCH, onSubtitleTrackSwitch);
      engine.on(Hls.Events.FRAG_LOADED, onFragLoaded);
      engine.on(Hls.Events.ERROR, onError);
      engine.on(Hls.Events.BUFFER_APPENDED, onBufferAppended);

      // The manifest can already be parsed (and the level/track switched) by the
      // time polling discovers `_hls` — e.g. once the playlist is HTTP-cached,
      // hls.js races well ahead of our 150ms poll tick. `engine.levels`,
      // `engine.audioTracks`, `engine.subtitleTracks` and the current-selection
      // getters are plain properties (not events), so read them back
      // synchronously to backfill anything we would otherwise have missed.
      const levels: LevelInfo[] =
        engine.levels?.map((level, index) => ({
          index,
          width: level.width,
          height: level.height,
          bitrate: level.bitrate,
          label: levelLabel(level, index),
        })) ?? [];
      const audioTracks =
        engine.audioTracks?.map((track, index) => toTrackInfo(track, index, audioTrackLabel)) ?? [];
      const subtitleTracks =
        engine.subtitleTracks?.map((track, index) => toTrackInfo(track, index, subtitleTrackLabel)) ?? [];
      const activeLevel = engine.currentLevel >= 0 ? engine.currentLevel : null;
      const activeAudioTrack = engine.audioTrack >= 0 ? engine.audioTrack : null;
      const activeSubtitleTrack = engine.subtitleTrack >= 0 ? engine.subtitleTrack : null;
      setState((prev) => ({
        ...prev,
        availability: "available",
        levels: levels.length > 0 ? levels : prev.levels,
        audioTracks: audioTracks.length > 0 ? audioTracks : prev.audioTracks,
        subtitleTracks: subtitleTracks.length > 0 ? subtitleTracks : prev.subtitleTracks,
        activeLevel: activeLevel ?? prev.activeLevel,
        activeAudioTrack: activeAudioTrack ?? prev.activeAudioTrack,
        activeSubtitleTrack: activeSubtitleTrack ?? prev.activeSubtitleTrack,
      }));
    }

    function detachHlsListeners(engine: Hls) {
      engine.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      engine.off(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
      engine.off(Hls.Events.AUDIO_TRACKS_UPDATED, onAudioTracksUpdated);
      engine.off(Hls.Events.AUDIO_TRACK_SWITCHED, onAudioTrackSwitched);
      engine.off(Hls.Events.SUBTITLE_TRACKS_UPDATED, onSubtitleTracksUpdated);
      engine.off(Hls.Events.SUBTITLE_TRACK_SWITCH, onSubtitleTrackSwitch);
      engine.off(Hls.Events.FRAG_LOADED, onFragLoaded);
      engine.off(Hls.Events.ERROR, onError);
      engine.off(Hls.Events.BUFFER_APPENDED, onBufferAppended);
    }

    const pollStart = Date.now();
    const poll = () => {
      if (cancelled) {
        return;
      }
      // `_hls` is an undocumented, private getter on MuxPlayerElement that exposes
      // the underlying hls.js instance. There is no public API for per-fragment or
      // per-level events, so this is the only way to build a chunk timeline.
      const engine = playerRef.current?._hls;
      if (engine) {
        if (pollId !== undefined) {
          window.clearInterval(pollId);
        }
        hls = engine;
        attachHlsListeners(engine);
      } else if (Date.now() - pollStart > ENGINE_DETECT_TIMEOUT_MS) {
        if (pollId !== undefined) {
          window.clearInterval(pollId);
        }
        setState((prev) => ({ ...prev, availability: "unavailable" }));
      }
    };
    poll();
    if (!hls) {
      pollId = window.setInterval(poll, POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (pollId !== undefined) {
        window.clearInterval(pollId);
      }
      if (hls) {
        detachHlsListeners(hls);
      }
      mediaEl?.removeEventListener("timeupdate", handleTimeUpdate);
      mediaEl?.removeEventListener("durationchange", handleDurationChange);
      mediaEl?.removeEventListener("progress", handleProgress);
    };
  }, [resetKey]);

  return state;
}

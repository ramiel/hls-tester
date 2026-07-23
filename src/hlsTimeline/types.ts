export type EngineAvailability = "detecting" | "available" | "unavailable";

export interface LevelInfo {
  index: number;
  width: number;
  height: number;
  bitrate: number;
  label: string;
}

export interface TrackInfo {
  index: number;
  name: string;
  lang?: string;
  label: string;
}

export type FragmentStatus = "loaded" | "error";
export type TrackKind = "video" | "audio" | "subtitle";

export interface FragmentRecord {
  key: string;
  trackKind: TrackKind;
  level: number;
  sn: number | "initSegment";
  start: number;
  duration: number;
  status: FragmentStatus;
}

export interface BufferedRange {
  start: number;
  end: number;
}

export interface TimelineState {
  availability: EngineAvailability;
  levels: LevelInfo[];
  activeLevel: number | null;
  fragmentsByLevel: Map<number, FragmentRecord[]>;
  audioTracks: TrackInfo[];
  activeAudioTrack: number | null;
  audioFragmentsByTrack: Map<number, FragmentRecord[]>;
  subtitleTracks: TrackInfo[];
  activeSubtitleTrack: number | null;
  subtitleFragmentsByTrack: Map<number, FragmentRecord[]>;
  mediaBuffered: BufferedRange[];
  videoBuffered: BufferedRange[];
  audioBuffered: BufferedRange[];
  currentTime: number;
  duration: number;
}

export function createInitialTimelineState(): TimelineState {
  return {
    availability: "detecting",
    levels: [],
    activeLevel: null,
    fragmentsByLevel: new Map(),
    audioTracks: [],
    activeAudioTrack: null,
    audioFragmentsByTrack: new Map(),
    subtitleTracks: [],
    activeSubtitleTrack: null,
    subtitleFragmentsByTrack: new Map(),
    mediaBuffered: [],
    videoBuffered: [],
    audioBuffered: [],
    currentTime: 0,
    duration: 0,
  };
}

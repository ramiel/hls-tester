export type EngineAvailability = "detecting" | "available" | "unavailable";

export interface LevelInfo {
  index: number;
  width: number;
  height: number;
  bitrate: number;
  label: string;
}

export type FragmentStatus = "loaded" | "error";

export interface FragmentRecord {
  key: string;
  trackKind: "video" | "audio";
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
  audioFragments: FragmentRecord[];
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
    audioFragments: [],
    mediaBuffered: [],
    videoBuffered: [],
    audioBuffered: [],
    currentTime: 0,
    duration: 0,
  };
}

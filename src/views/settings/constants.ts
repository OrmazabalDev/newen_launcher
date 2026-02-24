import type { GameSettings } from "../../types";

export const DEFAULT_SETTINGS: GameSettings = {
  resolution: { width: 1280, height: 720 },
  fullscreen: true,
  memory: { minGb: 1, maxGb: 2 },
  javaArgs: "",
  javaPath: "",
  maxFps: 120,
  focusMode: false,
  performanceOverlay: true,
};

export const RAM_PRESETS = [2, 4, 6, 8, 12, 16];
export const UI_SCALES = [0.9, 1, 1.1, 1.25];

export const RESOLUTION_PRESETS = [
  { key: "1280x720", label: "1280x720 (HD)", width: 1280, height: 720 },
  { key: "1366x768", label: "1366x768", width: 1366, height: 768 },
  { key: "1600x900", label: "1600x900", width: 1600, height: 900 },
  { key: "1920x1080", label: "1920x1080 (Full HD)", width: 1920, height: 1080 },
  { key: "2560x1440", label: "2560x1440 (2K)", width: 2560, height: 1440 },
];

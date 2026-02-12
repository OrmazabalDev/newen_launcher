import type { GameSettings, MinecraftProfile } from "../types";

type PersistedSession = {
  userProfile: MinecraftProfile | null;
  selectedInstalledVersion: string;
  selectedInstanceId: string;
  showSnapshots: boolean;
  gameSettings: GameSettings;
  uiScale: number;
  forgeProfilesByVersion: Record<string, string>;
};

const KEY = "launcher_mc_session_v3";

const DEFAULTS: PersistedSession = {
  userProfile: null,
  selectedInstalledVersion: "",
  selectedInstanceId: "",
  showSnapshots: false,
  gameSettings: {
    resolution: { width: 1280, height: 720 },
    fullscreen: true,
    memory: { minGb: 1, maxGb: 2 },
    javaArgs: "",
    javaPath: "",
    maxFps: 120,
    focusMode: false,
    performanceOverlay: true,
  },
  uiScale: 1,
  forgeProfilesByVersion: {},
};

export function loadSession(): PersistedSession {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    const merged = {
      ...DEFAULTS,
      ...parsed,
      gameSettings: { ...DEFAULTS.gameSettings, ...(parsed.gameSettings || {}) },
    };
    // Java se gestiona automaticamente; limpiamos cualquier override previo
    merged.gameSettings.javaPath = "";
    merged.gameSettings.javaArgs = "";
    return merged;
  } catch {
    return DEFAULTS;
  }
}

export function saveSession(partial: Partial<PersistedSession>) {
  const current = loadSession();
  localStorage.setItem(KEY, JSON.stringify({ ...current, ...partial }));
}

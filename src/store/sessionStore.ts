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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCapeUrls(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeUserProfile(value: unknown): MinecraftProfile | null {
  if (value == null) return null;
  if (!isRecord(value)) return null;

  const { id, name, is_offline, skin_url } = value;
  if (typeof id !== "string" || typeof name !== "string" || typeof is_offline !== "boolean") {
    return null;
  }

  return {
    id,
    name,
    is_offline,
    skin_url: typeof skin_url === "string" ? skin_url : "",
    cape_urls: normalizeCapeUrls(value.cape_urls),
  };
}

export function loadSession(): PersistedSession {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULTS;

    const normalizedProfile = normalizeUserProfile(parsed.userProfile);
    const merged = {
      ...DEFAULTS,
      ...parsed,
      userProfile: normalizedProfile,
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

export interface MinecraftProfile {
  id: string;
  name: string;
  is_offline: boolean;
  skin_url: string | null;
  cape_urls: string[] | null;
}

export interface DeviceCodeResponse {
  user_code: string;
  device_code: string;
  verification_uri: string;
  message: string | null;
  interval: number | null;
}

export interface SystemJava {
  valid: boolean;
  version: string;
  major: number;
  path: string;
  message: string;
}

export interface ProgressPayload {
  task: string;
  percent: number;
}

export type View =
  | "dashboard"
  | "manager"
  | "instances"
  | "catalog"
  | "modpacks"
  | "skins"
  | "settings";
export type AuthMode = "microsoft" | "offline";
export type VersionType = "release" | "snapshot";

export interface VersionItem {
  id: string;
  type: VersionType;
}

export interface GameSettings {
  resolution: {
    width: number;
    height: number;
  };
  fullscreen: boolean;
  memory: {
    minGb: number;
    maxGb: number;
  };
  javaArgs: string;
  javaPath: string;
  maxFps: number;
  focusMode: boolean;
  performanceOverlay: boolean;
}

export type LoaderType = "vanilla" | "snapshot" | "forge" | "neoforge" | "fabric";

export interface InstanceSummary {
  id: string;
  name: string;
  version: string;
  loader: LoaderType;
  thumbnail: string | null;
  tags: string[];
  created_at: number;
  last_played: number | null;
  mods_count: number;
}

export interface InstanceContentItem {
  file_name: string;
  name: string;
  enabled: boolean;
  size: number;
  modified: number;
  kind: string;
  required_by: string[];
  source: string | null;
  project_id: string | null;
  version_id: string | null;
}

export interface InstanceLogEntry {
  name: string;
  kind: string;
  size: number;
  modified: number;
}

export interface RuntimeMetrics {
  used_memory_mb: number;
  total_memory_mb: number;
  used_memory_percent: number;
  launcher_memory_mb: number | null;
  launcher_virtual_mb: number | null;
  process_memory_mb: number | null;
  process_virtual_mb: number | null;
}

export interface ModrinthSearchResponse {
  hits: ModrinthProjectHit[];
  total_hits: number;
}

export interface ModrinthProjectHit {
  project_id: string;
  title: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  date_modified: string;
}

export interface ModrinthGalleryImage {
  url: string;
  title: string | null;
  description: string | null;
  featured: boolean;
}

export interface ModrinthProject {
  id: string;
  title: string;
  description: string;
  body: string | null;
  icon_url: string | null;
  gallery: ModrinthGalleryImage[];
}

export interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: ModrinthFile[];
  dependencies: ModrinthDependency[];
}

export interface ModrinthFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  hashes: Record<string, string>;
}

export interface ModrinthDependency {
  version_id: string | null;
  project_id: string | null;
  dependency_type: string;
}

export interface CurseForgeSearchResponse {
  data: CurseForgeMod[];
}

export interface CurseForgeMod {
  id: number;
  name: string;
  summary: string;
  download_count: number;
  date_modified: string;
  logo: {
    thumbnail_url: string;
  } | null;
}

export interface SkinInfo {
  name: string;
  model: string;
  data_url: string;
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// --- COMUNICACIÓN FRONTEND ---
#[derive(Clone, Serialize)]
pub struct ProgressPayload {
    pub task: String,
    pub percent: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RuntimeMetrics {
    pub cpu_percent: f32,
    pub used_memory_mb: u64,
    pub total_memory_mb: u64,
    pub used_memory_percent: f32,
    pub launcher_cpu_percent: Option<f32>,
    pub launcher_memory_mb: Option<u64>,
    pub launcher_virtual_mb: Option<u64>,
    pub process_cpu_percent: Option<f32>,
    pub process_memory_mb: Option<u64>,
    pub process_virtual_mb: Option<u64>,
}

#[derive(Serialize, Debug, Clone)]
pub struct GameProcessPayload {
    pub pid: u32,
    pub code: Option<i32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SkinInfo {
    pub name: String,
    pub model: String,
    pub data_url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MinecraftProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub is_offline: bool,
    #[serde(default)]
    pub skin_url: Option<String>,
    #[serde(default)]
    pub cape_urls: Vec<String>,
    #[serde(skip)]
    pub access_token: Option<String>,
    #[serde(skip)]
    pub xuid: Option<String>,
    #[serde(skip)]
    pub user_type: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
pub struct SystemJava {
    pub valid: bool,
    pub version: String,
    pub major: u32,
    pub path: String,
    pub message: String,
}

// --- AJUSTES DE JUEGO ---
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameSettings {
    pub resolution: Resolution,
    pub fullscreen: bool,
    #[serde(default = "default_memory_settings")]
    pub memory: MemorySettings,
    #[serde(rename = "javaArgs", default)]
    pub java_args: String,
    #[serde(rename = "javaPath", default)]
    pub java_path: String,
    #[serde(rename = "maxFps", default = "default_max_fps")]
    pub max_fps: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Resolution {
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MemorySettings {
    #[serde(rename = "minGb", default = "default_memory_min")]
    pub min_gb: u32,
    #[serde(rename = "maxGb", default = "default_memory_max")]
    pub max_gb: u32,
}

fn default_memory_settings() -> MemorySettings {
    MemorySettings {
        min_gb: 1,
        max_gb: 2,
    }
}

fn default_memory_min() -> u32 {
    1
}

fn default_memory_max() -> u32 {
    2
}

fn default_max_fps() -> u32 {
    120
}

// --- INSTANCIAS ---
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub version: String,
    pub loader: String,
    pub thumbnail: Option<String>,
    pub tags: Vec<String>,
    pub created_at: i64,
    pub last_played: Option<i64>,
    #[serde(default)]
    pub mods_cached_count: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstanceSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub loader: String,
    pub thumbnail: Option<String>,
    pub tags: Vec<String>,
    pub created_at: i64,
    pub last_played: Option<i64>,
    pub mods_count: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstanceContentItem {
    pub file_name: String,
    pub name: String,
    pub enabled: bool,
    pub size: u64,
    pub modified: i64,
    pub kind: String,
    #[serde(default)]
    pub required_by: Vec<String>,
    pub source: Option<String>,
    pub project_id: Option<String>,
    pub version_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstanceLogEntry {
    pub name: String,
    pub kind: String,
    pub size: u64,
    pub modified: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModMetadataEntry {
    pub file_name: String,
    pub version_id: Option<String>,
    pub project_id: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    pub source: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstanceCreateRequest {
    pub name: String,
    pub version: String,
    pub loader: String,
    pub thumbnail: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstanceUpdateRequest {
    pub name: Option<String>,
    pub thumbnail: Option<String>,
    pub tags: Option<Vec<String>>,
}

// --- MOJANG / VERSIONES ---
// ERROR CORREGIDO: Eliminada la duplicación de #[derive(...)]
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<VersionInfo>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct VersionInfo {
    pub id: String,
    #[serde(rename = "type")]
    pub release_type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct VersionMetadata {
    pub id: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "minecraftArguments")]
    pub minecraft_arguments: Option<String>,
    pub arguments: Option<serde_json::Value>,
    pub downloads: Option<ClientDownloads>,
    #[serde(rename = "javaVersion")]
    pub java_version: Option<JavaVersion>, // Este campo debe ser público
    pub libraries: Vec<Library>,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    pub url: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct JavaVersion {
    pub component: String,
    #[serde(rename = "majorVersion")]
    pub major_version: u32,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ClientDownloads {
    pub client: DownloadFile,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct DownloadFile {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

// --- VERSION JSON (VANILLA / FORGE) ---
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct VersionJson {
    pub id: String,
    #[serde(rename = "mainClass")]
    pub main_class: Option<String>,
    #[serde(rename = "minecraftArguments")]
    pub minecraft_arguments: Option<String>,
    pub arguments: Option<VersionArguments>,
    pub libraries: Option<Vec<Library>>,
    #[serde(rename = "assetIndex")]
    pub asset_index: Option<AssetIndex>,
    #[serde(rename = "javaVersion")]
    pub java_version: Option<JavaVersion>,
    #[serde(rename = "inheritsFrom")]
    pub inherits_from: Option<String>,
    pub jar: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct VersionArguments {
    pub game: Option<Vec<VersionArgument>>,
    pub jvm: Option<Vec<VersionArgument>>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(untagged)]
pub enum VersionArgument {
    Str(String),
    Obj {
        rules: Option<Vec<Rule>>,
        value: Option<serde_json::Value>,
    },
    Any(serde_json::Value),
}

// --- LIBRERÍAS Y ASSETS ---
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Library {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    pub rules: Option<Vec<Rule>>,
    pub natives: Option<HashMap<String, String>>,
    pub url: Option<String>,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct LibraryDownloads {
    pub artifact: Option<Artifact>,
    pub classifiers: Option<HashMap<String, Artifact>>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Artifact {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Rule {
    pub action: String,
    pub os: Option<OsRule>,
    pub features: Option<HashMap<String, bool>>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OsRule {
    pub name: String,
}

#[derive(Deserialize, Debug)]
pub struct AssetIndexFile {
    pub objects: HashMap<String, AssetObject>,
}

#[derive(Deserialize, Debug)]
pub struct AssetObject {
    pub hash: String,
    #[allow(dead_code)]
    pub size: u64,
}

// --- AUTH ---
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DeviceCodeResponse {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub message: Option<String>,
    pub interval: Option<u64>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MSTokenResponse {
    pub access_token: String,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MSTokenFullResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MSDeviceCodeError {
    pub error: String,
    pub error_description: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct XBLResponse {
    #[serde(rename = "Token")]
    pub token: String,
    #[serde(rename = "DisplayClaims")]
    pub display_claims: XBLDisplayClaims,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct XBLDisplayClaims {
    pub xui: Vec<XBLXui>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct XBLXui {
    pub uhs: String,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MCLoginResponse {
    pub access_token: String,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MCProfileResponse {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub skins: Vec<MCSkin>,
    #[serde(default)]
    pub capes: Vec<MCCape>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MCSkin {
    pub id: Option<String>,
    pub state: Option<String>,
    pub url: Option<String>,
    pub variant: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MCCape {
    pub id: Option<String>,
    pub state: Option<String>,
    pub url: Option<String>,
}

// --- FORGE PROMOS ---
#[derive(Deserialize, Debug)]
pub struct ForgePromotions {
    pub promos: HashMap<String, String>,
}

// --- MODRINTH ---
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthSearchResponse {
    #[serde(rename = "hits")]
    pub hits: Vec<ModrinthProjectHit>,
    #[serde(rename = "total_hits")]
    pub total_hits: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthProjectHit {
    #[serde(rename = "project_id")]
    pub project_id: String,
    pub title: String,
    pub description: String,
    #[serde(rename = "icon_url")]
    pub icon_url: Option<String>,
    pub downloads: u64,
    #[serde(rename = "date_modified")]
    pub date_modified: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthProject {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(rename = "icon_url")]
    pub icon_url: Option<String>,
    #[serde(default)]
    pub gallery: Vec<ModrinthGalleryImage>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthGalleryImage {
    pub url: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub featured: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthVersion {
    pub id: String,
    #[serde(default)]
    pub project_id: Option<String>,
    pub name: String,
    #[serde(rename = "version_number")]
    pub version_number: String,
    #[serde(rename = "game_versions")]
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub files: Vec<ModrinthFile>,
    #[serde(default)]
    pub dependencies: Vec<ModrinthDependency>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthFile {
    pub url: String,
    pub filename: String,
    pub primary: bool,
    pub size: u64,
    pub hashes: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthDependency {
    #[serde(rename = "version_id")]
    pub version_id: Option<String>,
    #[serde(rename = "project_id")]
    pub project_id: Option<String>,
    #[serde(rename = "dependency_type")]
    pub dependency_type: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthPackIndex {
    #[serde(default)]
    pub files: Vec<ModrinthPackFile>,
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthPackFile {
    pub path: String,
    pub hashes: HashMap<String, String>,
    pub downloads: Vec<String>,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    #[serde(default)]
    pub env: Option<ModrinthPackEnv>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthPackEnv {
    pub client: Option<String>,
    pub server: Option<String>,
}

// --- CURSEFORGE ---
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeSearchResponse {
    pub data: Vec<CurseForgeMod>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeMod {
    pub id: u64,
    pub name: String,
    pub summary: String,
    #[serde(rename = "downloadCount")]
    pub download_count: f64,
    #[serde(rename = "dateModified")]
    pub date_modified: String,
    pub logo: Option<CurseForgeLogo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeLogo {
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail_url: String,
}

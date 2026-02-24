use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

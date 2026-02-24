use serde::{Deserialize, Serialize};

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

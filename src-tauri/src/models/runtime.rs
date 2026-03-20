use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize)]
pub struct ProgressPayload {
    pub task: String,
    pub percent: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RuntimeMetrics {
    pub used_memory_mb: u64,
    pub total_memory_mb: u64,
    pub used_memory_percent: f32,
    pub launcher_memory_mb: Option<u64>,
    pub launcher_virtual_mb: Option<u64>,
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
pub struct SystemJava {
    pub valid: bool,
    pub version: String,
    pub major: u32,
    pub path: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LaunchRecoveryStatus {
    AutoRepairApplied,
    AutoRepairFailed,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LaunchRecoveryResult {
    pub success: bool,
    pub recovery_status: Option<LaunchRecoveryStatus>,
    pub diagnostic_path: Option<String>,
    pub log_path: Option<String>,
    pub user_message: String,
    pub technical_message: Option<String>,
    pub requires_java_attention: bool,
}

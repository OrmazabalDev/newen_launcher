use serde::{Deserialize, Serialize};

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
    MemorySettings { min_gb: 1, max_gb: 2 }
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

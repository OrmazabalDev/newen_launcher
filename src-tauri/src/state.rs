use std::sync::Mutex;

use crate::models::{MinecraftProfile, VersionManifest, VersionMetadata};
use discord_rich_presence::DiscordIpcClient;

#[derive(Default)]
pub struct AppState {
    pub manifest_cache: Mutex<Option<VersionManifest>>,
    pub metadata_cache: Mutex<Option<VersionMetadata>>,
    pub current_profile: Mutex<Option<MinecraftProfile>>,
    pub discord_client: Mutex<Option<DiscordIpcClient>>,
}

impl AppState {
    pub fn new() -> Self {
        Self::default()
    }
}

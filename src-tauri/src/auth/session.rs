use crate::error::AppResult;
use crate::utils::get_launcher_dir;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub(crate) struct StoredSession {
    pub(crate) refresh_token: String,
    pub(crate) mc_access_token: String,
    pub(crate) mc_expires_at: u64,
    pub(crate) profile_id: String,
    pub(crate) profile_name: String,
    pub(crate) skin_url: Option<String>,
    #[serde(default)]
    pub(crate) cape_urls: Vec<String>,
    pub(crate) xuid: Option<String>,
}

pub(crate) fn now_unix() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn auth_session_path(app: &AppHandle) -> std::path::PathBuf {
    get_launcher_dir(app).join("auth").join("session.json")
}

pub(crate) async fn save_session(app: &AppHandle, session: &StoredSession) -> AppResult<()> {
    let path = auth_session_path(app);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    }
    let raw = serde_json::to_string_pretty(session)
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    tokio::fs::write(path, raw)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    Ok(())
}

pub(crate) async fn load_session(app: &AppHandle) -> AppResult<StoredSession> {
    let path = auth_session_path(app);
    let raw = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    serde_json::from_str(&raw).map_err(|e| crate::error::AppError::Message(e.to_string()))
}

pub(crate) async fn clear_session(app: &AppHandle) -> AppResult<()> {
    let path = auth_session_path(app);
    if path.exists() {
        tokio::fs::remove_file(path)
            .await
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    }
    Ok(())
}

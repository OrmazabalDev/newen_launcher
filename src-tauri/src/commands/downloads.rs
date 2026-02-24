use super::map_app_result;
use crate::downloader::{download_client_impl, download_game_files_impl, download_java_impl};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn download_client(
    app: tauri::AppHandle,
    version_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(download_client_impl(&app, version_id, &state.metadata_cache).await)
}

#[tauri::command]
pub async fn download_game_files(
    app: tauri::AppHandle,
    version_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(download_game_files_impl(&app, version_id, &state.metadata_cache).await)
}

#[tauri::command]
pub async fn download_java(
    app: tauri::AppHandle,
    version_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(
        download_java_impl(&app, version_id, &state.manifest_cache, &state.metadata_cache).await,
    )
}

use super::map_app_result;
use crate::fabric::install_fabric_impl;
use crate::forge::install_forge_impl;
use crate::neoforge::install_neoforge_impl;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn install_forge(
    app: tauri::AppHandle,
    version_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(
        install_forge_impl(&app, version_id, None, &state.manifest_cache, &state.metadata_cache)
            .await,
    )
}

#[tauri::command]
pub async fn install_fabric(
    app: tauri::AppHandle,
    version_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(
        install_fabric_impl(&app, version_id, None, &state.manifest_cache, &state.metadata_cache)
            .await,
    )
}

#[tauri::command]
pub async fn install_neoforge(
    app: tauri::AppHandle,
    version_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(
        install_neoforge_impl(&app, version_id, None, &state.manifest_cache, &state.metadata_cache)
            .await,
    )
}

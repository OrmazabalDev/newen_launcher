use super::map_app_result;
use crate::state::AppState;

#[tauri::command]
pub async fn discord_init(state: tauri::State<'_, AppState>) -> Result<(), String> {
    map_app_result(crate::discord::init(state.inner()))
}

#[tauri::command]
pub async fn discord_set_activity(
    state_handle: tauri::State<'_, AppState>,
    state: String,
    details: String,
    start_timestamp: Option<i64>,
    show_buttons: bool,
) -> Result<(), String> {
    map_app_result(crate::discord::set_activity(
        state_handle.inner(),
        &state,
        &details,
        start_timestamp,
        show_buttons,
    ))
}

#[tauri::command]
pub async fn discord_clear_activity(state: tauri::State<'_, AppState>) -> Result<(), String> {
    map_app_result(crate::discord::clear_activity(state.inner()))
}

#[tauri::command]
pub async fn discord_shutdown(state: tauri::State<'_, AppState>) -> Result<(), String> {
    map_app_result(crate::discord::shutdown(state.inner()))
}

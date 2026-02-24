use super::map_app_result;
use crate::auth::{
    login_offline_impl, logout_impl, poll_ms_login_impl, refresh_ms_profile_impl,
    restore_ms_session_impl, start_ms_login_impl,
};
use crate::models::DeviceCodeResponse;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn login_offline(username: String, state: State<'_, AppState>) -> Result<String, String> {
    map_app_result(login_offline_impl(username, &state.current_profile).await)
}

#[tauri::command]
pub async fn start_ms_login(app: tauri::AppHandle) -> Result<DeviceCodeResponse, String> {
    map_app_result(start_ms_login_impl(&app).await)
}

#[tauri::command]
pub async fn poll_ms_login(
    app: tauri::AppHandle,
    device_code: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(poll_ms_login_impl(&app, device_code, &state.current_profile).await)
}

#[tauri::command]
pub async fn restore_ms_session(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(restore_ms_session_impl(&app, &state.current_profile).await)
}

#[tauri::command]
pub async fn logout_session(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    map_app_result(logout_impl(&app, &state.current_profile).await)
}

#[tauri::command]
pub async fn refresh_ms_profile(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(refresh_ms_profile_impl(&app, &state.current_profile).await)
}

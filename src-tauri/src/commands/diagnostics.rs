use super::map_app_result;
use crate::diagnostics::{generate_diagnostic_report_impl, upload_diagnostic_report_impl};
use crate::repair::repair_instance_impl;
use crate::state::AppState;
use crate::utils::get_launcher_dir;
use tauri::{Manager, State};

#[tauri::command]
pub fn clear_cache(app: tauri::AppHandle) -> Result<String, String> {
    let base = get_launcher_dir(&app);
    let cache_dir = base.join("cache");
    if cache_dir.exists() {
        let _ = std::fs::remove_dir_all(&cache_dir).map_err(|e| e.to_string());
    }
    Ok("Cache limpiada".to_string())
}

#[tauri::command]
pub fn close_splash(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub async fn repair_instance(
    app: tauri::AppHandle,
    instance_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(
        repair_instance_impl(&app, instance_id, &state.manifest_cache, &state.metadata_cache).await,
    )
}

#[tauri::command]
pub async fn generate_diagnostic_report(app: tauri::AppHandle) -> Result<String, String> {
    map_app_result(generate_diagnostic_report_impl(&app).await)
}

#[tauri::command]
pub async fn upload_diagnostic_report(
    app: tauri::AppHandle,
    report_path: Option<String>,
    instance_id: Option<String>,
) -> Result<String, String> {
    map_app_result(upload_diagnostic_report_impl(&app, report_path, instance_id).await)
}

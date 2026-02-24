use super::map_app_result;
use crate::content::{
    delete_instance_content_impl, list_instance_content_impl, list_instance_reports_impl,
    open_instance_content_folder_impl, read_instance_report_impl, toggle_instance_content_impl,
};
use crate::metrics::get_runtime_metrics_impl;
use crate::models::{InstanceContentItem, InstanceLogEntry, RuntimeMetrics};

#[tauri::command]
pub async fn list_instance_content(
    app: tauri::AppHandle,
    instance_id: String,
    kind: String,
) -> Result<Vec<InstanceContentItem>, String> {
    map_app_result(list_instance_content_impl(&app, instance_id, kind).await)
}

#[tauri::command]
pub async fn toggle_instance_content(
    app: tauri::AppHandle,
    instance_id: String,
    kind: String,
    file_name: String,
    enabled: bool,
) -> Result<(), String> {
    map_app_result(toggle_instance_content_impl(&app, instance_id, kind, file_name, enabled).await)
}

#[tauri::command]
pub async fn delete_instance_content(
    app: tauri::AppHandle,
    instance_id: String,
    kind: String,
    file_name: String,
) -> Result<(), String> {
    map_app_result(delete_instance_content_impl(&app, instance_id, kind, file_name).await)
}

#[tauri::command]
pub fn open_instance_content_folder(
    app: tauri::AppHandle,
    instance_id: String,
    kind: String,
) -> Result<(), String> {
    map_app_result(open_instance_content_folder_impl(&app, instance_id, kind))
}

#[tauri::command]
pub async fn list_instance_reports(
    app: tauri::AppHandle,
    instance_id: String,
) -> Result<Vec<InstanceLogEntry>, String> {
    map_app_result(list_instance_reports_impl(&app, instance_id).await)
}

#[tauri::command]
pub async fn read_instance_report(
    app: tauri::AppHandle,
    instance_id: String,
    kind: String,
    name: String,
) -> Result<String, String> {
    map_app_result(read_instance_report_impl(&app, instance_id, kind, name).await)
}

#[tauri::command]
pub fn get_runtime_metrics(pid: Option<u32>) -> Result<RuntimeMetrics, String> {
    map_app_result(get_runtime_metrics_impl(pid))
}

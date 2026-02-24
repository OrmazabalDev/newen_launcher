use super::map_app_result;
use crate::instances::{
    create_instance_impl, delete_instance_impl, list_instances_impl, open_instance_folder_impl,
    update_instance_impl,
};
use crate::models::{InstanceCreateRequest, InstanceSummary, InstanceUpdateRequest};

#[tauri::command]
pub async fn list_instances(app: tauri::AppHandle) -> Result<Vec<InstanceSummary>, String> {
    map_app_result(list_instances_impl(&app).await)
}

#[tauri::command]
pub async fn create_instance(
    app: tauri::AppHandle,
    req: InstanceCreateRequest,
) -> Result<InstanceSummary, String> {
    map_app_result(create_instance_impl(&app, req).await)
}

#[tauri::command]
pub async fn update_instance(
    app: tauri::AppHandle,
    instance_id: String,
    req: InstanceUpdateRequest,
) -> Result<InstanceSummary, String> {
    map_app_result(update_instance_impl(&app, instance_id, req).await)
}

#[tauri::command]
pub async fn delete_instance(app: tauri::AppHandle, instance_id: String) -> Result<(), String> {
    map_app_result(delete_instance_impl(&app, instance_id).await)
}

#[tauri::command]
pub fn open_instance_folder(app: tauri::AppHandle, instance_id: String) -> Result<(), String> {
    map_app_result(open_instance_folder_impl(&app, instance_id))
}

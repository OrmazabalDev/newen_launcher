use super::map_app_result;
use crate::worlds::{
    import_datapack_zip_impl, list_instance_worlds_impl, open_world_datapacks_folder_impl,
};

#[tauri::command]
pub async fn list_instance_worlds(
    app: tauri::AppHandle,
    instance_id: String,
) -> Result<Vec<String>, String> {
    map_app_result(list_instance_worlds_impl(&app, instance_id).await)
}

#[tauri::command]
pub fn open_world_datapacks_folder(
    app: tauri::AppHandle,
    instance_id: String,
    world_id: String,
) -> Result<(), String> {
    map_app_result(open_world_datapacks_folder_impl(&app, instance_id, world_id))
}

#[tauri::command]
pub async fn import_datapack_zip(
    app: tauri::AppHandle,
    instance_id: String,
    world_id: String,
    file_name: String,
    data_base64: String,
) -> Result<String, String> {
    map_app_result(
        import_datapack_zip_impl(&app, instance_id, world_id, file_name, data_base64).await,
    )
}

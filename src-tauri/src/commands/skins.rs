use super::map_app_result;
use crate::models::SkinInfo;

#[tauri::command]
pub async fn get_active_skin(app: tauri::AppHandle) -> Result<Option<SkinInfo>, String> {
    map_app_result(crate::skins::get_active_skin(app).await)
}

#[tauri::command]
pub async fn set_active_skin_base64(
    app: tauri::AppHandle,
    name: String,
    model: String,
    data: String,
) -> Result<SkinInfo, String> {
    map_app_result(crate::skins::set_active_skin_base64(app, name, model, data).await)
}

#[tauri::command]
pub async fn set_active_skin_url(
    app: tauri::AppHandle,
    url: String,
    name: Option<String>,
    model: String,
) -> Result<SkinInfo, String> {
    map_app_result(crate::skins::set_active_skin_url(app, url, name, model).await)
}

#[tauri::command]
pub async fn clear_active_skin(app: tauri::AppHandle) -> Result<(), String> {
    map_app_result(crate::skins::clear_active_skin(app).await)
}

#[tauri::command]
pub async fn get_active_cape(app: tauri::AppHandle) -> Result<Option<String>, String> {
    map_app_result(crate::skins::get_active_cape(app).await)
}

#[tauri::command]
pub async fn set_active_cape_base64(app: tauri::AppHandle, data: String) -> Result<String, String> {
    map_app_result(crate::skins::set_active_cape_base64(app, data).await)
}

#[tauri::command]
pub async fn set_active_cape_url(app: tauri::AppHandle, url: String) -> Result<String, String> {
    map_app_result(crate::skins::set_active_cape_url(app, url).await)
}

#[tauri::command]
pub async fn clear_active_cape(app: tauri::AppHandle) -> Result<(), String> {
    map_app_result(crate::skins::clear_active_cape(app).await)
}

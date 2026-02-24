use super::map_app_result;
use crate::downloader::{get_version_metadata_impl, get_versions_impl};
use crate::state::AppState;
use crate::utils::get_launcher_dir;
use tauri::State;
use tokio::fs as tokio_fs;

#[tauri::command]
pub async fn get_versions(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    map_app_result(get_versions_impl(&app, &state.manifest_cache).await)
}

#[tauri::command]
pub async fn get_installed_versions(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let versions_dir = get_launcher_dir(&app).join("versions");
    if !tokio_fs::try_exists(&versions_dir).await.unwrap_or(false) {
        return Ok(Vec::new());
    }

    let mut installed = Vec::new();
    if let Ok(mut entries) = tokio::fs::read_dir(versions_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(name) = entry.file_name().into_string() {
                let jar_path = entry.path().join(format!("{}.jar", name));
                let json_path = entry.path().join(format!("{}.json", name));
                let jar_ok = tokio_fs::try_exists(&jar_path).await.unwrap_or(false);
                let json_ok = tokio_fs::try_exists(&json_path).await.unwrap_or(false);
                if jar_ok || json_ok {
                    installed.push(name);
                }
            }
        }
    }
    installed.sort_by(|a, b| b.cmp(a));
    Ok(installed)
}

#[tauri::command]
pub async fn get_version_metadata(
    app: tauri::AppHandle,
    version_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    map_app_result(
        get_version_metadata_impl(&app, version_id, &state.manifest_cache, &state.metadata_cache)
            .await,
    )
}

#[tauri::command]
pub async fn delete_version(app: tauri::AppHandle, version_id: String) -> Result<(), String> {
    let base = get_launcher_dir(&app);
    let version_path = base.join("versions").join(&version_id);
    if tokio_fs::try_exists(&version_path).await.unwrap_or(false) {
        let _ = tokio_fs::remove_dir_all(&version_path).await.map_err(|e| e.to_string());
    } else {
        return Err("La version no existe".to_string());
    }

    if version_id.contains("-forge-") {
        let profiles_path = base.join("profiles").join("forge").join(&version_id);
        if tokio_fs::try_exists(&profiles_path).await.unwrap_or(false) {
            let _ = tokio_fs::remove_dir_all(&profiles_path).await;
        }
    }
    if version_id.contains("-neoforge-") {
        let profiles_path = base.join("profiles").join("neoforge").join(&version_id);
        if tokio_fs::try_exists(&profiles_path).await.unwrap_or(false) {
            let _ = tokio_fs::remove_dir_all(&profiles_path).await;
        }
    }

    Ok(())
}

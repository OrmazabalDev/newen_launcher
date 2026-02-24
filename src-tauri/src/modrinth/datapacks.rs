use crate::downloader::download_file_checked;
use crate::error::{AppError, AppResult};
use crate::utils::append_action_log;
use crate::worlds::world_datapacks_dir;
use tauri::AppHandle;
use tokio::fs as tokio_fs;

use super::client::modrinth_get_version;
use super::shared::{instance_dir, pick_primary_file};

pub async fn modrinth_install_datapack_impl(
    app: &AppHandle,
    instance_id: String,
    world_id: String,
    version_id: String,
) -> AppResult<String> {
    let base = instance_dir(app, &instance_id);
    if !base.exists() {
        return Err("La instancia no existe".to_string().into());
    }

    let world_dir = base.join("saves").join(&world_id);
    if !world_dir.exists() {
        return Err("El mundo no existe".to_string().into());
    }

    let version = modrinth_get_version(app, &version_id).await?;
    let (url, filename, size, sha1) = pick_primary_file(&version)
        .ok_or_else(|| AppError::Message("No hay archivo para instalar".to_string()))?;

    let dest_dir = world_datapacks_dir(app, &instance_id, &world_id);
    tokio_fs::create_dir_all(&dest_dir).await.map_err(|e| AppError::Message(e.to_string()))?;
    let dest = dest_dir.join(filename);
    download_file_checked(url, &dest, size, sha1).await?;

    let _ = append_action_log(
        app,
        &format!(
            "datapack_install instance={} world={} version={}",
            instance_id, world_id, version_id
        ),
    )
    .await;

    Ok(format!("Datapack instalado ({})", filename))
}

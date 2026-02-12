use crate::utils::{append_action_log, get_launcher_dir};
use base64::Engine;
use std::path::PathBuf;
use tauri::AppHandle;
use tokio::fs as tokio_fs;

fn instance_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    get_launcher_dir(app).join("instances").join(instance_id)
}

fn saves_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    instance_dir(app, instance_id).join("saves")
}

fn world_dir(app: &AppHandle, instance_id: &str, world_id: &str) -> PathBuf {
    saves_dir(app, instance_id).join(world_id)
}

pub fn world_datapacks_dir(app: &AppHandle, instance_id: &str, world_id: &str) -> PathBuf {
    world_dir(app, instance_id, world_id).join("datapacks")
}

pub async fn list_instance_worlds_impl(
    app: &AppHandle,
    instance_id: String,
) -> Result<Vec<String>, String> {
    let base = saves_dir(app, &instance_id);
    if !base.exists() {
        return Ok(Vec::new());
    }

    let mut out: Vec<(String, i64)> = Vec::new();
    let mut rd = tokio_fs::read_dir(&base).await.map_err(|e| e.to_string())?;
    while let Ok(Some(entry)) = rd.next_entry().await {
        let path = entry.path();
        let ft = entry.file_type().await.map_err(|e| e.to_string())?;
        if !ft.is_dir() {
            continue;
        }
        let level_dat = path.join("level.dat");
        if !level_dat.exists() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let modified = entry
            .metadata()
            .await
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        out.push((name, modified));
    }

    out.sort_by(|a, b| b.1.cmp(&a.1));
    Ok(out.into_iter().map(|(name, _)| name).collect())
}

pub fn open_world_datapacks_folder_impl(
    app: &AppHandle,
    instance_id: String,
    world_id: String,
) -> Result<(), String> {
    let world = world_dir(app, &instance_id, &world_id);
    if !world.exists() {
        return Err("El mundo no existe".to_string());
    }
    let dir = world_datapacks_dir(app, &instance_id, &world_id);
    if let Some(parent) = dir.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    if cfg!(target_os = "windows") {
        std::process::Command::new("explorer")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    std::process::Command::new("xdg-open")
        .arg(dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn import_datapack_zip_impl(
    app: &AppHandle,
    instance_id: String,
    world_id: String,
    file_name: String,
    data_base64: String,
) -> Result<String, String> {
    let world = world_dir(app, &instance_id, &world_id);
    if !world.exists() {
        return Err("El mundo no existe".to_string());
    }

    let safe_name = std::path::Path::new(&file_name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    if safe_name.is_empty() {
        return Err("Nombre de archivo invalido".to_string());
    }

    if !safe_name.to_lowercase().ends_with(".zip") {
        return Err("Solo se permiten archivos .zip".to_string());
    }

    let dest_dir = world_datapacks_dir(app, &instance_id, &world_id);
    tokio_fs::create_dir_all(&dest_dir)
        .await
        .map_err(|e| e.to_string())?;

    let stem = std::path::Path::new(&safe_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("datapack");
    let ext = std::path::Path::new(&safe_name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("zip");

    let mut target = dest_dir.join(&safe_name);
    if target.exists() {
        for i in 1..=99 {
            let candidate = format!("{}-{}.{}", stem, i, ext);
            let path = dest_dir.join(&candidate);
            if !path.exists() {
                target = path;
                break;
            }
        }
    }

    let data = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|_| "Archivo invalido".to_string())?;

    tokio_fs::write(&target, data)
        .await
        .map_err(|e| e.to_string())?;

    let final_name = target
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("datapack.zip");

    let _ = append_action_log(
        app,
        &format!(
            "datapack_import instance={} world={} file={}",
            instance_id, world_id, final_name
        ),
    )
    .await;

    Ok(format!("Datapack importado ({})", final_name))
}

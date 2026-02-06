use crate::models::ModMetadataEntry;
use crate::utils::get_launcher_dir;
use std::path::PathBuf;
use tauri::AppHandle;
use tokio::fs as tokio_fs;

fn instance_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    get_launcher_dir(app).join("instances").join(instance_id)
}

fn apply_kv(lines: &mut Vec<String>, key: &str, value: &str) {
    let mut found = false;
    for line in lines.iter_mut() {
        if line.starts_with(&format!("{}:", key)) {
            *line = format!("{}:{}", key, value);
            found = true;
            break;
        }
    }
    if !found {
        lines.push(format!("{}:{}", key, value));
    }
}

pub async fn apply_options_profile(
    app: &AppHandle,
    instance_id: &str,
    preset: &str,
) -> Result<(), String> {
    let dir = instance_dir(app, instance_id);
    let options_path = dir.join("options.txt");
    let backup_dir = dir.join(".launcher");
    let backup_path = backup_dir.join("options.backup");
    let mut lines: Vec<String> = Vec::new();
    if let Ok(raw) = tokio_fs::read_to_string(&options_path).await {
        let _ = tokio_fs::create_dir_all(&backup_dir).await;
        let _ = tokio_fs::write(&backup_path, &raw).await;
        lines = raw.lines().map(|s| s.to_string()).collect();
    }

    match preset {
        "competitive" => {
            apply_kv(&mut lines, "graphics", "fast");
            apply_kv(&mut lines, "renderDistance", "6");
            apply_kv(&mut lines, "simulationDistance", "5");
            apply_kv(&mut lines, "entityDistanceScaling", "0.7");
            apply_kv(&mut lines, "clouds", "false");
            apply_kv(&mut lines, "particles", "2");
            apply_kv(&mut lines, "smoothFps", "true");
        }
        "quality" => {
            apply_kv(&mut lines, "graphics", "fancy");
            apply_kv(&mut lines, "renderDistance", "12");
            apply_kv(&mut lines, "simulationDistance", "8");
            apply_kv(&mut lines, "entityDistanceScaling", "1.0");
            apply_kv(&mut lines, "clouds", "true");
            apply_kv(&mut lines, "particles", "0");
            apply_kv(&mut lines, "smoothFps", "true");
        }
        _ => {
            apply_kv(&mut lines, "graphics", "fancy");
            apply_kv(&mut lines, "renderDistance", "10");
            apply_kv(&mut lines, "simulationDistance", "7");
            apply_kv(&mut lines, "entityDistanceScaling", "0.9");
            apply_kv(&mut lines, "clouds", "true");
            apply_kv(&mut lines, "particles", "1");
            apply_kv(&mut lines, "smoothFps", "true");
        }
    }

    let text = lines.join("\n");
    tokio_fs::create_dir_all(&dir)
        .await
        .map_err(|e| e.to_string())?;
    tokio_fs::write(&options_path, text)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn load_installed_projects(app: &AppHandle, instance_id: &str) -> Vec<String> {
    let path = instance_dir(app, instance_id)
        .join(".launcher")
        .join("mods.json");
    if !path.exists() {
        return Vec::new();
    }
    if let Ok(raw) = tokio_fs::read_to_string(path).await {
        if let Ok(entries) = serde_json::from_str::<Vec<ModMetadataEntry>>(&raw) {
            return entries
                .into_iter()
                .filter(|e| e.kind.as_deref().unwrap_or("mods") == "mods")
                .filter_map(|e| e.project_id)
                .collect();
        }
    }
    Vec::new()
}

pub async fn backup_mods_snapshot(
    app: &AppHandle,
    instance_id: &str,
    files: &[String],
) -> Result<(), String> {
    let dir = instance_dir(app, instance_id).join(".launcher");
    tokio_fs::create_dir_all(&dir)
        .await
        .map_err(|e| e.to_string())?;
    let path = dir.join("optimization.mods.backup.json");
    let raw = serde_json::to_string_pretty(files).map_err(|e| e.to_string())?;
    tokio_fs::write(path, raw)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn restore_options_backup(app: &AppHandle, instance_id: &str) -> Result<(), String> {
    let dir = instance_dir(app, instance_id).join(".launcher");
    let backup_path = dir.join("options.backup");
    if !backup_path.exists() {
        return Err("No hay backup de options.txt".to_string());
    }
    let raw = tokio_fs::read_to_string(&backup_path)
        .await
        .map_err(|e| e.to_string())?;
    let target = instance_dir(app, instance_id).join("options.txt");
    tokio_fs::write(target, raw)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn restore_mods_snapshot(app: &AppHandle, instance_id: &str) -> Result<u32, String> {
    let dir = instance_dir(app, instance_id);
    let backup_path = dir.join(".launcher").join("optimization.mods.backup.json");
    if !backup_path.exists() {
        return Err("No hay backup de mods optimizados".to_string());
    }
    let raw = tokio_fs::read_to_string(&backup_path)
        .await
        .map_err(|e| e.to_string())?;
    let list: Vec<String> = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if list.is_empty() {
        return Ok(0);
    }
    let mods_dir = dir.join("mods");
    let mut removed = 0u32;
    for name in list {
        let path = mods_dir.join(&name);
        if path.exists() {
            let _ = tokio_fs::remove_file(&path).await;
            removed += 1;
        }
    }
    Ok(removed)
}

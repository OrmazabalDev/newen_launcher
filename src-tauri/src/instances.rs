use crate::models::{Instance, InstanceCreateRequest, InstanceSummary, InstanceUpdateRequest};
use crate::utils::get_launcher_dir;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tokio::fs as tokio_fs;
use uuid::Uuid;

use crate::error::AppResult;
fn instances_file(app: &AppHandle) -> PathBuf {
    get_launcher_dir(app).join("instances.json")
}

fn instances_root(app: &AppHandle) -> PathBuf {
    get_launcher_dir(app).join("instances")
}

fn instance_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    instances_root(app).join(instance_id)
}

fn mods_cache_path(app: &AppHandle, instance_id: &str) -> PathBuf {
    instance_dir(app, instance_id).join("mods.cache.json")
}

async fn load_cached_mods_count(app: &AppHandle, instance_id: &str) -> Option<u32> {
    let path = mods_cache_path(app, instance_id);
    if !path.exists() {
        return None;
    }
    if let Ok(raw) = tokio_fs::read_to_string(&path).await {
        if let Ok(val) = serde_json::from_str::<u32>(&raw) {
            return Some(val);
        }
    }
    None
}

async fn save_cached_mods_count(app: &AppHandle, instance_id: &str, count: u32) {
    let path = mods_cache_path(app, instance_id);
    if let Some(parent) = path.parent() {
        let _ = tokio_fs::create_dir_all(parent).await;
    }
    let payload = serde_json::to_string(&count).unwrap_or_else(|_| count.to_string());
    let _ = tokio_fs::write(path, payload).await;
}

fn now_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

async fn load_instances(app: &AppHandle) -> AppResult<Vec<Instance>> {
    let path = instances_file(app);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = tokio_fs::read_to_string(&path)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let trimmed = raw.trim_start_matches('\u{feff}').trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let parsed: Vec<Instance> = serde_json::from_str(trimmed)
        .map_err(|e| crate::error::AppError::Message(format!("instances.json invalido: {}", e)))?;
    Ok(parsed)
}

pub async fn get_instance_impl(app: &AppHandle, instance_id: &str) -> AppResult<Instance> {
    let instances = load_instances(app).await?;
    instances
        .into_iter()
        .find(|i| i.id == instance_id)
        .ok_or_else(|| crate::error::AppError::Message("Instancia no encontrada".to_string()))
}

async fn save_instances(app: &AppHandle, instances: &[Instance]) -> AppResult<()> {
    let path = instances_file(app);
    if let Some(parent) = path.parent() {
        tokio_fs::create_dir_all(parent)
            .await
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    }
    let tmp = path.with_extension("tmp");
    let json = serde_json::to_string_pretty(instances)
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    tokio_fs::write(&tmp, json)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    tokio_fs::rename(&tmp, &path)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    Ok(())
}

fn normalize_loader(loader: &str) -> AppResult<String> {
    let lowered = loader.trim().to_lowercase();
    match lowered.as_str() {
        "vanilla" | "snapshot" | "forge" | "fabric" | "neoforge" => Ok(lowered),
        _ => Err("Loader inválido (usa vanilla, snapshot, forge, neoforge o fabric)"
            .to_string()
            .into()),
    }
}

async fn count_mods(dir: &Path) -> u32 {
    let mods_dir = dir.join("mods");
    let mut count = 0u32;
    if let Ok(mut rd) = tokio_fs::read_dir(&mods_dir).await {
        while let Ok(Some(entry)) = rd.next_entry().await {
            if let Ok(ft) = entry.file_type().await {
                if ft.is_file() {
                    if let Some(ext) = entry.path().extension().and_then(|s| s.to_str()) {
                        if ext.eq_ignore_ascii_case("jar") {
                            count += 1;
                        }
                    }
                }
            }
        }
    }
    count
}

async fn refresh_mods_cache(app: &AppHandle, instance_id: &str) {
    let count = count_mods(&instance_dir(app, instance_id)).await;
    save_cached_mods_count(app, instance_id, count).await;
}

pub async fn refresh_instance_mods_cache(app: &AppHandle, instance_id: &str) -> AppResult<u32> {
    let count = count_mods(&instance_dir(app, instance_id)).await;
    save_cached_mods_count(app, instance_id, count).await;
    Ok(count)
}

async fn build_summary(app: &AppHandle, instance: &Instance) -> InstanceSummary {
    let mods_count = if let Some(cached) = load_cached_mods_count(app, &instance.id).await {
        cached
    } else if let Some(cached) = instance.mods_cached_count {
        if cached > 0 {
            cached
        } else {
            count_mods(&instance_dir(app, &instance.id)).await
        }
    } else {
        count_mods(&instance_dir(app, &instance.id)).await
    };
    InstanceSummary {
        id: instance.id.clone(),
        name: instance.name.clone(),
        version: instance.version.clone(),
        loader: instance.loader.clone(),
        thumbnail: instance.thumbnail.clone(),
        tags: instance.tags.clone(),
        created_at: instance.created_at,
        last_played: instance.last_played,
        mods_count,
    }
}

pub async fn list_instances_impl(app: &AppHandle) -> AppResult<Vec<InstanceSummary>> {
    let instances = load_instances(app).await?;
    let mut out = Vec::new();
    for inst in instances.iter() {
        out.push(build_summary(app, inst).await);
        let app_handle = app.clone();
        let inst_id = inst.id.clone();
        tokio::spawn(async move {
            refresh_mods_cache(&app_handle, &inst_id).await;
        });
    }
    out.sort_by(|a, b| b.last_played.unwrap_or(0).cmp(&a.last_played.unwrap_or(0)));
    Ok(out)
}

pub async fn create_instance_impl(
    app: &AppHandle,
    req: InstanceCreateRequest,
) -> AppResult<InstanceSummary> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err("El nombre de la instancia es obligatorio".to_string().into());
    }
    let loader = normalize_loader(&req.loader)?;

    if loader == "forge" && !req.version.contains("forge") {
        return Err("La versión Forge debe contener 'forge' en el ID".to_string().into());
    }
    if loader == "fabric" && !req.version.contains("fabric") {
        return Err("La versión Fabric debe contener 'fabric' en el ID".to_string().into());
    }
    if loader == "neoforge" && !req.version.contains("neoforge") {
        return Err("La versión NeoForge debe contener 'neoforge' en el ID".to_string().into());
    }
    if loader == "snapshot"
        && (req.version.contains("forge")
            || req.version.contains("neoforge")
            || req.version.contains("fabric"))
    {
        return Err("Las snapshots no pueden ser Forge/NeoForge/Fabric".to_string().into());
    }

    let versions_dir = get_launcher_dir(app).join("versions");
    let version_path = versions_dir.join(&req.version);
    if !version_path.exists() {
        return Err("La versión no está instalada".to_string().into());
    }

    let mut instances = load_instances(app).await?;
    let id = Uuid::new_v4().to_string();
    let instance = Instance {
        id: id.clone(),
        name: name.to_string(),
        version: req.version,
        loader,
        thumbnail: req.thumbnail,
        tags: req.tags.unwrap_or_default(),
        created_at: now_millis(),
        last_played: None,
        mods_cached_count: Some(0),
    };
    instances.push(instance.clone());
    save_instances(app, &instances).await?;

    let dir = instance_dir(app, &id);
    tokio_fs::create_dir_all(dir.join("mods"))
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    tokio_fs::create_dir_all(dir.join("config"))
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let _ = tokio_fs::create_dir_all(dir.join("resourcepacks")).await;
    let _ = tokio_fs::create_dir_all(dir.join("shaderpacks")).await;

    Ok(build_summary(app, &instance).await)
}

pub async fn update_instance_impl(
    app: &AppHandle,
    instance_id: String,
    req: InstanceUpdateRequest,
) -> AppResult<InstanceSummary> {
    let mut instances = load_instances(app).await?;
    let mut found = None;
    for inst in &mut instances {
        if inst.id == instance_id {
            if let Some(name) = req.name.as_ref() {
                if !name.trim().is_empty() {
                    inst.name = name.trim().to_string();
                }
            }
            if let Some(thumbnail) = req.thumbnail {
                inst.thumbnail = if thumbnail.trim().is_empty() { None } else { Some(thumbnail) };
            }
            if let Some(tags) = req.tags {
                inst.tags = tags;
            }
            if inst.mods_cached_count.is_none() {
                inst.mods_cached_count = load_cached_mods_count(app, &instance_id).await;
            }
            found = Some(inst.clone());
            break;
        }
    }
    let instance = found
        .ok_or_else(|| crate::error::AppError::Message("Instancia no encontrada".to_string()))?;
    save_instances(app, &instances).await?;
    Ok(build_summary(app, &instance).await)
}

pub async fn delete_instance_impl(app: &AppHandle, instance_id: String) -> AppResult<()> {
    let _ =
        crate::utils::append_action_log(app, &format!("instance_delete instance={}", instance_id))
            .await;
    let mut instances = load_instances(app).await?;
    let before = instances.len();
    instances.retain(|i| i.id != instance_id);
    if instances.len() == before {
        return Err("Instancia no encontrada".to_string().into());
    }
    save_instances(app, &instances).await?;
    let dir = instance_dir(app, &instance_id);
    if dir.exists() {
        tokio_fs::remove_dir_all(dir)
            .await
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    }
    Ok(())
}

pub async fn touch_instance_impl(app: &AppHandle, instance_id: &str) -> AppResult<()> {
    let mut instances = load_instances(app).await?;
    let mut changed = false;
    for inst in &mut instances {
        if inst.id == instance_id {
            inst.last_played = Some(now_millis());
            changed = true;
            break;
        }
    }
    if changed {
        save_instances(app, &instances).await?;
    }
    Ok(())
}

pub fn open_instance_folder_impl(app: &AppHandle, instance_id: String) -> AppResult<()> {
    let path = instance_dir(app, &instance_id);
    if !path.exists() {
        return Err("La carpeta de la instancia no existe".to_string().into());
    }

    if cfg!(target_os = "windows") {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        return Ok(());
    }
    if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        return Ok(());
    }
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    Ok(())
}

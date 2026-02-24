use crate::instances::refresh_instance_mods_cache;
use crate::models::{InstanceContentItem, InstanceLogEntry, ModMetadataEntry};
use crate::utils::get_launcher_dir;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tokio::fs as tokio_fs;

use crate::error::AppResult;
fn instance_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    get_launcher_dir(app).join("instances").join(instance_id)
}

fn instance_kind_dir(app: &AppHandle, instance_id: &str, kind: &str) -> AppResult<PathBuf> {
    let base = instance_dir(app, instance_id);
    match kind {
        "mods" => Ok(base.join("mods")),
        "resourcepacks" => Ok(base.join("resourcepacks")),
        "shaderpacks" => Ok(base.join("shaderpacks")),
        _ => Err("Tipo inválido (mods/resourcepacks/shaderpacks)".to_string().into()),
    }
}

fn metadata_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    instance_dir(app, instance_id).join(".launcher")
}

fn mods_metadata_path(app: &AppHandle, instance_id: &str) -> PathBuf {
    metadata_dir(app, instance_id).join("mods.json")
}

async fn load_mods_metadata(app: &AppHandle, instance_id: &str) -> Vec<ModMetadataEntry> {
    let path = mods_metadata_path(app, instance_id);
    if !path.exists() {
        return Vec::new();
    }
    if let Ok(raw) = tokio_fs::read_to_string(&path).await {
        if let Ok(parsed) = serde_json::from_str::<Vec<ModMetadataEntry>>(&raw) {
            return parsed;
        }
    }
    Vec::new()
}

fn metadata_kind_matches(entry_kind: &Option<String>, kind: &str) -> bool {
    match entry_kind.as_deref() {
        Some(k) => k == kind,
        None => kind == "mods",
    }
}

async fn save_mods_metadata(app: &AppHandle, instance_id: &str, entries: &[ModMetadataEntry]) {
    let path = mods_metadata_path(app, instance_id);
    if let Some(parent) = path.parent() {
        let _ = tokio_fs::create_dir_all(parent).await;
    }
    if let Ok(raw) = serde_json::to_string_pretty(entries) {
        let _ = tokio_fs::write(path, raw).await;
    }
}

fn strip_disabled(name: &str) -> (String, bool) {
    if name.ends_with(".disabled") {
        (name.trim_end_matches(".disabled").to_string(), false)
    } else {
        (name.to_string(), true)
    }
}

fn is_allowed_file(kind: &str, path: &Path) -> bool {
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    match kind {
        "mods" => ext == "jar" || ext == "disabled",
        "resourcepacks" | "shaderpacks" => ext == "zip" || ext == "disabled",
        _ => false,
    }
}

fn path_modified_millis(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub async fn list_instance_content_impl(
    app: &AppHandle,
    instance_id: String,
    kind: String,
) -> AppResult<Vec<InstanceContentItem>> {
    let dir = instance_kind_dir(app, &instance_id, &kind)?;
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let metadata = load_mods_metadata(app, &instance_id).await;

    let mut required_by_map: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    if kind == "mods" {
        for entry in &metadata {
            if !metadata_kind_matches(&entry.kind, "mods") {
                continue;
            }
            for dep in &entry.dependencies {
                required_by_map.entry(dep.clone()).or_default().push(entry.file_name.clone());
            }
        }
    }

    let mut out = Vec::new();
    let mut rd = tokio_fs::read_dir(&dir)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    while let Ok(Some(entry)) = rd.next_entry().await {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if !is_allowed_file(&kind, &path) {
            continue;
        }
        let file_name = entry.file_name().to_string_lossy().to_string();
        let (display_name, enabled) = strip_disabled(&file_name);
        let meta =
            entry.metadata().await.map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        let size = meta.len();
        let modified = path_modified_millis(&meta);

        let mut required_by = Vec::new();
        let mut source = None;
        let mut project_id = None;
        let mut version_id = None;
        let lookup = if enabled { file_name.clone() } else { display_name.clone() };
        if let Some(entry_meta) = metadata
            .iter()
            .find(|m| m.file_name == lookup && metadata_kind_matches(&m.kind, &kind))
            .or_else(|| {
                metadata
                    .iter()
                    .find(|m| m.file_name == file_name && metadata_kind_matches(&m.kind, &kind))
            })
        {
            source = entry_meta.source.clone();
            project_id = entry_meta.project_id.clone();
            version_id = entry_meta.version_id.clone();
            if kind == "mods" {
                if let Some(v) = &entry_meta.version_id {
                    if let Some(list) = required_by_map.get(v) {
                        required_by.extend(list.clone());
                    }
                }
                if let Some(p) = &entry_meta.project_id {
                    if let Some(list) = required_by_map.get(p) {
                        required_by.extend(list.clone());
                    }
                }
            }
        }

        out.push(InstanceContentItem {
            file_name,
            name: display_name,
            enabled,
            size,
            modified,
            kind: kind.clone(),
            required_by,
            source,
            project_id,
            version_id,
        });
    }

    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}

pub async fn toggle_instance_content_impl(
    app: &AppHandle,
    instance_id: String,
    kind: String,
    file_name: String,
    enabled: bool,
) -> AppResult<()> {
    let dir = instance_kind_dir(app, &instance_id, &kind)?;
    let path = dir.join(&file_name);
    if !path.exists() {
        return Err("Archivo no encontrado".to_string().into());
    }
    let (clean_name, is_enabled) = strip_disabled(&file_name);
    if enabled == is_enabled {
        return Ok(());
    }
    let new_name = if enabled { clean_name } else { format!("{}.disabled", clean_name) };
    tokio_fs::rename(&path, dir.join(&new_name))
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    if kind == "mods" {
        let _ = refresh_instance_mods_cache(app, &instance_id).await;
    }
    Ok(())
}

pub async fn delete_instance_content_impl(
    app: &AppHandle,
    instance_id: String,
    kind: String,
    file_name: String,
) -> AppResult<()> {
    let dir = instance_kind_dir(app, &instance_id, &kind)?;
    let path = dir.join(&file_name);
    if !path.exists() {
        return Err("Archivo no encontrado".to_string().into());
    }
    tokio_fs::remove_file(path)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;

    if kind == "mods" || kind == "resourcepacks" || kind == "shaderpacks" {
        let (clean_name, _) = strip_disabled(&file_name);
        let target_kind = if kind == "mods" {
            "mods"
        } else if kind == "resourcepacks" {
            "resourcepacks"
        } else {
            "shaderpacks"
        };
        let mut metadata = load_mods_metadata(app, &instance_id).await;
        metadata.retain(|m| {
            let matches_kind = metadata_kind_matches(&m.kind, target_kind);
            if !matches_kind {
                return true;
            }
            m.file_name != file_name && m.file_name != clean_name
        });
        save_mods_metadata(app, &instance_id, &metadata).await;
        if kind == "mods" {
            let _ = refresh_instance_mods_cache(app, &instance_id).await;
        }
    }
    Ok(())
}

pub fn open_instance_content_folder_impl(
    app: &AppHandle,
    instance_id: String,
    kind: String,
) -> AppResult<()> {
    let dir = instance_kind_dir(app, &instance_id, &kind)?;
    if !dir.exists() {
        return Err("La carpeta no existe".to_string().into());
    }

    if cfg!(target_os = "windows") {
        std::process::Command::new("explorer")
            .arg(dir)
            .spawn()
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        return Ok(());
    }
    if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg(dir)
            .spawn()
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        return Ok(());
    }
    std::process::Command::new("xdg-open")
        .arg(dir)
        .spawn()
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    Ok(())
}

fn logs_dir(instance_dir: &Path) -> PathBuf {
    instance_dir.join("logs")
}

fn crashes_dir(instance_dir: &Path) -> PathBuf {
    instance_dir.join("crash-reports")
}

async fn list_dir_entries(dir: &Path, kind: &str) -> Vec<InstanceLogEntry> {
    let mut out = Vec::new();
    if !dir.exists() {
        return out;
    }
    if let Ok(mut rd) = tokio_fs::read_dir(dir).await {
        while let Ok(Some(entry)) = rd.next_entry().await {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            if let Ok(meta) = entry.metadata().await {
                let name = entry.file_name().to_string_lossy().to_string();
                out.push(InstanceLogEntry {
                    name,
                    kind: kind.to_string(),
                    size: meta.len(),
                    modified: path_modified_millis(&meta),
                });
            }
        }
    }
    out
}

pub async fn list_instance_reports_impl(
    app: &AppHandle,
    instance_id: String,
) -> AppResult<Vec<InstanceLogEntry>> {
    let base = instance_dir(app, &instance_id);
    if !base.exists() {
        return Err("La instancia no existe".to_string().into());
    }
    let mut out = Vec::new();
    out.extend(list_dir_entries(&logs_dir(&base), "log").await);
    out.extend(list_dir_entries(&crashes_dir(&base), "crash").await);
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}

async fn read_tail(path: &Path, max_bytes: u64) -> AppResult<String> {
    let path = path.to_path_buf();
    let data = tokio::task::spawn_blocking(move || -> AppResult<Vec<u8>> {
        use std::io::{Read, Seek, SeekFrom};
        let mut file = std::fs::File::open(&path)
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        let len =
            file.metadata().map_err(|e| crate::error::AppError::Message(e.to_string()))?.len();
        let start = len.saturating_sub(max_bytes);
        file.seek(SeekFrom::Start(start))
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf).map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        Ok(buf)
    })
    .await
    .map_err(|e| crate::error::AppError::Message(e.to_string()))??;
    String::from_utf8(data).map_err(|e| crate::error::AppError::Message(e.to_string()))
}

pub async fn read_instance_report_impl(
    app: &AppHandle,
    instance_id: String,
    kind: String,
    name: String,
) -> AppResult<String> {
    let base = instance_dir(app, &instance_id);
    if !base.exists() {
        return Err("La instancia no existe".to_string().into());
    }
    let folder = match kind.as_str() {
        "log" => logs_dir(&base),
        "crash" => crashes_dir(&base),
        _ => return Err("Tipo inválido".to_string().into()),
    };
    let path = folder.join(name);
    if !path.exists() {
        return Err("Archivo no encontrado".to_string().into());
    }
    read_tail(&path, 512 * 1024).await
}

pub async fn upsert_mod_metadata(
    app: &AppHandle,
    instance_id: &str,
    entry: ModMetadataEntry,
) -> AppResult<()> {
    let mut entries = load_mods_metadata(app, instance_id).await;
    let target_kind = entry.kind.clone().unwrap_or_else(|| "mods".to_string());
    if let Some(existing) = entries
        .iter_mut()
        .find(|e| e.file_name == entry.file_name && metadata_kind_matches(&e.kind, &target_kind))
    {
        *existing = entry;
    } else {
        entries.push(entry);
    }
    save_mods_metadata(app, instance_id, &entries).await;
    Ok(())
}

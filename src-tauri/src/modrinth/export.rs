use crate::error::{AppError, AppResult};
use crate::models::Instance;
use crate::utils::append_action_log;
use serde_json::json;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tokio::fs as tokio_fs;
use zip::write::FileOptions;

use super::shared::{instance_dir, modpack_exports_dir};

fn resolve_export_path(
    app: &AppHandle,
    inst: &Instance,
    dest_path: Option<String>,
) -> AppResult<PathBuf> {
    let safe_name = sanitize_pack_name(&inst.name);
    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    if let Some(path) = dest_path {
        let mut target = PathBuf::from(path);
        if target.exists() && target.is_dir() {
            target = target.join(format!("{}_{}.mrpack", safe_name, ts));
        } else if target.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase())
            != Some("mrpack".to_string())
        {
            target.set_extension("mrpack");
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Message(e.to_string()))?;
        }
        return Ok(target);
    }

    let export_dir = modpack_exports_dir(app);
    std::fs::create_dir_all(&export_dir).map_err(|e| AppError::Message(e.to_string()))?;
    Ok(export_dir.join(format!("{}_{}.mrpack", safe_name, ts)))
}

fn sanitize_pack_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "modpack".to_string();
    }
    trimmed.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect()
}

fn extract_base_version(version_id: &str) -> String {
    if let Some((base, _)) = version_id.split_once("-forge-") {
        return base.to_string();
    }
    if let Some((base, _)) = version_id.split_once("-neoforge-") {
        return base.to_string();
    }
    if let Some(raw) = version_id.strip_prefix("neoforge-") {
        let parts: Vec<&str> = raw.split('.').collect();
        let minor = parts.first().and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
        let patch = parts.get(1).and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
        if minor > 0 {
            return if patch > 0 {
                format!("1.{}.{}", minor, patch)
            } else {
                format!("1.{}", minor)
            };
        }
    }
    if version_id.starts_with("fabric-loader-") {
        let parts: Vec<&str> = version_id.split('-').collect();
        return parts.last().unwrap_or(&version_id).to_string();
    }
    version_id.to_string()
}

fn parse_loader_version(inst: &Instance) -> (String, HashMap<String, String>) {
    let mut deps = HashMap::new();
    let mc_version = extract_base_version(&inst.version);
    deps.insert("minecraft".to_string(), mc_version.clone());
    match inst.loader.as_str() {
        "fabric" => {
            if inst.version.starts_with("fabric-loader-") {
                let parts: Vec<&str> = inst.version.split('-').collect();
                if parts.len() >= 3 {
                    let loader_version = parts[2].to_string();
                    deps.insert("fabric-loader".to_string(), loader_version);
                }
            }
        }
        "forge" => {
            if let Some((_, forge_version)) = inst.version.split_once("-forge-") {
                deps.insert("forge".to_string(), forge_version.to_string());
            }
        }
        "neoforge" => {
            if let Some((_, neo_version)) = inst.version.split_once("-neoforge-") {
                deps.insert("neoforge".to_string(), neo_version.to_string());
            }
        }
        _ => {}
    }
    (mc_version, deps)
}

fn should_skip_override(rel: &Path) -> bool {
    let mut components = rel.components();
    let first = match components.next() {
        Some(c) => c.as_os_str().to_string_lossy().to_string(),
        None => return true,
    };
    matches!(
        first.as_str(),
        "logs" | "crash-reports" | "saves" | "backups" | ".launcher" | "screenshots" | "cache"
    )
}

fn add_overrides_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    base: &Path,
    dir: &Path,
    options: FileOptions,
) -> AppResult<()> {
    for entry in std::fs::read_dir(dir).map_err(|e| AppError::Message(e.to_string()))? {
        let entry = entry.map_err(|e| AppError::Message(e.to_string()))?;
        let path = entry.path();
        let rel = path.strip_prefix(base).map_err(|e| AppError::Message(e.to_string()))?;
        if rel.as_os_str().is_empty() {
            continue;
        }
        if should_skip_override(rel) {
            continue;
        }
        if path.is_dir() {
            add_overrides_to_zip(zip, base, &path, options)?;
            continue;
        }
        if rel.file_name().and_then(|s| s.to_str()) == Some("mods.cache.json") {
            continue;
        }
        let rel_name = rel.to_string_lossy().replace('\\', "/");
        let zip_name = format!("overrides/{}", rel_name);
        zip.start_file(zip_name, options).map_err(|e| AppError::Message(e.to_string()))?;
        let mut f = std::fs::File::open(&path).map_err(|e| AppError::Message(e.to_string()))?;
        std::io::copy(&mut f, zip).map_err(|e| AppError::Message(e.to_string()))?;
    }
    Ok(())
}

pub async fn export_modpack_mrpack_impl(
    app: &AppHandle,
    instance_id: String,
    dest_path: Option<String>,
) -> AppResult<String> {
    let inst = crate::instances::get_instance_impl(app, &instance_id).await?;
    let instance_dir = instance_dir(app, &instance_id);
    if !tokio_fs::try_exists(&instance_dir).await.unwrap_or(false) {
        return Err("La instancia no existe".to_string().into());
    }

    let (_mc_version, deps) = parse_loader_version(&inst);
    let index_json = json!({
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": inst.id,
        "name": inst.name,
        "summary": "Exportado desde Newen Launcher",
        "files": [],
        "dependencies": deps,
    });

    let app_handle = app.clone();
    let inst_clone = inst.clone();
    let instance_dir_clone = instance_dir.clone();
    let dest_path_clone = dest_path.clone();
    let index_json_clone = index_json.clone();

    let zip_path = tokio::task::spawn_blocking(move || -> AppResult<PathBuf> {
        let zip_path = resolve_export_path(&app_handle, &inst_clone, dest_path_clone)?;

        let file =
            std::fs::File::create(&zip_path).map_err(|e| AppError::Message(e.to_string()))?;
        let mut zip = zip::ZipWriter::new(file);
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        let index_raw = serde_json::to_vec_pretty(&index_json_clone)
            .map_err(|e| AppError::Message(e.to_string()))?;
        zip.start_file("modrinth.index.json", options)
            .map_err(|e| AppError::Message(e.to_string()))?;
        std::io::Write::write_all(&mut zip, &index_raw)
            .map_err(|e| AppError::Message(e.to_string()))?;

        add_overrides_to_zip(&mut zip, &instance_dir_clone, &instance_dir_clone, options)?;

        zip.finish().map_err(|e| AppError::Message(e.to_string()))?;
        Ok(zip_path)
    })
    .await
    .map_err(|e| AppError::Message(e.to_string()))??;
    let _ = append_action_log(
        app,
        &format!("modpack_export instance={} path={}", instance_id, zip_path.to_string_lossy()),
    )
    .await;
    Ok(zip_path.to_string_lossy().to_string())
}

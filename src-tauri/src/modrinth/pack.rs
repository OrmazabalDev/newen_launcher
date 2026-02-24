use crate::downloader::download_file_checked;
use crate::error::{AppError, AppResult};
use crate::models::{ModrinthPackIndex, ModrinthVersion, ProgressPayload};
use crate::utils::get_launcher_dir;
use futures_util::{stream, StreamExt};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;
use zip::ZipArchive;

use super::shared::{instance_dir, pick_primary_file};

const MODPACK_CONCURRENCY: usize = 8;

fn parse_pack_index(raw: &str) -> AppResult<ModrinthPackIndex> {
    let trimmed = raw.trim_start_matches('\u{feff}').trim();
    if trimmed.is_empty() {
        return Err("modrinth.index.json esta vacio".to_string().into());
    }
    serde_json::from_str(trimmed).map_err(|e| {
        let preview: String = trimmed.chars().take(120).collect();
        AppError::Message(format!("Error parseando modrinth.index.json: {} ({})", e, preview))
    })
}

pub(super) fn zip_read_index(pack_path: &Path) -> AppResult<ModrinthPackIndex> {
    let file = std::fs::File::open(pack_path).map_err(|e| AppError::Message(e.to_string()))?;
    let mut archive = ZipArchive::new(file).map_err(|e| AppError::Message(e.to_string()))?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| AppError::Message(e.to_string()))?;
        let name = entry.name().replace('\\', "/");
        if name == "modrinth.index.json" {
            let mut data = String::new();
            entry.read_to_string(&mut data).map_err(|e| AppError::Message(e.to_string()))?;
            return parse_pack_index(&data);
        }
    }
    Err("modrinth.index.json no encontrado".to_string().into())
}

fn zip_extract_overrides(pack_path: &Path, instance_base: &Path) -> AppResult<ModrinthPackIndex> {
    let file = std::fs::File::open(pack_path).map_err(|e| AppError::Message(e.to_string()))?;
    let mut archive = ZipArchive::new(file).map_err(|e| AppError::Message(e.to_string()))?;
    let mut index_raw = None;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| AppError::Message(e.to_string()))?;
        let name = entry.name().replace('\\', "/");
        if name == "modrinth.index.json" {
            let mut data = String::new();
            entry.read_to_string(&mut data).map_err(|e| AppError::Message(e.to_string()))?;
            index_raw = Some(data);
            continue;
        }

        let rel = if let Some(rest) = name.strip_prefix("overrides/") {
            rest
        } else if let Some(rest) = name.strip_prefix("client-overrides/") {
            rest
        } else {
            continue;
        };

        if rel.is_empty() || rel.contains("..") || rel.starts_with('/') || rel.starts_with('\\') {
            continue;
        }

        let dest = instance_base.join(rel);
        if entry.is_dir() {
            std::fs::create_dir_all(&dest).map_err(|e| AppError::Message(e.to_string()))?;
        } else {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent).map_err(|e| AppError::Message(e.to_string()))?;
            }
            let mut out =
                std::fs::File::create(&dest).map_err(|e| AppError::Message(e.to_string()))?;
            std::io::copy(&mut entry, &mut out).map_err(|e| AppError::Message(e.to_string()))?;
        }
    }

    let raw = index_raw
        .ok_or_else(|| AppError::Message("modrinth.index.json no encontrado".to_string()))?;
    parse_pack_index(&raw)
}

pub(super) async fn download_modpack_file(
    app: &AppHandle,
    version: &ModrinthVersion,
) -> AppResult<PathBuf> {
    let (url, filename, size, sha1) = pick_primary_file(version)
        .ok_or_else(|| AppError::Message("No hay archivo de modpack".to_string()))?;
    let cache_dir = get_launcher_dir(app).join("cache").join("modpacks");
    tokio_fs::create_dir_all(&cache_dir).await.map_err(|e| AppError::Message(e.to_string()))?;
    let safe_name = if filename.ends_with(".mrpack") {
        filename.to_string()
    } else {
        format!("{}.mrpack", version.id)
    };
    let pack_path = cache_dir.join(safe_name);
    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Descargando modpack...".to_string(), percent: 5.0 },
    );
    download_file_checked(url, &pack_path, size, sha1).await?;
    Ok(pack_path)
}

pub(super) async fn install_modpack_from_pack(
    app: &AppHandle,
    instance_id: &str,
    pack_path: &Path,
) -> AppResult<usize> {
    let base = instance_dir(app, instance_id);
    tokio_fs::create_dir_all(&base).await.map_err(|e| AppError::Message(e.to_string()))?;

    let base_clone = base.clone();
    let pack_path_clone = pack_path.to_path_buf();
    let index =
        tokio::task::spawn_blocking(move || zip_extract_overrides(&pack_path_clone, &base_clone))
            .await
            .map_err(|e| AppError::Message(e.to_string()))??;

    let mut specs: Vec<(String, PathBuf, u64, Option<String>)> = Vec::new();
    for entry in index.files {
        if entry.path.contains("..") || entry.path.starts_with('/') || entry.path.starts_with('\\')
        {
            return Err("Ruta invalida en modpack".to_string().into());
        }
        if let Some(env) = &entry.env {
            if let Some(client) = &env.client {
                if client == "unsupported" {
                    continue;
                }
            }
        }
        if entry.downloads.is_empty() {
            continue;
        }
        let url = entry.downloads[0].clone();
        let sha1 = entry.hashes.get("sha1").map(|s| s.to_string());
        let dest = base.join(&entry.path);
        specs.push((url, dest, entry.file_size, sha1));
    }

    if specs.is_empty() {
        let _ = app.emit(
            "download-progress",
            ProgressPayload { task: "Modpack listo".to_string(), percent: 100.0 },
        );
        return Ok(0);
    }

    let total = specs.len();
    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: format!("Instalando modpack 0/{}", total), percent: 10.0 },
    );

    let mut stream = stream::iter(specs.into_iter().map(|(url, dest, size, sha1)| async move {
        download_file_checked(&url, &dest, size, sha1.as_deref()).await
    }))
    .buffer_unordered(MODPACK_CONCURRENCY);

    let mut installed = 0usize;
    while let Some(res) = stream.next().await {
        res?;
        installed += 1;
        let pct = 10.0 + (installed as f64 / total as f64) * 90.0;
        let _ = app.emit(
            "download-progress",
            ProgressPayload {
                task: format!("Instalando modpack {}/{}", installed, total),
                percent: pct.min(100.0),
            },
        );
    }

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Modpack listo".to_string(), percent: 100.0 },
    );
    Ok(installed)
}

pub(super) async fn install_modpack(
    app: &AppHandle,
    instance_id: &str,
    version: &ModrinthVersion,
    loader: Option<&str>,
) -> AppResult<usize> {
    let pack_path = download_modpack_file(app, version).await?;
    let pack_path_clone = pack_path.clone();
    let index = tokio::task::spawn_blocking(move || zip_read_index(&pack_path_clone))
        .await
        .map_err(|e| AppError::Message(e.to_string()))??;

    if let Some(l) = loader {
        let requires_forge = index.dependencies.contains_key("forge");
        let requires_neoforge = index.dependencies.contains_key("neoforge");
        let requires_fabric = index.dependencies.contains_key("fabric-loader");
        if requires_forge && l != "forge" {
            return Err("Este modpack requiere Forge.".to_string().into());
        }
        if requires_neoforge && l != "neoforge" {
            return Err("Este modpack requiere NeoForge.".to_string().into());
        }
        if requires_fabric && l != "fabric" {
            return Err("Este modpack requiere Fabric.".to_string().into());
        }
    }

    install_modpack_from_pack(app, instance_id, &pack_path).await
}

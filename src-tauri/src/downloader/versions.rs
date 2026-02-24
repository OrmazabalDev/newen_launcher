use super::download::{download_with_retry, is_valid_file, DownloadSpec};
use super::http_cache::fetch_text_with_cache;
use crate::error::AppResult;
use crate::models::{ProgressPayload, VersionJson, VersionManifest, VersionMetadata};
use crate::utils::{create_client, get_launcher_dir};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;

pub async fn get_versions_impl(
    app: &AppHandle,
    manifest_cache: &Mutex<Option<VersionManifest>>,
) -> AppResult<Vec<String>> {
    println!("Descargando manifiesto de versiones...");
    let url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
    let text = fetch_text_with_cache(app, url, None, false).await?;
    let manifest: VersionManifest =
        serde_json::from_str(&text).map_err(|e| crate::error::AppError::Message(e.to_string()))?;

    {
        let mut cache = manifest_cache.lock().map_err(|_| "Error lock".to_string())?;
        *cache = Some(manifest.clone());
    }

    let releases = manifest.versions.iter().map(|v| v.id.clone()).collect();
    Ok(releases)
}

pub async fn get_version_metadata_impl(
    app: &AppHandle,
    version_id: String,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> AppResult<String> {
    {
        let cache = metadata_cache.lock().map_err(|_| "Error lock".to_string())?;
        if let Some(meta) = &*cache {
            if meta.id == version_id {
                let java_info = if let Some(j) = &meta.java_version {
                    format!("Java {} ({})", j.major_version, j.component)
                } else {
                    "Java Legacy".to_string()
                };
                return Ok(format!("ID: {}\nRuntime: {}", meta.id, java_info));
            }
        }
    }

    let local_json = get_launcher_dir(app)
        .join("versions")
        .join(&version_id)
        .join(format!("{}.json", version_id));
    if local_json.exists() {
        if let Ok(raw) = tokio_fs::read_to_string(&local_json).await {
            if let Ok(parsed) = serde_json::from_str::<VersionMetadata>(&raw) {
                let mut cache = metadata_cache.lock().map_err(|_| "Error lock".to_string())?;
                *cache = Some(parsed.clone());
                let java_info = if let Some(j) = &parsed.java_version {
                    format!("Java {} ({})", j.major_version, j.component)
                } else {
                    "Java Legacy".to_string()
                };
                return Ok(format!("ID: {}\nRuntime: {}", parsed.id, java_info));
            }
        }
    }

    if manifest_cache.lock().map_err(|_| "Error lock".to_string())?.is_none() {
        let _ = get_versions_impl(app, manifest_cache).await?;
    }

    let target_url = {
        let cache = manifest_cache.lock().map_err(|_| "Error lock".to_string())?;
        if let Some(manifest) = &*cache {
            manifest.versions.iter().find(|v| v.id == version_id).map(|v| v.url.clone())
        } else {
            None
        }
    };
    let url = target_url
        .ok_or_else(|| crate::error::AppError::Message("Version no encontrada".to_string()))?;

    let text = fetch_text_with_cache(app, &url, None, false).await?;
    let metadata: VersionMetadata =
        serde_json::from_str(&text).map_err(|e| crate::error::AppError::Message(e.to_string()))?;

    if let Some(parent) = local_json.parent() {
        let _ = tokio_fs::create_dir_all(parent).await;
    }
    let _ = tokio_fs::write(&local_json, text.as_bytes()).await;

    {
        let mut cache = metadata_cache.lock().map_err(|_| "Error lock".to_string())?;
        *cache = Some(metadata.clone());
    }

    let java_info = if let Some(j) = &metadata.java_version {
        format!("Java {} ({})", j.major_version, j.component)
    } else {
        "Java Legacy".to_string()
    };
    Ok(format!("ID: {}\nRuntime: {}", metadata.id, java_info))
}

pub async fn download_client_impl(
    app: &AppHandle,
    version_id: String,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> AppResult<String> {
    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Verificando cliente...".to_string(), percent: 0.0 },
    );

    let (url, size, sha1, metadata) = {
        let cache = metadata_cache.lock().map_err(|_| "Error lock".to_string())?;
        if let Some(meta) = &*cache {
            if meta.id != version_id {
                return Err("Metadata incorrecta".to_string().into());
            }
            if let Some(dl) = &meta.downloads {
                (dl.client.url.clone(), dl.client.size, dl.client.sha1.clone(), meta.clone())
            } else {
                return Err("No hay descarga de cliente".to_string().into());
            }
        } else {
            return Err("No hay metadata".to_string().into());
        }
    };

    let path = get_launcher_dir(app)
        .join("versions")
        .join(&version_id)
        .join(format!("{}.jar", version_id));
    if let Some(p) = path.parent() {
        tokio_fs::create_dir_all(p)
            .await
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    }

    // Guardar metadata como version json si no existe
    let json_path = get_launcher_dir(app)
        .join("versions")
        .join(&version_id)
        .join(format!("{}.json", version_id));
    if !json_path.exists() {
        if let Ok(json) = serde_json::to_string_pretty(&metadata) {
            let _ = tokio_fs::write(&json_path, json).await;
        }
    }

    if path.exists() && is_valid_file(&path, Some(size), Some(&sha1), true).await? {
        let _ = app.emit(
            "download-progress",
            ProgressPayload { task: "Cliente verificado".to_string(), percent: 100.0 },
        );
        return Ok("OK".to_string());
    }

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Descargando jar del juego...".to_string(), percent: 50.0 },
    );

    let spec = DownloadSpec { url, path, sha1: Some(sha1), size: Some(size) };
    download_with_retry(Arc::new(create_client()), spec, super::DOWNLOAD_RETRIES).await?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Cliente completado".to_string(), percent: 100.0 },
    );
    Ok("OK".to_string())
}

pub(crate) async fn load_version_json_from_disk(
    app: &AppHandle,
    version_id: &str,
) -> AppResult<VersionJson> {
    let path = get_launcher_dir(app)
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));
    if !path.exists() {
        return Err(format!("No existe version json para {}", version_id).into());
    }
    let raw = tokio_fs::read_to_string(&path)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let trimmed = raw.trim_start_matches('\u{feff}').trim();
    if trimmed.is_empty() {
        return Err("Version json vacio".to_string().into());
    }
    serde_json::from_str(trimmed).map_err(|e| crate::error::AppError::Message(e.to_string()))
}

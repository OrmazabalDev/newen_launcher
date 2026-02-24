use super::download::{is_valid_file, DownloadSpec};
use super::http_cache::fetch_text_with_cache;
use super::libraries::build_library_specs;
use crate::error::AppResult;
use crate::models::{AssetIndexFile, ProgressPayload, VersionMetadata};
use crate::utils::{ensure_dir_async, get_launcher_dir};
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;

pub(crate) async fn load_asset_index(
    app: &AppHandle,
    index_path: &Path,
    url: &str,
    expected_size: u64,
    expected_sha1: &str,
) -> AppResult<String> {
    if index_path.exists()
        && is_valid_file(index_path, Some(expected_size), Some(expected_sha1), true).await?
    {
        return tokio_fs::read_to_string(index_path)
            .await
            .map_err(|e| crate::error::AppError::Message(e.to_string()));
    }

    let text = fetch_text_with_cache(app, url, Some(index_path.to_path_buf()), false).await?;
    if is_valid_file(index_path, Some(expected_size), Some(expected_sha1), true).await? {
        return Ok(text);
    }

    let _ = tokio_fs::remove_file(index_path).await;
    let text = fetch_text_with_cache(app, url, Some(index_path.to_path_buf()), true).await?;
    if !is_valid_file(index_path, Some(expected_size), Some(expected_sha1), true).await? {
        return Err("Asset index invalido despues de reintento".to_string().into());
    }
    Ok(text)
}

pub async fn download_game_files_impl(
    app: &AppHandle,
    version_id: String,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> AppResult<String> {
    let (libraries, asset_index_info) = {
        let cache = metadata_cache.lock().map_err(|_| "Error lock".to_string())?;
        if let Some(meta) = &*cache {
            if meta.id != version_id {
                return Err("Metadata incorrecta".to_string().into());
            }
            (meta.libraries.clone(), meta.asset_index.clone())
        } else {
            return Err("No hay metadata".to_string().into());
        }
    };

    let base_dir = get_launcher_dir(app);
    let lib_dir = base_dir.join("libraries");
    let indexes_dir = base_dir.join("assets").join("indexes");
    let objects_dir = base_dir.join("assets").join("objects");

    // 1. Librerias (concurrente + verificacion)
    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Librerias 0/0".to_string(), percent: 0.0 },
    );
    let lib_specs = build_library_specs(&libraries, &lib_dir).await?;
    super::download_specs_concurrent(
        Some(app),
        lib_specs,
        super::LIB_CONCURRENCY,
        "Librerias",
        0.0,
        40.0,
        5,
    )
    .await?;

    // 2. Assets (index con cache + objetos concurrentes)
    ensure_dir_async(&indexes_dir).await?;
    ensure_dir_async(&objects_dir).await?;

    let index_path = indexes_dir.join(format!("{}.json", asset_index_info.id));
    let index_json_str = load_asset_index(
        app,
        &index_path,
        &asset_index_info.url,
        asset_index_info.size,
        &asset_index_info.sha1,
    )
    .await?;

    let index_data: AssetIndexFile = serde_json::from_str(&index_json_str)
        .map_err(|e| crate::error::AppError::Message(format!("Error Asset Index: {}", e)))?;

    let mut asset_specs = Vec::new();
    for (_name, object) in index_data.objects.iter() {
        let hash_prefix = &object.hash[0..2];
        let object_path = objects_dir.join(hash_prefix).join(&object.hash);
        if object_path.exists() {
            if let Ok(meta) = tokio_fs::metadata(&object_path).await {
                if meta.len() == object.size {
                    continue;
                }
            }
            let _ = tokio_fs::remove_file(&object_path).await;
        }
        let object_url =
            format!("https://resources.download.minecraft.net/{}/{}", hash_prefix, object.hash);
        asset_specs.push(DownloadSpec {
            url: object_url,
            path: object_path,
            sha1: Some(object.hash.clone()),
            size: Some(object.size),
        });
    }

    let download_total = asset_specs.len();
    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: format!("Assets 0/{}", download_total), percent: 40.0 },
    );
    super::download_specs_concurrent(
        Some(app),
        asset_specs,
        super::ASSET_CONCURRENCY,
        "Assets",
        40.0,
        60.0,
        50,
    )
    .await?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Archivos listos".to_string(), percent: 100.0 },
    );
    Ok("Archivos completados".to_string())
}

use crate::error::AppResult;
use crate::utils::create_client;
use crate::utils::get_launcher_dir;
use reqwest::header::{ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tokio::fs as tokio_fs;

#[derive(Serialize, Deserialize, Default)]
struct HttpCacheIndex {
    entries: HashMap<String, HttpCacheEntry>,
}

#[derive(Serialize, Deserialize, Default, Clone)]
struct HttpCacheEntry {
    etag: Option<String>,
    last_modified: Option<String>,
}

fn cache_dir(app: &AppHandle) -> PathBuf {
    get_launcher_dir(app).join("cache")
}

fn http_cache_index_path(app: &AppHandle) -> PathBuf {
    cache_dir(app).join("http_index.json")
}

fn hash_url(url: &str) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    url.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

fn http_cache_body_path(app: &AppHandle, url: &str) -> PathBuf {
    cache_dir(app).join(format!("{}.json", hash_url(url)))
}

async fn load_http_cache_index(path: &Path) -> HttpCacheIndex {
    if let Ok(text) = tokio_fs::read_to_string(path).await {
        serde_json::from_str(&text).unwrap_or_default()
    } else {
        HttpCacheIndex::default()
    }
}

async fn save_http_cache_index(path: &Path, index: &HttpCacheIndex) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        tokio_fs::create_dir_all(parent)
            .await
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    }
    let json = serde_json::to_string_pretty(index)
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    tokio_fs::write(path, json)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    Ok(())
}

pub async fn fetch_text_with_cache(
    app: &AppHandle,
    url: &str,
    dest_path: Option<PathBuf>,
    force_refresh: bool,
) -> AppResult<String> {
    let body_path = dest_path.unwrap_or_else(|| http_cache_body_path(app, url));
    if let Some(parent) = body_path.parent() {
        tokio_fs::create_dir_all(parent)
            .await
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    }

    let index_path = http_cache_index_path(app);
    let mut index = load_http_cache_index(&index_path).await;
    let client = create_client();
    let mut force = force_refresh;
    let mut tried_refresh = false;

    loop {
        let entry = index.entries.get(url).cloned().unwrap_or_default();
        let mut req = client.get(url);
        if !force {
            if let Some(etag) = &entry.etag {
                req = req.header(IF_NONE_MATCH, etag);
            }
            if let Some(last) = &entry.last_modified {
                req = req.header(IF_MODIFIED_SINCE, last);
            }
        }

        let resp = req.send().await;
        match resp {
            Ok(resp) => {
                if resp.status() == reqwest::StatusCode::NOT_MODIFIED && !force {
                    if let Ok(text) = tokio_fs::read_to_string(&body_path).await {
                        return Ok(text);
                    }
                    if tried_refresh {
                        break;
                    }
                    force = true;
                    tried_refresh = true;
                    continue;
                }

                if !resp.status().is_success() {
                    if let Ok(text) = tokio_fs::read_to_string(&body_path).await {
                        return Ok(text);
                    }
                    return Err(format!("HTTP {} al descargar {}", resp.status(), url).into());
                }

                let headers = resp.headers().clone();
                let text = resp
                    .text()
                    .await
                    .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
                tokio_fs::write(&body_path, text.as_bytes())
                    .await
                    .map_err(|e| crate::error::AppError::Message(e.to_string()))?;

                let etag = headers.get(ETAG).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
                let last =
                    headers.get(LAST_MODIFIED).and_then(|v| v.to_str().ok()).map(|s| s.to_string());
                index.entries.insert(url.to_string(), HttpCacheEntry { etag, last_modified: last });
                save_http_cache_index(&index_path, &index).await?;
                return Ok(text);
            }
            Err(e) => {
                if let Ok(text) = tokio_fs::read_to_string(&body_path).await {
                    return Ok(text);
                }
                return Err(e.to_string().into());
            }
        }
    }

    Err("Cache invalido y no se pudo refrescar".to_string().into())
}

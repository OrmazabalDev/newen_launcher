use crate::models::{
    AssetIndexFile, Library, ProgressPayload, VersionJson, VersionManifest, VersionMetadata,
};
use crate::utils::{
    create_client, detect_os_adoptium, get_launcher_dir, library_artifact_url,
    map_component_to_java_version, maven_artifact_path, should_download_lib,
};
use futures_util::stream;
use futures_util::StreamExt;
use reqwest::header::{ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const LIB_CONCURRENCY: usize = 12;
const ASSET_CONCURRENCY: usize = 12;
const DOWNLOAD_RETRIES: usize = 2;

#[derive(Clone)]
pub struct DownloadSpec {
    pub url: String,
    pub path: PathBuf,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

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

async fn save_http_cache_index(path: &Path, index: &HttpCacheIndex) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        tokio_fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(index).map_err(|e| e.to_string())?;
    tokio_fs::write(path, json)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn fetch_text_with_cache(
    app: &AppHandle,
    url: &str,
    dest_path: Option<PathBuf>,
    force_refresh: bool,
) -> Result<String, String> {
    let body_path = dest_path.unwrap_or_else(|| http_cache_body_path(app, url));
    if let Some(parent) = body_path.parent() {
        tokio_fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
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
                    return Err(format!("HTTP {} al descargar {}", resp.status(), url));
                }

                let headers = resp.headers().clone();
                let text = resp.text().await.map_err(|e| e.to_string())?;
                tokio_fs::write(&body_path, text.as_bytes())
                    .await
                    .map_err(|e| e.to_string())?;

                let etag = headers
                    .get(ETAG)
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());
                let last = headers
                    .get(LAST_MODIFIED)
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());
                index.entries.insert(
                    url.to_string(),
                    HttpCacheEntry {
                        etag,
                        last_modified: last,
                    },
                );
                save_http_cache_index(&index_path, &index).await?;
                return Ok(text);
            }
            Err(e) => {
                if let Ok(text) = tokio_fs::read_to_string(&body_path).await {
                    return Ok(text);
                }
                return Err(e.to_string());
            }
        }
    }

    Err("Cache invalido y no se pudo refrescar".to_string())
}

async fn sha1_file(path: &PathBuf) -> Result<String, String> {
    let mut file = tokio_fs::File::open(path)
        .await
        .map_err(|e| e.to_string())?;
    let mut hasher = Sha1::new();
    let mut buf = vec![0u8; 8192];
    loop {
        let n = file.read(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

async fn is_valid_file(
    path: &PathBuf,
    expected_size: Option<u64>,
    expected_sha1: Option<&str>,
    verify_sha1: bool,
) -> Result<bool, String> {
    if let Some(size) = expected_size {
        if let Ok(meta) = tokio_fs::metadata(path).await {
            if meta.len() != size {
                return Ok(false);
            }
        } else {
            return Ok(false);
        }
    }
    if verify_sha1 {
        if let Some(sha1) = expected_sha1 {
            let actual = sha1_file(path).await?;
            if actual != sha1 {
                return Ok(false);
            }
        }
    }
    Ok(true)
}

async fn should_download_file(
    path: &PathBuf,
    expected_size: Option<u64>,
    expected_sha1: Option<&str>,
    verify_sha1_existing: bool,
) -> Result<bool, String> {
    if path.exists() {
        let ok = is_valid_file(path, expected_size, expected_sha1, verify_sha1_existing).await?;
        if ok {
            return Ok(false);
        }
        let _ = tokio_fs::remove_file(path).await;
    }
    Ok(true)
}

fn set_last_err(slot: &mut Option<String>, msg: String) {
    if slot.is_none() {
        *slot = Some(msg);
    }
}

async fn download_url_to_path(url: &str, dest: &PathBuf) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        tokio_fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    let tmp_path = dest.with_extension("tmp");
    let client = create_client();
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;
    let mut file = tokio_fs::File::create(&tmp_path)
        .await
        .map_err(|e| e.to_string())?;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }
    let _ = file.flush().await;
    let _ = tokio_fs::remove_file(dest).await;
    tokio_fs::rename(&tmp_path, dest)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn download_with_retry(
    client: Arc<reqwest::Client>,
    spec: DownloadSpec,
    retries: usize,
) -> Result<(), String> {
    let mut last_err: Option<String> = None;
    for _ in 0..=retries {
        if let Some(parent) = spec.path.parent() {
            tokio_fs::create_dir_all(parent)
                .await
                .map_err(|e| e.to_string())?;
        }
        let tmp_path = spec.path.with_extension("tmp");
        let resp = client.get(&spec.url).send().await;
        let resp = match resp {
            Ok(r) => match r.error_for_status() {
                Ok(ok) => ok,
                Err(e) => {
                    set_last_err(&mut last_err, e.to_string());
                    continue;
                }
            },
            Err(e) => {
                set_last_err(&mut last_err, e.to_string());
                continue;
            }
        };

        let mut file = match tokio_fs::File::create(&tmp_path).await {
            Ok(f) => f,
            Err(e) => {
                set_last_err(&mut last_err, e.to_string());
                continue;
            }
        };

        let mut stream = resp.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    set_last_err(&mut last_err, e.to_string());
                    break;
                }
            };
            if let Err(e) = file.write_all(&chunk).await {
                set_last_err(&mut last_err, e.to_string());
                break;
            }
        }
        let _ = file.flush().await;

        if let Err(e) = is_valid_file(
            &tmp_path,
            spec.size,
            spec.sha1.as_deref(),
            spec.sha1.is_some(),
        )
        .await
        {
            set_last_err(&mut last_err, e);
            let _ = tokio_fs::remove_file(&tmp_path).await;
            continue;
        }

        let _ = tokio_fs::remove_file(&spec.path).await;
        if let Err(e) = tokio_fs::rename(&tmp_path, &spec.path).await {
            set_last_err(&mut last_err, e.to_string());
            let _ = tokio_fs::remove_file(&tmp_path).await;
            continue;
        }

        return Ok(());
    }

    Err(last_err.unwrap_or_else(|| "Descarga fallida".to_string()))
}

pub async fn download_file_checked(
    url: &str,
    dest: &Path,
    expected_size: u64,
    expected_sha1: Option<&str>,
) -> Result<(), String> {
    let path = dest.to_path_buf();
    if !should_download_file(&path, Some(expected_size), expected_sha1, true).await? {
        return Ok(());
    }
    let spec = DownloadSpec {
        url: url.to_string(),
        path,
        sha1: expected_sha1.map(|s| s.to_string()),
        size: Some(expected_size),
    };
    download_with_retry(Arc::new(create_client()), spec, DOWNLOAD_RETRIES).await
}

async fn download_specs_concurrent(
    app: Option<&AppHandle>,
    specs: Vec<DownloadSpec>,
    limit: usize,
    label: &str,
    base: f64,
    span: f64,
    step: usize,
) -> Result<(), String> {
    if specs.is_empty() {
        if let Some(app) = app {
            let _ = app.emit(
                "download-progress",
                ProgressPayload {
                    task: format!("{} 0/0", label),
                    percent: base + span,
                },
            );
        }
        return Ok(());
    }

    let client = Arc::new(create_client());
    let total = specs.len();
    let mut stream = stream::iter(specs.into_iter().map(|spec| {
        let client = client.clone();
        async move { download_with_retry(client, spec, DOWNLOAD_RETRIES).await }
    }))
    .buffer_unordered(limit);

    let mut done = 0usize;
    while let Some(res) = stream.next().await {
        match res {
            Ok(()) => {}
            Err(e) => return Err(e),
        }

        done += 1;
        if let Some(app) = app {
            if done == total || done % step == 0 {
                let percent = base + (done as f64 / total as f64) * span;
                let _ = app.emit(
                    "download-progress",
                    ProgressPayload {
                        task: format!("{} {}/{}", label, done, total),
                        percent,
                    },
                );
            }
        }
    }

    Ok(())
}

async fn build_library_specs(
    libraries: &[Library],
    lib_dir: &PathBuf,
) -> Result<Vec<DownloadSpec>, String> {
    let os_key = match std::env::consts::OS {
        "windows" => "windows",
        "linux" => "linux",
        "macos" => "osx",
        _ => "err",
    };
    let mut specs = Vec::new();

    for lib in libraries {
        if !should_download_lib(lib) {
            continue;
        }
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                if !artifact.url.is_empty() {
                    let path = lib_dir.join(&artifact.path);
                    if should_download_file(&path, Some(artifact.size), Some(&artifact.sha1), true)
                        .await?
                    {
                        specs.push(DownloadSpec {
                            url: artifact.url.clone(),
                            path,
                            sha1: Some(artifact.sha1.clone()),
                            size: Some(artifact.size),
                        });
                    }
                }
            }
            if let Some(classifiers) = &downloads.classifiers {
                for (key, artifact) in classifiers {
                    if !key.contains(os_key) || artifact.url.is_empty() {
                        continue;
                    }
                    let path = lib_dir.join(&artifact.path);
                    if should_download_file(&path, Some(artifact.size), Some(&artifact.sha1), true)
                        .await?
                    {
                        specs.push(DownloadSpec {
                            url: artifact.url.clone(),
                            path,
                            sha1: Some(artifact.sha1.clone()),
                            size: Some(artifact.size),
                        });
                    }
                }
            }
        }
        if lib.downloads.is_none() {
            if let Some(path) = maven_artifact_path(&lib.name) {
                if let Some(url) = library_artifact_url(lib) {
                    let path = lib_dir.join(&path);
                    let sha1 = lib.sha1.clone();
                    let size = lib.size;
                    if should_download_file(&path, size, sha1.as_deref(), true).await? {
                        specs.push(DownloadSpec {
                            url,
                            path,
                            sha1,
                            size,
                        });
                    }
                }
            }
        }
    }

    Ok(specs)
}

pub async fn download_libraries_concurrent(
    libraries: &[Library],
    lib_dir: &PathBuf,
) -> Result<(), String> {
    let specs = build_library_specs(libraries, lib_dir).await?;
    download_specs_concurrent(None, specs, LIB_CONCURRENCY, "Librerias", 0.0, 100.0, 10).await
}

pub async fn get_versions_impl(
    app: &AppHandle,
    manifest_cache: &Mutex<Option<VersionManifest>>,
) -> Result<Vec<String>, String> {
    println!("Descargando manifiesto de versiones...");
    let url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
    let text = fetch_text_with_cache(app, url, None, false).await?;
    let manifest: VersionManifest = serde_json::from_str(&text).map_err(|e| e.to_string())?;

    {
        let mut cache = manifest_cache
            .lock()
            .map_err(|_| "Error lock".to_string())?;
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
) -> Result<String, String> {
    {
        let cache = metadata_cache
            .lock()
            .map_err(|_| "Error lock".to_string())?;
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
                let mut cache = metadata_cache
                    .lock()
                    .map_err(|_| "Error lock".to_string())?;
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

    if manifest_cache
        .lock()
        .map_err(|_| "Error lock".to_string())?
        .is_none()
    {
        let _ = get_versions_impl(app, manifest_cache).await?;
    }

    let target_url = {
        let cache = manifest_cache
            .lock()
            .map_err(|_| "Error lock".to_string())?;
        if let Some(manifest) = &*cache {
            manifest
                .versions
                .iter()
                .find(|v| v.id == version_id)
                .map(|v| v.url.clone())
        } else {
            None
        }
    };
    let url = target_url.ok_or("Version no encontrada")?;

    let text = fetch_text_with_cache(app, &url, None, false).await?;
    let metadata: VersionMetadata = serde_json::from_str(&text).map_err(|e| e.to_string())?;

    if let Some(parent) = local_json.parent() {
        let _ = tokio_fs::create_dir_all(parent).await;
    }
    let _ = tokio_fs::write(&local_json, text.as_bytes()).await;

    {
        let mut cache = metadata_cache
            .lock()
            .map_err(|_| "Error lock".to_string())?;
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
) -> Result<String, String> {
    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Verificando cliente...".to_string(),
            percent: 0.0,
        },
    );

    let (url, size, sha1, metadata) = {
        let cache = metadata_cache
            .lock()
            .map_err(|_| "Error lock".to_string())?;
        if let Some(meta) = &*cache {
            if meta.id != version_id {
                return Err("Metadata incorrecta".to_string());
            }
            if let Some(dl) = &meta.downloads {
                (
                    dl.client.url.clone(),
                    dl.client.size,
                    dl.client.sha1.clone(),
                    meta.clone(),
                )
            } else {
                return Err("No hay descarga de cliente".to_string());
            }
        } else {
            return Err("No hay metadata".to_string());
        }
    };

    let path = get_launcher_dir(app)
        .join("versions")
        .join(&version_id)
        .join(format!("{}.jar", version_id));
    if let Some(p) = path.parent() {
        tokio_fs::create_dir_all(p)
            .await
            .map_err(|e| e.to_string())?;
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
            ProgressPayload {
                task: "Cliente verificado".to_string(),
                percent: 100.0,
            },
        );
        return Ok("OK".to_string());
    }

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Descargando jar del juego...".to_string(),
            percent: 50.0,
        },
    );

    let spec = DownloadSpec {
        url,
        path,
        sha1: Some(sha1),
        size: Some(size),
    };
    download_with_retry(Arc::new(create_client()), spec, DOWNLOAD_RETRIES).await?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Cliente completado".to_string(),
            percent: 100.0,
        },
    );
    Ok("OK".to_string())
}

async fn load_asset_index(
    app: &AppHandle,
    index_path: &PathBuf,
    url: &str,
    expected_size: u64,
    expected_sha1: &str,
) -> Result<String, String> {
    if index_path.exists()
        && is_valid_file(index_path, Some(expected_size), Some(expected_sha1), true).await?
    {
        return tokio_fs::read_to_string(index_path)
            .await
            .map_err(|e| e.to_string());
    }

    let text = fetch_text_with_cache(app, url, Some(index_path.clone()), false).await?;
    if is_valid_file(index_path, Some(expected_size), Some(expected_sha1), true).await? {
        return Ok(text);
    }

    let _ = tokio_fs::remove_file(index_path).await;
    let text = fetch_text_with_cache(app, url, Some(index_path.clone()), true).await?;
    if !is_valid_file(index_path, Some(expected_size), Some(expected_sha1), true).await? {
        return Err("Asset index invalido despues de reintento".to_string());
    }
    Ok(text)
}

pub async fn download_game_files_impl(
    app: &AppHandle,
    version_id: String,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> Result<String, String> {
    let (libraries, asset_index_info) = {
        let cache = metadata_cache
            .lock()
            .map_err(|_| "Error lock".to_string())?;
        if let Some(meta) = &*cache {
            if meta.id != version_id {
                return Err("Metadata incorrecta".to_string());
            }
            (meta.libraries.clone(), meta.asset_index.clone())
        } else {
            return Err("No hay metadata".to_string());
        }
    };

    let base_dir = get_launcher_dir(app);
    let lib_dir = base_dir.join("libraries");
    let indexes_dir = base_dir.join("assets").join("indexes");
    let objects_dir = base_dir.join("assets").join("objects");

    // 1. Librerias (concurrente + verificacion)
    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Librerias 0/0".to_string(),
            percent: 0.0,
        },
    );
    let lib_specs = build_library_specs(&libraries, &lib_dir).await?;
    download_specs_concurrent(
        Some(app),
        lib_specs,
        LIB_CONCURRENCY,
        "Librerias",
        0.0,
        40.0,
        5,
    )
    .await?;

    // 2. Assets (index con cache + objetos concurrentes)
    tokio_fs::create_dir_all(&indexes_dir)
        .await
        .map_err(|e| e.to_string())?;
    tokio_fs::create_dir_all(&objects_dir)
        .await
        .map_err(|e| e.to_string())?;

    let index_path = indexes_dir.join(format!("{}.json", asset_index_info.id));
    let index_json_str = load_asset_index(
        app,
        &index_path,
        &asset_index_info.url,
        asset_index_info.size,
        &asset_index_info.sha1,
    )
    .await?;

    let index_data: AssetIndexFile =
        serde_json::from_str(&index_json_str).map_err(|e| format!("Error Asset Index: {}", e))?;

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
        let object_url = format!(
            "https://resources.download.minecraft.net/{}/{}",
            hash_prefix, object.hash
        );
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
        ProgressPayload {
            task: format!("Assets 0/{}", download_total),
            percent: 40.0,
        },
    );
    download_specs_concurrent(
        Some(app),
        asset_specs,
        ASSET_CONCURRENCY,
        "Assets",
        40.0,
        60.0,
        50,
    )
    .await?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Archivos listos".to_string(),
            percent: 100.0,
        },
    );
    Ok("Archivos completados".to_string())
}

async fn load_version_json_from_disk(
    app: &AppHandle,
    version_id: &str,
) -> Result<VersionJson, String> {
    let path = get_launcher_dir(app)
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));
    if !path.exists() {
        return Err(format!("No existe version json para {}", version_id));
    }
    let raw = tokio_fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())?;
    let trimmed = raw.trim_start_matches('\u{feff}').trim();
    if trimmed.is_empty() {
        return Err("Version json vacio".to_string());
    }
    serde_json::from_str(trimmed).map_err(|e| e.to_string())
}

async fn resolve_version_libraries(
    app: &AppHandle,
    version_id: &str,
    visited: &mut HashSet<String>,
) -> Result<Vec<Library>, String> {
    let mut libs: Vec<Library> = Vec::new();
    let mut stack: Vec<String> = vec![version_id.to_string()];

    while let Some(current) = stack.pop() {
        if !visited.insert(current.clone()) {
            return Err("Ciclo detectado en inheritsFrom".to_string());
        }
        let v = load_version_json_from_disk(app, &current).await?;
        if let Some(parent) = v.inherits_from.as_deref() {
            if !visited.contains(parent) {
                stack.push(parent.to_string());
            }
        }
        if let Some(child_libs) = v.libraries {
            libs.extend(child_libs);
        }
    }

    Ok(libs)
}

pub async fn download_libraries_for_version_impl(
    app: &AppHandle,
    version_id: String,
) -> Result<String, String> {
    let mut visited = HashSet::new();
    let libraries = resolve_version_libraries(app, &version_id, &mut visited).await?;
    let lib_dir = get_launcher_dir(app).join("libraries");
    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Verificando librerias...".to_string(),
            percent: 0.0,
        },
    );
    download_libraries_concurrent(&libraries, &lib_dir).await?;
    Ok("Librerias verificadas".to_string())
}

pub async fn download_java_impl(
    app: &AppHandle,
    version_id: Option<String>,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> Result<String, String> {
    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Iniciando descarga Java...".to_string(),
            percent: 0.0,
        },
    );

    if let Some(id) = version_id.clone() {
        let _ = get_version_metadata_impl(app, id, manifest_cache, metadata_cache).await?;
    }

    let component = {
        let cache = metadata_cache
            .lock()
            .map_err(|_| "Error cache".to_string())?;
        if let Some(meta) = &*cache {
            meta.java_version
                .as_ref()
                .map(|j| j.component.clone())
                .unwrap_or("java-runtime-alpha".to_string())
        } else {
            return Err("No hay metadata".to_string());
        }
    };

    let java_version = map_component_to_java_version(&component);
    let (os_api, arch_api) = detect_os_adoptium();
    let api_urls = [
        // Prefer Temurin JRE
        format!("https://api.adoptium.net/v3/assets/feature_releases/{}/ga?architecture={}&heap_size=normal&image_type=jre&jvm_impl=hotspot&os={}&vendor=eclipse-temurin", java_version, arch_api, os_api),
        // Fallback vendor / no vendor
        format!("https://api.adoptium.net/v3/assets/feature_releases/{}/ga?architecture={}&heap_size=normal&image_type=jre&jvm_impl=hotspot&os={}&vendor=eclipse", java_version, arch_api, os_api),
        format!("https://api.adoptium.net/v3/assets/feature_releases/{}/ga?architecture={}&heap_size=normal&image_type=jre&jvm_impl=hotspot&os={}", java_version, arch_api, os_api),
        // If JRE not available, try JDK
        format!("https://api.adoptium.net/v3/assets/feature_releases/{}/ga?architecture={}&heap_size=normal&image_type=jdk&jvm_impl=hotspot&os={}&vendor=eclipse-temurin", java_version, arch_api, os_api),
        format!("https://api.adoptium.net/v3/assets/feature_releases/{}/ga?architecture={}&heap_size=normal&image_type=jdk&jvm_impl=hotspot&os={}", java_version, arch_api, os_api),
        // Latest endpoint fallback
        format!("https://api.adoptium.net/v3/assets/latest/{}/hotspot?architecture={}&image_type=jre&os={}", java_version, arch_api, os_api),
        format!("https://api.adoptium.net/v3/assets/latest/{}/hotspot?architecture={}&image_type=jdk&os={}", java_version, arch_api, os_api),
    ];

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Buscando en Adoptium...".to_string(),
            percent: 10.0,
        },
    );
    let client = create_client();
    let mut last_err: Option<String> = None;
    let mut releases: Vec<serde_json::Value> = Vec::new();
    for api_url in api_urls.iter() {
        for _ in 0..=1 {
            let resp = match client.get(api_url).send().await {
                Ok(r) => r,
                Err(e) => {
                    last_err = Some(e.to_string());
                    continue;
                }
            };
            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                last_err = Some(format!(
                    "HTTP {} en Adoptium ({}) : {}",
                    status, api_url, body
                ));
                continue;
            }
            let body = resp.text().await.map_err(|e| e.to_string())?;
            if body.trim().is_empty() {
                last_err = Some("Respuesta vacia de Adoptium".to_string());
                continue;
            }
            match serde_json::from_str::<Vec<serde_json::Value>>(&body) {
                Ok(parsed) => {
                    releases = parsed;
                    break;
                }
                Err(e) => {
                    let preview: String = body.chars().take(120).collect();
                    last_err = Some(format!("JSON invalido en Adoptium: {} ({})", e, preview));
                    continue;
                }
            }
        }
        if !releases.is_empty() {
            break;
        }
    }
    if releases.is_empty() {
        return Err(format!(
            "Adoptium no respondio correctamente. {}",
            last_err.unwrap_or_else(|| "Sin detalles".to_string())
        ));
    }
    let download_url = releases
        .first()
        .and_then(|r| r.get("binaries"))
        .and_then(|b| b.get(0))
        .and_then(|b| b.get("package"))
        .and_then(|p| p.get("link"))
        .and_then(|l| l.as_str())
        .ok_or("No se encontro link de descarga en Adoptium")?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Descargando ZIP...".to_string(),
            percent: 30.0,
        },
    );
    let cache_dir = get_launcher_dir(app).join("cache").join("java");
    tokio_fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let archive_path = cache_dir.join(format!(
        "adoptium-{}-{}-{}.zip",
        component, os_api, arch_api
    ));
    download_url_to_path(download_url, &archive_path).await?;

    let base_dir = get_launcher_dir(app)
        .join("runtime")
        .join(&component)
        .join(format!("{}-{}", os_api, arch_api));

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Descomprimiendo...".to_string(),
            percent: 70.0,
        },
    );
    let base_dir_clone = base_dir.clone();
    let archive_clone = archive_path.clone();
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        if base_dir_clone.exists() {
            std::fs::remove_dir_all(&base_dir_clone).ok();
        }
        std::fs::create_dir_all(&base_dir_clone).map_err(|e| e.to_string())?;
        let file = std::fs::File::open(&archive_clone).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).map_err(|e| e.to_string())?;
            let out = base_dir_clone.join(f.mangled_name());
            if f.name().ends_with('/') {
                std::fs::create_dir_all(&out).ok();
            } else {
                if let Some(p) = out.parent() {
                    std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
                let mut out_file = std::fs::File::create(&out).map_err(|e| e.to_string())?;
                std::io::copy(&mut f, &mut out_file).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())??;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Java OK".to_string(),
            percent: 100.0,
        },
    );
    Ok("Java Instalado".to_string())
}

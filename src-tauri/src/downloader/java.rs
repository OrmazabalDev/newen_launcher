use crate::models::{ProgressPayload, VersionManifest, VersionMetadata};
use crate::utils::{create_client, detect_os_adoptium, get_launcher_dir, map_component_to_java_version};
use super::download::download_url_to_path;
use super::versions::get_version_metadata_impl;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;

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

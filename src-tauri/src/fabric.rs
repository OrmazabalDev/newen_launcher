use crate::downloader::{
    download_client_impl, download_game_files_impl, get_version_metadata_impl, get_versions_impl,
};
use crate::models::{ProgressPayload, VersionManifest, VersionMetadata};
use crate::utils::{create_client, get_launcher_dir};
use reqwest::Url;
use serde::Deserialize;
use std::fs;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

use crate::error::AppResult;
#[derive(Deserialize)]
struct FabricMetaVersion {
    version: String,
    stable: bool,
}

#[derive(Deserialize)]
struct FabricLoaderEntry {
    loader: FabricMetaVersion,
}

fn normalize_version_hint(raw: &str) -> String {
    let token = raw.split([' ', ',', ';']).next().unwrap_or("").trim();
    token.trim_start_matches(|c: char| !c.is_ascii_digit()).to_string()
}

fn matches_loader_hint(candidate: &str, hint: &str) -> bool {
    if hint.is_empty() {
        return false;
    }
    let base = candidate.split('+').next().unwrap_or(candidate);
    base == hint
}

fn pick_latest_loader(entries: &[FabricLoaderEntry]) -> Option<String> {
    entries
        .iter()
        .find(|e| e.loader.stable)
        .map(|e| e.loader.version.clone())
        .or_else(|| entries.first().map(|e| e.loader.version.clone()))
}

fn build_fabric_url(base: &str, segments: &[&str]) -> AppResult<Url> {
    let mut url = Url::parse(base).map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    {
        let mut segs = url.path_segments_mut().map_err(|_| "URL base invalida".to_string())?;
        for s in segments {
            segs.push(s);
        }
    }
    Ok(url)
}

async fn fetch_text_checked(client: &reqwest::Client, url: &str) -> AppResult<String> {
    let resp =
        client.get(url).send().await.map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    if !status.is_success() {
        let preview: String = text.chars().take(200).collect();
        return Err(format!("Respuesta HTTP {}: {}", status, preview).into());
    }
    Ok(text)
}

pub async fn install_fabric_impl(
    app: &AppHandle,
    mc_version: String,
    loader_override: Option<String>,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> AppResult<String> {
    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Preparando Fabric...".to_string(), percent: 0.0 },
    );

    let mc_version_hint = normalize_version_hint(&mc_version);
    let mc_version = if !mc_version_hint.is_empty() { mc_version_hint } else { mc_version };

    if manifest_cache.lock().map_err(|_| "Error lock".to_string())?.is_none() {
        let _ = get_versions_impl(app, manifest_cache).await?;
    }
    get_version_metadata_impl(app, mc_version.clone(), manifest_cache, metadata_cache).await?;
    download_client_impl(app, mc_version.clone(), metadata_cache).await?;
    download_game_files_impl(app, mc_version.clone(), metadata_cache).await?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Resolviendo loader Fabric...".to_string(), percent: 10.0 },
    );

    let client = create_client();
    let loader_url =
        build_fabric_url("https://meta.fabricmc.net/v2/versions/loader/", &[&mc_version])?;
    let loader_resp = client
        .get(loader_url)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let status = loader_resp.status();
    let loader_text =
        loader_resp.text().await.map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    if status == reqwest::StatusCode::NOT_FOUND {
        return Err(format!("No hay loader Fabric para Minecraft {}", mc_version).into());
    }
    if !status.is_success() {
        let preview: String = loader_text.chars().take(200).collect();
        return Err(format!("Respuesta HTTP {}: {}", status, preview).into());
    }
    let loader_entries: Vec<FabricLoaderEntry> =
        serde_json::from_str(&loader_text).map_err(|e| {
            let preview: String = loader_text.chars().take(200).collect();
            format!("JSON invalido: {} ({})", e, preview)
        })?;

    let loader_version = if let Some(requested) = loader_override {
        let hint = normalize_version_hint(&requested);
        if !hint.is_empty() {
            if let Some(found) =
                loader_entries.iter().find(|e| matches_loader_hint(&e.loader.version, &hint))
            {
                found.loader.version.clone()
            } else {
                pick_latest_loader(&loader_entries).ok_or_else(|| {
                    crate::error::AppError::Message("No hay loader Fabric disponible".to_string())
                })?
            }
        } else {
            pick_latest_loader(&loader_entries).ok_or_else(|| {
                crate::error::AppError::Message("No hay loader Fabric disponible".to_string())
            })?
        }
    } else {
        pick_latest_loader(&loader_entries).ok_or_else(|| {
            crate::error::AppError::Message("No hay loader Fabric disponible".to_string())
        })?
    };

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Descargando perfil Fabric...".to_string(), percent: 40.0 },
    );

    let profile_url = build_fabric_url(
        "https://meta.fabricmc.net/v2/versions/loader/",
        &[&mc_version, &loader_version, "profile", "json"],
    )?;
    let profile_text = fetch_text_checked(&client, profile_url.as_str()).await?;

    let profile_json: serde_json::Value = serde_json::from_str(&profile_text).map_err(|e| {
        let preview: String = profile_text.chars().take(200).collect();
        format!("JSON invalido: {} ({})", e, preview)
    })?;
    let version_id = profile_json
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            crate::error::AppError::Message("Perfil Fabric invalido: falta id".to_string())
        })?
        .to_string();

    let versions_dir = get_launcher_dir(app).join("versions");
    let version_dir = versions_dir.join(&version_id);
    fs::create_dir_all(&version_dir).map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let json_path = version_dir.join(format!("{}.json", version_id));
    fs::write(&json_path, profile_text.as_bytes())
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Fabric instalado".to_string(), percent: 100.0 },
    );

    Ok(version_id)
}

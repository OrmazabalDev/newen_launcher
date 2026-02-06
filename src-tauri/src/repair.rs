use crate::downloader::{
    download_client_impl, download_game_files_impl, download_libraries_for_version_impl,
    get_version_metadata_impl,
};
use crate::instances::get_instance_impl;
use crate::models::{VersionManifest, VersionMetadata};
use crate::utils::get_launcher_dir;
use std::sync::Mutex;
use tauri::AppHandle;

fn extract_base_version(version_id: &str) -> String {
    if let Some((base, _)) = version_id.split_once("-forge-") {
        return base.to_string();
    }
    if let Some((base, _)) = version_id.split_once("-neoforge-") {
        return base.to_string();
    }
    if let Some(raw) = version_id.strip_prefix("neoforge-") {
        let numeric = raw.split('-').next().unwrap_or(raw);
        let mut parts = numeric.split('.');
        let minor = parts
            .next()
            .and_then(|p| p.parse::<u32>().ok())
            .unwrap_or(0);
        let patch = parts
            .next()
            .and_then(|p| p.parse::<u32>().ok())
            .unwrap_or(0);
        if minor > 0 {
            if patch > 0 {
                return format!("1.{}.{}", minor, patch);
            }
            return format!("1.{}", minor);
        }
    }
    if version_id.starts_with("fabric-loader-") {
        let parts: Vec<&str> = version_id.split('-').collect();
        return parts.last().unwrap_or(&version_id).to_string();
    }
    version_id.to_string()
}

pub async fn repair_instance_impl(
    app: &AppHandle,
    instance_id: String,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> Result<String, String> {
    let inst = get_instance_impl(app, &instance_id).await?;
    let base_version = extract_base_version(&inst.version);
    let version_dir = get_launcher_dir(app).join("versions").join(&inst.version);
    if !version_dir.exists() {
        return Err("No se encontro la version instalada. Reinstala el loader.".to_string());
    }

    get_version_metadata_impl(app, base_version.clone(), manifest_cache, metadata_cache).await?;
    let _ = download_client_impl(app, base_version.clone(), metadata_cache).await?;
    let _ = download_game_files_impl(app, base_version.clone(), metadata_cache).await?;
    let _ = download_libraries_for_version_impl(app, inst.version.clone()).await?;

    Ok("Repair completado: assets, cliente y librerias verificados.".to_string())
}

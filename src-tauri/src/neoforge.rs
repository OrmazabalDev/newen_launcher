mod installer;
mod version;

use crate::downloader::{
    download_client_impl, download_game_files_impl, get_version_metadata_impl, get_versions_impl,
};
use crate::error::AppResult;
use crate::models::{ProgressPayload, VersionManifest, VersionMetadata};
use crate::utils::get_launcher_dir;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

use installer::{
    detect_installed_neoforge_id, download_neoforge_installer, ensure_default_neoforge_profile,
    list_version_dirs, run_neoforge_installer,
};
use version::resolve_neoforge_build;

pub async fn install_neoforge_impl(
    app: &AppHandle,
    mc_version: String,
    neoforge_build_override: Option<String>,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> AppResult<String> {
    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Preparando NeoForge...".to_string(), percent: 0.0 },
    );

    if manifest_cache.lock().map_err(|_| "Error lock".to_string())?.is_none() {
        let _ = get_versions_impl(app, manifest_cache).await?;
    }
    get_version_metadata_impl(app, mc_version.clone(), manifest_cache, metadata_cache).await?;
    download_client_impl(app, mc_version.clone(), metadata_cache).await?;
    download_game_files_impl(app, mc_version.clone(), metadata_cache).await?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Resolviendo build NeoForge...".to_string(), percent: 10.0 },
    );

    let neoforge_build = resolve_neoforge_build(&mc_version, neoforge_build_override).await?;
    let expected_id = format!("{}-neoforge-{}", mc_version, neoforge_build);
    let versions_dir = get_launcher_dir(app).join("versions");
    let existing = list_version_dirs(&versions_dir).await;
    if existing.contains(&expected_id) {
        ensure_default_neoforge_profile(app, &expected_id)?;
        return Ok(expected_id);
    }

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Descargando instalador NeoForge...".to_string(), percent: 20.0 },
    );
    let installer_path = download_neoforge_installer(app, &neoforge_build).await?;

    let before = list_version_dirs(&versions_dir).await;

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Ejecutando instalador NeoForge...".to_string(), percent: 50.0 },
    );
    run_neoforge_installer(app, &installer_path).await?;

    let after = list_version_dirs(&versions_dir).await;
    let installed_id = detect_installed_neoforge_id(&mc_version, &neoforge_build, &before, &after);
    let installed_path = versions_dir.join(&installed_id);
    if !installed_path.exists() {
        return Err(
            "No se encontro la carpeta de NeoForge instalada. Verifica Java o el instalador."
                .to_string()
                .into(),
        );
    }
    let installed_json = installed_path.join(format!("{}.json", installed_id));
    if !installed_json.exists() {
        return Err(
            "NeoForge no genero el archivo de version (.json). Revisa el log del instalador."
                .to_string()
                .into(),
        );
    }

    ensure_default_neoforge_profile(app, &installed_id)?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "NeoForge instalado".to_string(), percent: 100.0 },
    );
    Ok(installed_id)
}

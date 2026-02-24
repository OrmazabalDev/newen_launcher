use crate::downloader::{
    download_client_impl, download_game_files_impl, get_version_metadata_impl,
};
use crate::error::{AppError, AppResult};
use crate::fabric::install_fabric_impl;
use crate::forge::install_forge_impl;
use crate::instances::{create_instance_impl, refresh_instance_mods_cache};
use crate::models::{
    InstanceCreateRequest, InstanceSummary, ProgressPayload, VersionManifest, VersionMetadata,
};
use crate::neoforge::install_neoforge_impl;
use crate::repair::repair_instance_impl;
use crate::utils::{append_action_log, get_launcher_dir};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;

use super::client::modrinth_get_version;
use super::pack::{download_modpack_file, install_modpack_from_pack, zip_read_index};

pub async fn modrinth_install_modpack_impl(
    app: &AppHandle,
    version_id: String,
    name: String,
    thumbnail: Option<String>,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> AppResult<InstanceSummary> {
    let version = modrinth_get_version(app, &version_id)
        .await
        .map_err(|e| AppError::Message(format!("Version Modrinth: {}", e)))?;
    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Preparando modpack...".to_string(), percent: 0.0 },
    );
    let pack_path = download_modpack_file(app, &version)
        .await
        .map_err(|e| AppError::Message(format!("Descarga del modpack: {}", e)))?;
    let pack_path_clone = pack_path.clone();
    let index = tokio::task::spawn_blocking(move || zip_read_index(&pack_path_clone))
        .await
        .map_err(|e| AppError::Message(e.to_string()))?
        .map_err(|e| AppError::Message(format!("Lectura del modpack: {}", e)))?;

    let mc_version = index.dependencies.get("minecraft").cloned().ok_or_else(|| {
        AppError::Message("El modpack no indica version de Minecraft".to_string())
    })?;

    let forge_dep = index.dependencies.get("forge").cloned();
    let neoforge_dep = index.dependencies.get("neoforge").cloned();
    let fabric_dep = index
        .dependencies
        .get("fabric-loader")
        .cloned()
        .or_else(|| index.dependencies.get("quilt-loader").cloned());

    let loader = if neoforge_dep.is_some() {
        "neoforge"
    } else if forge_dep.is_some() {
        "forge"
    } else if fabric_dep.is_some() {
        "fabric"
    } else {
        "vanilla"
    };

    let resolved_version = if loader == "neoforge" {
        install_neoforge_impl(
            app,
            mc_version.clone(),
            neoforge_dep.clone(),
            manifest_cache,
            metadata_cache,
        )
        .await
        .map_err(|e| AppError::Message(format!("Instalar NeoForge: {}", e)))?
    } else if loader == "forge" {
        install_forge_impl(
            app,
            mc_version.clone(),
            forge_dep.clone(),
            manifest_cache,
            metadata_cache,
        )
        .await
        .map_err(|e| AppError::Message(format!("Instalar Forge: {}", e)))?
    } else if loader == "fabric" {
        install_fabric_impl(
            app,
            mc_version.clone(),
            fabric_dep.clone(),
            manifest_cache,
            metadata_cache,
        )
        .await
        .map_err(|e| AppError::Message(format!("Instalar Fabric: {}", e)))?
    } else {
        get_version_metadata_impl(app, mc_version.clone(), manifest_cache, metadata_cache)
            .await
            .map_err(|e| AppError::Message(format!("Metadata Minecraft: {}", e)))?;
        download_client_impl(app, mc_version.clone(), metadata_cache)
            .await
            .map_err(|e| AppError::Message(format!("Descargar cliente: {}", e)))?;
        download_game_files_impl(app, mc_version.clone(), metadata_cache)
            .await
            .map_err(|e| AppError::Message(format!("Descargar assets: {}", e)))?;
        mc_version.clone()
    };

    let instance_name = if name.trim().is_empty() {
        format!("Modpack {}", mc_version)
    } else {
        name.trim().to_string()
    };

    let req = InstanceCreateRequest {
        name: instance_name,
        version: resolved_version,
        loader: loader.to_string(),
        thumbnail,
        tags: Some(vec!["modpack".to_string()]),
    };

    let created = create_instance_impl(app, req)
        .await
        .map_err(|e| AppError::Message(format!("Crear instancia: {}", e)))?;
    let _ = append_action_log(
        app,
        &format!(
            "modpack_install_start instance={} version={} name={}",
            created.id, version_id, name
        ),
    )
    .await;
    if let Err(err) = install_modpack_from_pack(app, &created.id, &pack_path).await {
        let _ = append_action_log(
            app,
            &format!(
                "modpack_install_failed instance={} version={} error={}",
                created.id, version_id, err
            ),
        )
        .await;
        let repair_msg =
            match repair_instance_impl(app, created.id.clone(), manifest_cache, metadata_cache)
                .await
            {
                Ok(msg) => format!("Repair aplicado: {}", msg),
                Err(e) => format!("Repair fallo: {}", e),
            };
        return Err(format!("Instalar archivos del modpack: {}. {}", err, repair_msg).into());
    }
    let _ = append_action_log(
        app,
        &format!("modpack_install instance={} version={}", created.id, version_id),
    )
    .await;
    let _ = refresh_instance_mods_cache(app, &created.id).await;
    Ok(created)
}

pub async fn import_modpack_mrpack_impl(
    app: &AppHandle,
    name: Option<String>,
    file_name: String,
    data_base64: String,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> AppResult<InstanceSummary> {
    let original_name = file_name.clone();
    let bytes = BASE64_STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|e| AppError::Message(e.to_string()))?;
    if bytes.is_empty() {
        return Err("El archivo esta vacio".to_string().into());
    }
    let cache_dir = get_launcher_dir(app).join("cache").join("modpacks");
    tokio_fs::create_dir_all(&cache_dir).await.map_err(|e| AppError::Message(e.to_string()))?;
    let safe_name = if file_name.ends_with(".mrpack") {
        file_name.clone()
    } else {
        format!("{}.mrpack", file_name.trim_end_matches(".zip"))
    };
    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let pack_path = cache_dir.join(format!("import_{}_{}", ts, safe_name));
    tokio_fs::write(&pack_path, bytes).await.map_err(|e| AppError::Message(e.to_string()))?;

    let pack_path_clone = pack_path.clone();
    let index = tokio::task::spawn_blocking(move || zip_read_index(&pack_path_clone))
        .await
        .map_err(|e| AppError::Message(e.to_string()))??;

    let mc_version = index.dependencies.get("minecraft").cloned().ok_or_else(|| {
        AppError::Message("El modpack no indica version de Minecraft".to_string())
    })?;

    let forge_dep = index.dependencies.get("forge").cloned();
    let neoforge_dep = index.dependencies.get("neoforge").cloned();
    let fabric_dep = index
        .dependencies
        .get("fabric-loader")
        .cloned()
        .or_else(|| index.dependencies.get("quilt-loader").cloned());

    if index.dependencies.contains_key("quilt-loader") {
        return Err("Quilt no esta soportado aun".to_string().into());
    }

    let loader = if neoforge_dep.is_some() {
        "neoforge"
    } else if forge_dep.is_some() {
        "forge"
    } else if fabric_dep.is_some() {
        "fabric"
    } else {
        "vanilla"
    };

    let resolved_version = if loader == "neoforge" {
        install_neoforge_impl(
            app,
            mc_version.clone(),
            neoforge_dep.clone(),
            manifest_cache,
            metadata_cache,
        )
        .await
        .map_err(|e| AppError::Message(format!("Instalar NeoForge: {}", e)))?
    } else if loader == "forge" {
        install_forge_impl(
            app,
            mc_version.clone(),
            forge_dep.clone(),
            manifest_cache,
            metadata_cache,
        )
        .await
        .map_err(|e| AppError::Message(format!("Instalar Forge: {}", e)))?
    } else if loader == "fabric" {
        install_fabric_impl(
            app,
            mc_version.clone(),
            fabric_dep.clone(),
            manifest_cache,
            metadata_cache,
        )
        .await
        .map_err(|e| AppError::Message(format!("Instalar Fabric: {}", e)))?
    } else {
        get_version_metadata_impl(app, mc_version.clone(), manifest_cache, metadata_cache)
            .await
            .map_err(|e| AppError::Message(format!("Metadata Minecraft: {}", e)))?;
        download_client_impl(app, mc_version.clone(), metadata_cache)
            .await
            .map_err(|e| AppError::Message(format!("Descargar cliente: {}", e)))?;
        download_game_files_impl(app, mc_version.clone(), metadata_cache)
            .await
            .map_err(|e| AppError::Message(format!("Descargar assets: {}", e)))?;
        mc_version.clone()
    };

    let instance_name =
        name.map(|n| n.trim().to_string()).filter(|n| !n.is_empty()).unwrap_or_else(|| {
            original_name.trim_end_matches(".mrpack").trim_end_matches(".zip").to_string()
        });

    let req = InstanceCreateRequest {
        name: instance_name,
        version: resolved_version,
        loader: loader.to_string(),
        thumbnail: None,
        tags: Some(vec!["modpack".to_string()]),
    };

    let created = create_instance_impl(app, req)
        .await
        .map_err(|e| AppError::Message(format!("Crear instancia: {}", e)))?;

    let _ = append_action_log(
        app,
        &format!("modpack_import_start instance={} file={}", created.id, safe_name),
    )
    .await;

    if let Err(err) = install_modpack_from_pack(app, &created.id, &pack_path).await {
        let _ = append_action_log(
            app,
            &format!(
                "modpack_import_failed instance={} file={} error={}",
                created.id, safe_name, err
            ),
        )
        .await;
        let repair_msg =
            match repair_instance_impl(app, created.id.clone(), manifest_cache, metadata_cache)
                .await
            {
                Ok(msg) => format!("Repair aplicado: {}", msg),
                Err(e) => format!("Repair fallo: {}", e),
            };
        return Err(format!("Instalar archivos del modpack: {}. {}", err, repair_msg).into());
    }

    let _ = refresh_instance_mods_cache(app, &created.id).await;
    let _ = append_action_log(
        app,
        &format!("modpack_import instance={} file={}", created.id, safe_name),
    )
    .await;
    Ok(created)
}

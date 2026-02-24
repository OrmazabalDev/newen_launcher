use crate::content::upsert_mod_metadata;
use crate::error::{AppError, AppResult};
use crate::models::{ModMetadataEntry, ModrinthVersion};
use crate::utils::append_action_log;
use std::collections::{HashMap, HashSet};
use tauri::AppHandle;
use tokio::fs as tokio_fs;

use super::client::{modrinth_get_version, modrinth_list_versions_impl};
use super::pack::install_modpack;
use super::shared::{
    instance_dir, instance_mods_dir, instance_resourcepacks_dir, instance_shaderpacks_dir,
    pick_primary_file,
};

async fn get_version_cached(
    app: &AppHandle,
    cache: &mut HashMap<String, ModrinthVersion>,
    version_id: &str,
) -> AppResult<ModrinthVersion> {
    if let Some(v) = cache.get(version_id) {
        return Ok(v.clone());
    }
    let v = modrinth_get_version(app, version_id).await?;
    cache.insert(version_id.to_string(), v.clone());
    Ok(v)
}

pub(super) async fn install_version_with_deps(
    app: &AppHandle,
    instance_id: &str,
    root_version_id: &str,
    loader: Option<&str>,
    game_version: Option<&str>,
) -> AppResult<usize> {
    let mut visited: HashSet<String> = HashSet::new();
    let mut cache: HashMap<String, ModrinthVersion> = HashMap::new();
    let mut stack: Vec<(String, bool)> = vec![(root_version_id.to_string(), false)];
    let mut installed = 0usize;

    while let Some((version_id, processed)) = stack.pop() {
        if processed {
            let version = get_version_cached(app, &mut cache, &version_id).await?;
            let mods_dir = instance_mods_dir(app, instance_id);
            tokio_fs::create_dir_all(&mods_dir)
                .await
                .map_err(|e| AppError::Message(e.to_string()))?;
            if let Some((url, filename, size, sha1)) = pick_primary_file(&version) {
                let dest = mods_dir.join(filename);
                crate::downloader::download_file_checked(url, &dest, size, sha1).await?;
                installed += 1;

                let dependencies: Vec<String> = version
                    .dependencies
                    .iter()
                    .filter(|d| d.dependency_type == "required")
                    .filter_map(|d| d.version_id.clone().or_else(|| d.project_id.clone()))
                    .collect();
                let entry = ModMetadataEntry {
                    file_name: filename.to_string(),
                    version_id: Some(version.id.clone()),
                    project_id: version.project_id.clone(),
                    dependencies,
                    source: Some("modrinth".to_string()),
                    kind: Some("mods".to_string()),
                };
                let _ = upsert_mod_metadata(app, instance_id, entry).await;
            }
            continue;
        }

        if visited.contains(&version_id) {
            continue;
        }
        visited.insert(version_id.clone());

        let version = get_version_cached(app, &mut cache, &version_id).await?;
        stack.push((version_id.clone(), true));

        for dep in version.dependencies.clone() {
            if dep.dependency_type != "required" {
                continue;
            }
            if let Some(dep_version_id) = dep.version_id {
                if !visited.contains(&dep_version_id) {
                    stack.push((dep_version_id, false));
                }
                continue;
            }
            if let Some(project_id) = dep.project_id {
                let versions = modrinth_list_versions_impl(
                    app,
                    project_id,
                    loader.map(|s| s.to_string()),
                    game_version.map(|s| s.to_string()),
                )
                .await?;
                if let Some(first) = versions.first() {
                    if !visited.contains(&first.id) {
                        stack.push((first.id.clone(), false));
                    }
                }
            }
        }
    }

    Ok(installed)
}

async fn install_simple_pack(
    app: &AppHandle,
    instance_id: &str,
    version: &ModrinthVersion,
    kind: &str,
) -> AppResult<usize> {
    let (url, filename, size, sha1) = pick_primary_file(version)
        .ok_or_else(|| AppError::Message("No hay archivo para instalar".to_string()))?;
    let dest_dir = match kind {
        "resourcepack" => instance_resourcepacks_dir(app, instance_id),
        "shader" => instance_shaderpacks_dir(app, instance_id),
        _ => instance_mods_dir(app, instance_id),
    };
    tokio_fs::create_dir_all(&dest_dir).await.map_err(|e| AppError::Message(e.to_string()))?;
    let dest = dest_dir.join(filename);
    crate::downloader::download_file_checked(url, &dest, size, sha1).await?;
    Ok(1)
}

pub async fn modrinth_install_version_impl(
    app: &AppHandle,
    instance_id: String,
    version_id: String,
    loader: Option<String>,
    game_version: Option<String>,
    project_type: Option<String>,
) -> AppResult<String> {
    let base = instance_dir(app, &instance_id);
    if !base.exists() {
        return Err("La instancia no existe".to_string().into());
    }

    let project_type = project_type.unwrap_or_else(|| "mod".to_string());
    if project_type == "datapack" {
        return Err("Los Data Packs requieren un mundo. Próximamente.".to_string().into());
    }
    if project_type == "modpack" {
        let version = modrinth_get_version(app, &version_id).await?;
        let installed = install_modpack(app, &instance_id, &version, loader.as_deref()).await?;
        return Ok(format!("Modpack instalado ({} archivos)", installed));
    }
    if project_type == "resourcepack" {
        let version = modrinth_get_version(app, &version_id).await?;
        let file_name = pick_primary_file(&version).map(|(_, filename, _, _)| filename.to_string());
        let installed = install_simple_pack(app, &instance_id, &version, "resourcepack").await?;
        if let Some(file_name) = file_name {
            let entry = ModMetadataEntry {
                file_name,
                version_id: Some(version.id.clone()),
                project_id: version.project_id.clone(),
                dependencies: Vec::new(),
                source: Some("modrinth".to_string()),
                kind: Some("resourcepacks".to_string()),
            };
            let _ = upsert_mod_metadata(app, &instance_id, entry).await;
        }
        let _ = append_action_log(
            app,
            &format!("resourcepack_install instance={} version={}", instance_id, version_id),
        )
        .await;
        return Ok(format!("Resource pack instalado ({} archivo)", installed));
    }
    if project_type == "shader" {
        let version = modrinth_get_version(app, &version_id).await?;
        let file_name = pick_primary_file(&version).map(|(_, filename, _, _)| filename.to_string());
        let installed = install_simple_pack(app, &instance_id, &version, "shader").await?;
        if let Some(file_name) = file_name {
            let entry = ModMetadataEntry {
                file_name,
                version_id: Some(version.id.clone()),
                project_id: version.project_id.clone(),
                dependencies: Vec::new(),
                source: Some("modrinth".to_string()),
                kind: Some("shaderpacks".to_string()),
            };
            let _ = upsert_mod_metadata(app, &instance_id, entry).await;
        }
        let _ = append_action_log(
            app,
            &format!("shader_install instance={} version={}", instance_id, version_id),
        )
        .await;
        return Ok(format!("Shader instalado ({} archivo)", installed));
    }

    let installed = install_version_with_deps(
        app,
        &instance_id,
        &version_id,
        loader.as_deref(),
        game_version.as_deref(),
    )
    .await?;

    let _ = append_action_log(
        app,
        &format!("mod_install instance={} version={}", instance_id, version_id),
    )
    .await;
    Ok(format!("Instalados {} mods/dependencias", installed))
}

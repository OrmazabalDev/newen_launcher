use crate::error::AppResult;
use crate::optimization::apply_options_profile;
use crate::utils::append_action_log;
use std::path::Path;
use tauri::AppHandle;
use tokio::fs as tokio_fs;

use super::client::modrinth_list_versions_impl;
use super::install::install_version_with_deps;
use super::shared::{instance_dir, instance_mods_dir, pick_primary_file};

fn optimization_mods(loader: &str, game_version: &str) -> Vec<&'static str> {
    match loader {
        "fabric" => vec!["sodium", "lithium", "starlight", "ferrite-core", "entityculling"],
        "forge" | "neoforge" => {
            let mut mods = vec!["modernfix", "ferrite-core", "entityculling"];
            if let Some(minor) = parse_minor(game_version) {
                if minor <= 19 {
                    mods.push("lazydfu");
                }
            }
            mods
        }
        _ => Vec::new(),
    }
}

fn parse_minor(version: &str) -> Option<u32> {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() < 2 {
        return None;
    }
    parts[1].parse::<u32>().ok()
}

fn forge_render_candidates(version: &str) -> Vec<&'static str> {
    if let Some(minor) = parse_minor(version) {
        if minor >= 20 {
            vec!["embeddium", "rubidium", "magnesium"]
        } else if minor >= 16 {
            vec!["rubidium", "embeddium", "magnesium"]
        } else {
            vec!["magnesium"]
        }
    } else {
        vec!["embeddium", "rubidium", "magnesium"]
    }
}

fn forge_render_installed(installed: &[String]) -> bool {
    installed.iter().any(|p| p == "embeddium" || p == "rubidium" || p == "magnesium")
}

async fn detect_mod_conflicts(mods_dir: &Path) -> Vec<String> {
    if !tokio_fs::try_exists(mods_dir).await.unwrap_or(false) {
        return Vec::new();
    }
    let mut conflicts = Vec::new();
    let mut entries = match tokio_fs::read_dir(mods_dir).await {
        Ok(e) => e,
        Err(_) => return conflicts,
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        let ft = match entry.file_type().await {
            Ok(t) => t,
            Err(_) => continue,
        };
        if !ft.is_file() {
            continue;
        }
        let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
        if name.contains("optifine") || name.contains("optifabric") {
            conflicts.push("OptiFine".to_string());
        }
    }
    conflicts.sort();
    conflicts.dedup();
    conflicts
}

pub async fn apply_optimization_pack_impl(
    app: &AppHandle,
    instance_id: String,
    loader: String,
    game_version: String,
    preset: Option<String>,
) -> AppResult<String> {
    let base = instance_dir(app, &instance_id);
    if !tokio_fs::try_exists(&base).await.unwrap_or(false) {
        return Err("La instancia no existe".to_string().into());
    }
    let inst = crate::instances::get_instance_impl(app, &instance_id).await?;
    if inst.tags.iter().any(|t| t == "modpack") {
        return Err("No se puede aplicar optimizacion a modpacks.".to_string().into());
    }
    let mods_dir = instance_mods_dir(app, &instance_id);
    let conflicts = detect_mod_conflicts(&mods_dir).await;
    if !conflicts.is_empty() {
        return Err(
            format!(
                "Se detectaron mods incompatibles con la optimizacion: {}. Elimina esos mods y vuelve a intentar.",
                conflicts.join(", ")
            )
            .into(),
        );
    }

    let list = optimization_mods(&loader, &game_version);
    if list.is_empty() {
        return Err("El loader no es compatible con optimizaciones automáticas".to_string().into());
    }
    if game_version.trim().is_empty() {
        return Err("La versión de Minecraft es inválida.".to_string().into());
    }

    let installed_projects = crate::optimization::load_installed_projects(app, &instance_id).await;
    let mut installed = 0usize;
    let mut installed_files: Vec<String> = Vec::new();
    let mut render_mod_used: Option<String> = None;
    let mut missing_projects: Vec<String> = Vec::new();

    if (loader == "forge" || loader == "neoforge") && !forge_render_installed(&installed_projects) {
        let mut selected = None;
        for candidate in forge_render_candidates(&game_version) {
            let versions = modrinth_list_versions_impl(
                app,
                candidate.to_string(),
                Some(loader.clone()),
                Some(game_version.clone()),
            )
            .await?;
            if let Some(version) = versions.first() {
                selected = Some(candidate);
                let count = install_version_with_deps(
                    app,
                    &instance_id,
                    &version.id,
                    Some(&loader),
                    Some(&game_version),
                )
                .await?;
                installed += count;
                if let Some((_, filename, _, _)) = pick_primary_file(version) {
                    installed_files.push(filename.to_string());
                }
                render_mod_used = Some(candidate.to_string());
                break;
            }
        }
        if selected.is_none() {
            missing_projects.push("render_mod".to_string());
            let _ = append_action_log(
                app,
                &format!(
                    "optimization_render_missing instance={} loader={} version={}",
                    instance_id, loader, game_version
                ),
            )
            .await;
        }
    }

    for slug in list {
        if installed_projects.iter().any(|p| p == slug) {
            continue;
        }
        let versions = modrinth_list_versions_impl(
            app,
            slug.to_string(),
            Some(loader.clone()),
            Some(game_version.clone()),
        )
        .await?;
        if let Some(version) = versions.first() {
            let count = install_version_with_deps(
                app,
                &instance_id,
                &version.id,
                Some(&loader),
                Some(&game_version),
            )
            .await?;
            installed += count;
            if let Some((_, filename, _, _)) = pick_primary_file(version) {
                installed_files.push(filename.to_string());
            }
        } else {
            missing_projects.push(slug.to_string());
        }
    }

    let preset_key = preset.unwrap_or_else(|| "balanced".to_string());
    if installed_files.is_empty() {
        if !missing_projects.is_empty() {
            return Err(
                format!(
                    "No se encontraron versiones compatibles en Modrinth para: {}. Verifica loader/version o intenta mas tarde.",
                    missing_projects.join(", ")
                )
                .into(),
            );
        }
        return Err(
            "No se instalaron mods nuevos. Si ya estaban instalados, esta instancia ya esta optimizada. Si no, revisa la version o el loader."
                .to_string()
                .into(),
        );
    }
    let _ = apply_options_profile(app, &instance_id, &preset_key).await;
    let _ = crate::optimization::backup_mods_snapshot(app, &instance_id, &installed_files).await;
    let _ = append_action_log(
        app,
        &format!(
            "optimization_apply instance={} loader={} version={} preset={} render_mod_used={}",
            instance_id,
            loader,
            game_version,
            preset_key,
            render_mod_used.clone().unwrap_or_else(|| "none".to_string())
        ),
    )
    .await;

    Ok(format!("Optimizacion aplicada: {} mods instalados", installed))
}

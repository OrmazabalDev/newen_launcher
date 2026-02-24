use super::map_app_result;
use crate::curseforge::curseforge_search_impl;
use crate::models::{
    CurseForgeSearchResponse, InstanceSummary, ModrinthProject, ModrinthSearchResponse,
    ModrinthVersion,
};
use crate::modrinth::{
    apply_optimization_pack_impl, export_modpack_mrpack_impl, import_modpack_mrpack_impl,
    modrinth_get_project_impl, modrinth_install_datapack_impl, modrinth_install_modpack_impl,
    modrinth_install_version_impl, modrinth_list_versions_impl, modrinth_search_impl,
};
use crate::optimization::{restore_mods_snapshot, restore_options_backup};
use crate::repair::repair_instance_impl;
use crate::state::AppState;
use crate::utils::get_launcher_dir;
use tauri::State;

#[tauri::command]
pub async fn modrinth_search(
    app: tauri::AppHandle,
    query: String,
    limit: Option<u32>,
    offset: Option<u32>,
    loader: Option<String>,
    game_version: Option<String>,
    index: Option<String>,
    project_type: Option<String>,
    categories: Option<Vec<String>>,
) -> Result<ModrinthSearchResponse, String> {
    map_app_result(
        modrinth_search_impl(
            &app,
            query,
            limit,
            offset,
            loader,
            game_version,
            index,
            project_type,
            categories,
        )
        .await,
    )
}

#[tauri::command]
pub async fn modrinth_list_versions(
    app: tauri::AppHandle,
    project_id: String,
    loader: Option<String>,
    game_version: Option<String>,
) -> Result<Vec<ModrinthVersion>, String> {
    map_app_result(modrinth_list_versions_impl(&app, project_id, loader, game_version).await)
}

#[tauri::command]
pub async fn modrinth_get_project(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<ModrinthProject, String> {
    map_app_result(modrinth_get_project_impl(&app, project_id).await)
}

#[tauri::command]
pub async fn modrinth_install_version(
    app: tauri::AppHandle,
    instance_id: String,
    version_id: String,
    loader: Option<String>,
    game_version: Option<String>,
    project_type: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    match modrinth_install_version_impl(
        &app,
        instance_id.clone(),
        version_id,
        loader,
        game_version,
        project_type,
    )
    .await
    {
        Ok(msg) => Ok(msg),
        Err(err) => {
            let repair = repair_instance_impl(
                &app,
                instance_id.clone(),
                &state.manifest_cache,
                &state.metadata_cache,
            )
            .await;
            let repair_msg = match repair {
                Ok(msg) => format!("Auto-repair aplicado: {}", msg),
                Err(e) => format!("Auto-repair fallo: {}", e),
            };
            Err(format!(
                "Error instalando contenido: {}. {}. Como solucionarlo: verifica loader/version y conexion; si falla, usa Repair.",
                err, repair_msg
            ))
        }
    }
}

#[tauri::command]
pub async fn modrinth_install_modpack(
    app: tauri::AppHandle,
    version_id: String,
    name: String,
    thumbnail: Option<String>,
    state: State<'_, AppState>,
) -> Result<InstanceSummary, String> {
    match modrinth_install_modpack_impl(
        &app,
        version_id,
        name,
        thumbnail,
        &state.manifest_cache,
        &state.metadata_cache,
    )
    .await
    {
        Ok(created) => Ok(created),
        Err(err) => Err(format!(
            "Error instalando modpack: {}. Como solucionarlo: revisa tu conexion y vuelve a intentar.",
            err
        )),
    }
}

#[tauri::command]
pub async fn modrinth_install_modpack_with_backup(
    app: tauri::AppHandle,
    version_id: String,
    name: String,
    thumbnail: Option<String>,
    backup: bool,
    state: State<'_, AppState>,
) -> Result<InstanceSummary, String> {
    let created = map_app_result(
        modrinth_install_modpack_impl(
            &app,
            version_id,
            name,
            thumbnail,
            &state.manifest_cache,
            &state.metadata_cache,
        )
        .await,
    )?;
    if backup {
        let base = get_launcher_dir(&app);
        let backups = base.join("backups").join("modpacks").join(&created.id);
        let instance_dir = base.join("instances").join(&created.id);
        let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let zip_path = backups.join(format!("{}_{}.zip", created.name.replace(' ', "_"), ts));
        let backups_clone = backups.clone();
        if let Err(e) = tokio::task::spawn_blocking(move || {
            let _ = crate::utils::zip_dir_to_file(&instance_dir, &zip_path);
            let _ = crate::utils::prune_old_backups(&backups_clone, 5);
            Ok(())
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r)
        {
            eprintln!("Backup modpack fallo: {}", e);
        }
    }
    Ok(created)
}

#[tauri::command]
pub async fn import_modpack_mrpack(
    app: tauri::AppHandle,
    name: Option<String>,
    file_name: String,
    data_base64: String,
    state: State<'_, AppState>,
) -> Result<InstanceSummary, String> {
    map_app_result(
        import_modpack_mrpack_impl(
            &app,
            name,
            file_name,
            data_base64,
            &state.manifest_cache,
            &state.metadata_cache,
        )
        .await,
    )
}

#[tauri::command]
pub async fn export_modpack_mrpack(
    app: tauri::AppHandle,
    instance_id: String,
    dest_path: Option<String>,
) -> Result<String, String> {
    map_app_result(export_modpack_mrpack_impl(&app, instance_id, dest_path).await)
}

#[tauri::command]
pub async fn modrinth_install_datapack(
    app: tauri::AppHandle,
    instance_id: String,
    world_id: String,
    version_id: String,
) -> Result<String, String> {
    map_app_result(modrinth_install_datapack_impl(&app, instance_id, world_id, version_id).await)
}

#[tauri::command]
pub async fn apply_optimization_pack(
    app: tauri::AppHandle,
    instance_id: String,
    loader: String,
    game_version: String,
    preset: Option<String>,
) -> Result<String, String> {
    map_app_result(
        apply_optimization_pack_impl(&app, instance_id, loader, game_version, preset).await,
    )
}

#[tauri::command]
pub async fn rollback_optimization(
    app: tauri::AppHandle,
    instance_id: String,
) -> Result<String, String> {
    let removed = map_app_result(restore_mods_snapshot(&app, &instance_id).await)?;
    let _ = restore_options_backup(&app, &instance_id).await;
    Ok(format!(
        "Rollback aplicado. Mods eliminados: {}. Solo se removieron mods instalados por el launcher.",
        removed
    ))
}

#[tauri::command]
pub async fn curseforge_search(
    query: String,
    page_size: Option<u32>,
    index: Option<u32>,
) -> Result<CurseForgeSearchResponse, String> {
    map_app_result(curseforge_search_impl(query, page_size, index).await)
}

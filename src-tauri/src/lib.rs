// Declaración de módulos (deben existir los archivos .rs correspondientes)
mod auth;
mod content;
mod curseforge;
mod diagnostics;
mod discord;
mod downloader;
mod fabric;
mod forge;
mod instances;
mod launcher;
mod metrics;
mod models;
mod modrinth;
mod neoforge;
mod optimization;
mod repair;
mod skins;
mod utils;
mod worlds;

// Importaciones
use auth::*;
use content::*;
use curseforge::*;
use diagnostics::*;
use downloader::*;
use fabric::*;
use forge::*;
use instances::*;
use launcher::*;
use metrics::*;
use models::*;
use modrinth::*;
use neoforge::*;
use repair::*;
use skins::*;
use utils::{get_launcher_dir, hide_background_window}; // Solo importamos lo necesario
use worlds::*;

use std::sync::Mutex;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

// --- ESTADO GLOBAL (Thread-Safe) ---
// Estos Mutex permiten compartir datos entre comandos sin conflictos
static MANIFEST_CACHE: Mutex<Option<VersionManifest>> = Mutex::new(None);
static METADATA_CACHE: Mutex<Option<VersionMetadata>> = Mutex::new(None);
static CURRENT_PROFILE: Mutex<Option<MinecraftProfile>> = Mutex::new(None);

// --- COMANDOS DEL GESTOR DE VERSIONES ---

#[tauri::command]
async fn get_versions(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    // Delega a downloader.rs
    get_versions_impl(&app, &MANIFEST_CACHE).await
}

#[tauri::command]
async fn get_installed_versions(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let versions_dir = get_launcher_dir(&app).join("versions");
    if !versions_dir.exists() {
        return Ok(Vec::new());
    }

    let mut installed = Vec::new();
    // Escaneo simple de carpetas que contienen un .jar con el mismo nombre
    if let Ok(mut entries) = tokio::fs::read_dir(versions_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(name) = entry.file_name().into_string() {
                let jar_ok = entry.path().join(format!("{}.jar", name)).exists();
                let json_ok = entry.path().join(format!("{}.json", name)).exists();
                if jar_ok || json_ok {
                    installed.push(name);
                }
            }
        }
    }
    // Ordenar para que las versiones más recientes (numéricamente mayores) salgan primero
    // Nota: Esto es orden lexicográfico ("1.20" > "1.19"), funciona bien para versiones recientes
    installed.sort_by(|a, b| b.cmp(a));
    Ok(installed)
}

#[tauri::command]
async fn get_version_metadata(app: tauri::AppHandle, version_id: String) -> Result<String, String> {
    // Delega a downloader.rs
    get_version_metadata_impl(&app, version_id, &MANIFEST_CACHE, &METADATA_CACHE).await
}

// --- COMANDOS DE DESCARGA ---

#[tauri::command]
async fn download_client(app: tauri::AppHandle, version_id: String) -> Result<String, String> {
    download_client_impl(&app, version_id, &METADATA_CACHE).await
}

#[tauri::command]
async fn download_game_files(app: tauri::AppHandle, version_id: String) -> Result<String, String> {
    download_game_files_impl(&app, version_id, &METADATA_CACHE).await
}

#[tauri::command]
async fn download_java(
    app: tauri::AppHandle,
    version_id: Option<String>,
) -> Result<String, String> {
    download_java_impl(&app, version_id, &MANIFEST_CACHE, &METADATA_CACHE).await
}

#[tauri::command]
async fn delete_version(app: tauri::AppHandle, version_id: String) -> Result<(), String> {
    let base = get_launcher_dir(&app);
    let version_path = base.join("versions").join(&version_id);
    if version_path.exists() {
        std::fs::remove_dir_all(&version_path).map_err(|e| e.to_string())?;
    } else {
        return Err("La versión no existe".to_string());
    }

    // Si es Forge, también limpiar perfiles asociados
    if version_id.contains("-forge-") {
        let profiles_path = base.join("profiles").join("forge").join(&version_id);
        if profiles_path.exists() {
            std::fs::remove_dir_all(&profiles_path).ok();
        }
    }
    if version_id.contains("-neoforge-") {
        let profiles_path = base.join("profiles").join("neoforge").join(&version_id);
        if profiles_path.exists() {
            std::fs::remove_dir_all(&profiles_path).ok();
        }
    }

    Ok(())
}

// --- COMANDOS DE SISTEMA Y LANZAMIENTO ---

#[tauri::command]
async fn detect_system_java() -> Result<SystemJava, String> {
    // Lógica simple para detectar 'java' en el PATH
    let mut cmd = std::process::Command::new("java");
    cmd.arg("-version");
    hide_background_window(&mut cmd);
    let output = cmd
        .output()
        .map_err(|_| "No se encontró java en el PATH".to_string())?;

    let full_output = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    // Parseo básico de la salida "java version "1.8..." o "openjdk 17..."
    if let Some(start) = full_output.find("version \"") {
        let rest = &full_output[start + 9..];
        if let Some(end) = rest.find('"') {
            let version_str = &rest[..end];
            let major = if version_str.starts_with("1.") {
                version_str
                    .split('.')
                    .nth(1)
                    .unwrap_or("0")
                    .parse()
                    .unwrap_or(0)
            } else {
                version_str
                    .split('.')
                    .next()
                    .unwrap_or("0")
                    .parse()
                    .unwrap_or(0)
            };
            return Ok(SystemJava {
                valid: true,
                version: version_str.to_string(),
                major,
                path: "java".to_string(),
                message: format!("Detectado: {}", version_str),
            });
        }
    }
    Ok(SystemJava {
        valid: false,
        version: "".to_string(),
        major: 0,
        path: "".to_string(),
        message: "No detectado".to_string(),
    })
}

fn launch_hint(message: &str) -> Option<&'static str> {
    let lower = message.to_lowercase();
    if lower.contains("no has iniciado sesion") {
        return Some("Inicia sesion y vuelve a intentar.");
    }
    if lower.contains("java") || lower.contains("runtime") || lower.contains("adoptium") {
        return Some("Revisa Java o usa la descarga automatica.");
    }
    if lower.contains("espacio insuficiente") {
        return Some("Libera espacio en disco e intenta de nuevo.");
    }
    if lower.contains("jar base") {
        return Some("Reinstala la version desde el gestor de versiones.");
    }
    if lower.contains("mods incompatibles") {
        return Some("Mueve esos mods a una instancia compatible.");
    }
    if lower.contains("no se encontro la version instalada") {
        return Some("Reinstala el loader o la version.");
    }
    if lower.contains("no se pudo obtener espacio libre") {
        return Some("Revisa permisos del disco.");
    }
    None
}

fn support_auto_upload_enabled() -> bool {
    let raw = std::env::var("NEWEN_SUPPORT_AUTO_UPLOAD").unwrap_or_default();
    let value = raw.trim().to_lowercase();
    matches!(value.as_str(), "1" | "true" | "yes" | "on")
}

#[tauri::command]
async fn launch_game(
    app: tauri::AppHandle,
    version_id: String,
    settings: Option<GameSettings>,
    forge_profile: Option<String>,
    instance_id: Option<String>,
) -> Result<String, String> {
    // Delega a launcher.rs
    let version_for_report = version_id.clone();
    if let Some(id) = &instance_id {
        let _ = touch_instance_impl(&app, id).await;
    }
    let result = launch_game_impl(
        &app,
        version_id,
        &MANIFEST_CACHE,
        &METADATA_CACHE,
        &CURRENT_PROFILE,
        settings,
        forge_profile,
        instance_id.clone(),
    )
    .await;

    if let Err(err) = result {
        if let Some(id) = instance_id {
            let prelaunch_report = {
                let base = get_launcher_dir(&app);
                let logs_dir = base.join("instances").join(&id).join("logs");
                let _ = std::fs::create_dir_all(&logs_dir);
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                let report_path = logs_dir.join(format!("prelaunch-error-{}.log", ts));
                let body = format!(
                    "Error de pre-lanzamiento\ninstance={}\nversion={}\nerror={}\n",
                    id, version_for_report, err
                );
                std::fs::write(&report_path, body).map(|_| report_path)
            };

            let repair = repair_instance_impl(&app, id.clone(), &MANIFEST_CACHE, &METADATA_CACHE).await;
            let repair_msg = match repair {
                Ok(msg) => format!("Auto-repair aplicado: {}", msg),
                Err(e) => format!("Auto-repair fallo: {}", e),
            };
            let report_msg = match prelaunch_report {
                Ok(path) => format!("Log prelaunch: {}", path.to_string_lossy()),
                Err(_) => "Log prelaunch: no se pudo guardar prelaunch-error.log".to_string(),
            };
            let diagnostic = generate_diagnostic_report_for_instance_impl(&app, id.clone()).await;
            let (diagnostic_msg, diagnostic_path) = match diagnostic {
                Ok(path) => (format!("Reporte diagnostico: {}", path), Some(path)),
                Err(e) => (
                    format!("Reporte diagnostico: no se pudo generar ({})", e),
                    None,
                ),
            };
            let upload_msg = if support_auto_upload_enabled() {
                match diagnostic_path {
                    Some(path) => match upload_diagnostic_report_impl(
                        &app,
                        Some(path),
                        Some(id.clone()),
                    )
                    .await
                    {
                        Ok(msg) => Some(format!("Soporte: {}", msg)),
                        Err(e) => Some(format!("Soporte: {}", e)),
                    },
                    None => Some("Soporte: sin reporte para subir".to_string()),
                }
            } else {
                None
            };
            let hint = launch_hint(&err);
            let mut parts = vec![
                format!("Fallo al lanzar: {}", err),
                repair_msg,
                report_msg,
                diagnostic_msg,
            ];
            if let Some(msg) = upload_msg {
                parts.push(msg);
            }
            if let Some(h) = hint {
                parts.push(format!("Sugerencia: {}", h));
            }
            return Err(parts.join(" | "));
        }
        let hint = launch_hint(&err);
        let mut parts = vec![
            format!("Fallo al lanzar: {}", err),
            "Prueba Repair desde la instancia.".to_string(),
        ];
        if let Some(h) = hint {
            parts.push(format!("Sugerencia: {}", h));
        }
        return Err(parts.join(" | "));
    }

    result
}

// --- INSTANCIAS ---

#[tauri::command]
async fn list_instances(app: tauri::AppHandle) -> Result<Vec<InstanceSummary>, String> {
    list_instances_impl(&app).await
}

#[tauri::command]
async fn list_instance_content(
    app: tauri::AppHandle,
    instance_id: String,
    kind: String,
) -> Result<Vec<InstanceContentItem>, String> {
    list_instance_content_impl(&app, instance_id, kind).await
}

#[tauri::command]
async fn toggle_instance_content(
    app: tauri::AppHandle,
    instance_id: String,
    kind: String,
    file_name: String,
    enabled: bool,
) -> Result<(), String> {
    toggle_instance_content_impl(&app, instance_id, kind, file_name, enabled).await
}

#[tauri::command]
async fn delete_instance_content(
    app: tauri::AppHandle,
    instance_id: String,
    kind: String,
    file_name: String,
) -> Result<(), String> {
    delete_instance_content_impl(&app, instance_id, kind, file_name).await
}

#[tauri::command]
fn open_instance_content_folder(
    app: tauri::AppHandle,
    instance_id: String,
    kind: String,
) -> Result<(), String> {
    open_instance_content_folder_impl(&app, instance_id, kind)
}

#[tauri::command]
async fn list_instance_reports(
    app: tauri::AppHandle,
    instance_id: String,
) -> Result<Vec<InstanceLogEntry>, String> {
    list_instance_reports_impl(&app, instance_id).await
}

#[tauri::command]
async fn read_instance_report(
    app: tauri::AppHandle,
    instance_id: String,
    kind: String,
    name: String,
) -> Result<String, String> {
    read_instance_report_impl(&app, instance_id, kind, name).await
}

#[tauri::command]
fn get_runtime_metrics(pid: Option<u32>) -> Result<RuntimeMetrics, String> {
    get_runtime_metrics_impl(pid)
}

#[tauri::command]
async fn create_instance(
    app: tauri::AppHandle,
    req: InstanceCreateRequest,
) -> Result<InstanceSummary, String> {
    create_instance_impl(&app, req).await
}

#[tauri::command]
async fn update_instance(
    app: tauri::AppHandle,
    instance_id: String,
    req: InstanceUpdateRequest,
) -> Result<InstanceSummary, String> {
    update_instance_impl(&app, instance_id, req).await
}

#[tauri::command]
async fn delete_instance(app: tauri::AppHandle, instance_id: String) -> Result<(), String> {
    delete_instance_impl(&app, instance_id).await
}

#[tauri::command]
fn open_instance_folder(app: tauri::AppHandle, instance_id: String) -> Result<(), String> {
    open_instance_folder_impl(&app, instance_id)
}

#[tauri::command]
fn clear_cache(app: tauri::AppHandle) -> Result<String, String> {
    let base = get_launcher_dir(&app);
    let cache_dir = base.join("cache");
    if cache_dir.exists() {
        std::fs::remove_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }
    Ok("Cache limpiada".to_string())
}

#[tauri::command]
fn close_splash(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    Ok(())
}

#[tauri::command]
async fn repair_instance(app: tauri::AppHandle, instance_id: String) -> Result<String, String> {
    repair_instance_impl(&app, instance_id, &MANIFEST_CACHE, &METADATA_CACHE).await
}

#[tauri::command]
async fn generate_diagnostic_report(app: tauri::AppHandle) -> Result<String, String> {
    generate_diagnostic_report_impl(&app).await
}

#[tauri::command]
async fn upload_diagnostic_report(
    app: tauri::AppHandle,
    report_path: Option<String>,
    instance_id: Option<String>,
) -> Result<String, String> {
    upload_diagnostic_report_impl(&app, report_path, instance_id).await
}

#[tauri::command]
async fn discord_init() -> Result<(), String> {
    crate::discord::init()
}

#[tauri::command]
async fn discord_set_activity(
    state: String,
    details: String,
    start_timestamp: Option<i64>,
    show_buttons: bool,
) -> Result<(), String> {
    crate::discord::set_activity(&state, &details, start_timestamp, show_buttons)
}

#[tauri::command]
async fn discord_clear_activity() -> Result<(), String> {
    crate::discord::clear_activity()
}

#[tauri::command]
async fn discord_shutdown() -> Result<(), String> {
    crate::discord::shutdown()
}

// --- MODRINTH ---

#[tauri::command]
async fn modrinth_search(
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
    .await
}

#[tauri::command]
async fn modrinth_list_versions(
    app: tauri::AppHandle,
    project_id: String,
    loader: Option<String>,
    game_version: Option<String>,
) -> Result<Vec<ModrinthVersion>, String> {
    modrinth_list_versions_impl(&app, project_id, loader, game_version).await
}

#[tauri::command]
async fn modrinth_get_project(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<ModrinthProject, String> {
    modrinth_get_project_impl(&app, project_id).await
}

#[tauri::command]
async fn modrinth_install_version(
    app: tauri::AppHandle,
    instance_id: String,
    version_id: String,
    loader: Option<String>,
    game_version: Option<String>,
    project_type: Option<String>,
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
            let repair =
                repair_instance_impl(&app, instance_id.clone(), &MANIFEST_CACHE, &METADATA_CACHE)
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
async fn modrinth_install_modpack(
    app: tauri::AppHandle,
    version_id: String,
    name: String,
    thumbnail: Option<String>,
) -> Result<InstanceSummary, String> {
    match modrinth_install_modpack_impl(&app, version_id, name, thumbnail, &MANIFEST_CACHE, &METADATA_CACHE).await {
        Ok(created) => Ok(created),
        Err(err) => Err(format!(
            "Error instalando modpack: {}. Como solucionarlo: revisa tu conexion y vuelve a intentar.",
            err
        )),
    }
}

#[tauri::command]
async fn modrinth_install_modpack_with_backup(
    app: tauri::AppHandle,
    version_id: String,
    name: String,
    thumbnail: Option<String>,
    backup: bool,
) -> Result<InstanceSummary, String> {
    let created = modrinth_install_modpack_impl(
        &app,
        version_id,
        name,
        thumbnail,
        &MANIFEST_CACHE,
        &METADATA_CACHE,
    )
    .await?;
    if backup {
        let base = get_launcher_dir(&app);
        let backups = base.join("backups").join("modpacks").join(&created.id);
        let instance_dir = base.join("instances").join(&created.id);
        let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let zip_path = backups.join(format!("{}_{}.zip", created.name.replace(' ', "_"), ts));
        let backups_clone = backups.clone();
        if let Err(e) = tokio::task::spawn_blocking(move || {
            crate::utils::zip_dir_to_file(&instance_dir, &zip_path)?;
            crate::utils::prune_old_backups(&backups_clone, 5)?;
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
async fn import_modpack_mrpack(
    app: tauri::AppHandle,
    name: Option<String>,
    file_name: String,
    data_base64: String,
) -> Result<InstanceSummary, String> {
    import_modpack_mrpack_impl(
        &app,
        name,
        file_name,
        data_base64,
        &MANIFEST_CACHE,
        &METADATA_CACHE,
    )
    .await
}

#[tauri::command]
async fn export_modpack_mrpack(
    app: tauri::AppHandle,
    instance_id: String,
    dest_path: Option<String>,
) -> Result<String, String> {
    export_modpack_mrpack_impl(&app, instance_id, dest_path).await
}

#[tauri::command]
async fn modrinth_install_datapack(
    app: tauri::AppHandle,
    instance_id: String,
    world_id: String,
    version_id: String,
) -> Result<String, String> {
    modrinth_install_datapack_impl(&app, instance_id, world_id, version_id).await
}

#[tauri::command]
async fn apply_optimization_pack(
    app: tauri::AppHandle,
    instance_id: String,
    loader: String,
    game_version: String,
    preset: Option<String>,
) -> Result<String, String> {
    apply_optimization_pack_impl(&app, instance_id, loader, game_version, preset).await
}

#[tauri::command]
async fn rollback_optimization(
    app: tauri::AppHandle,
    instance_id: String,
) -> Result<String, String> {
    let removed = crate::optimization::restore_mods_snapshot(&app, &instance_id).await?;
    let _ = crate::optimization::restore_options_backup(&app, &instance_id).await;
    Ok(format!(
        "Rollback aplicado. Mods eliminados: {}. Solo se removieron mods instalados por el launcher.",
        removed
    ))
}

// --- CURSEFORGE ---

#[tauri::command]
async fn curseforge_search(
    query: String,
    page_size: Option<u32>,
    index: Option<u32>,
) -> Result<CurseForgeSearchResponse, String> {
    curseforge_search_impl(query, page_size, index).await
}

// --- FORGE ---

#[tauri::command]
async fn install_forge(app: tauri::AppHandle, version_id: String) -> Result<String, String> {
    install_forge_impl(&app, version_id, None, &MANIFEST_CACHE, &METADATA_CACHE).await
}

#[tauri::command]
async fn install_fabric(app: tauri::AppHandle, version_id: String) -> Result<String, String> {
    install_fabric_impl(&app, version_id, None, &MANIFEST_CACHE, &METADATA_CACHE).await
}

#[tauri::command]
async fn install_neoforge(app: tauri::AppHandle, version_id: String) -> Result<String, String> {
    install_neoforge_impl(&app, version_id, None, &MANIFEST_CACHE, &METADATA_CACHE).await
}

#[tauri::command]
async fn list_instance_worlds(
    app: tauri::AppHandle,
    instance_id: String,
) -> Result<Vec<String>, String> {
    list_instance_worlds_impl(&app, instance_id).await
}

#[tauri::command]
fn open_world_datapacks_folder(
    app: tauri::AppHandle,
    instance_id: String,
    world_id: String,
) -> Result<(), String> {
    open_world_datapacks_folder_impl(&app, instance_id, world_id)
}

#[tauri::command]
async fn import_datapack_zip(
    app: tauri::AppHandle,
    instance_id: String,
    world_id: String,
    file_name: String,
    data_base64: String,
) -> Result<String, String> {
    import_datapack_zip_impl(&app, instance_id, world_id, file_name, data_base64).await
}

// --- COMANDOS DE AUTENTICACIÓN ---

#[tauri::command]
async fn login_offline(username: String) -> Result<String, String> {
    // Delega a auth.rs
    login_offline_impl(username, &CURRENT_PROFILE).await
}

#[tauri::command]
async fn start_ms_login(app: tauri::AppHandle) -> Result<DeviceCodeResponse, String> {
    start_ms_login_impl(&app).await
}

#[tauri::command]
async fn poll_ms_login(app: tauri::AppHandle, device_code: String) -> Result<String, String> {
    poll_ms_login_impl(&app, device_code, &CURRENT_PROFILE).await
}

#[tauri::command]
async fn restore_ms_session(app: tauri::AppHandle) -> Result<String, String> {
    restore_ms_session_impl(&app, &CURRENT_PROFILE).await
}

#[tauri::command]
async fn logout_session(app: tauri::AppHandle) -> Result<(), String> {
    logout_impl(&app, &CURRENT_PROFILE).await
}

#[tauri::command]
async fn refresh_ms_profile(app: tauri::AppHandle) -> Result<String, String> {
    refresh_ms_profile_impl(&app, &CURRENT_PROFILE).await
}

// --- PUNTO DE ENTRADA PRINCIPAL ---
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            if let Some(main) = app.get_webview_window("main") {
                let _ = main.hide();
            }
            let _ = WebviewWindowBuilder::new(app, "splash", WebviewUrl::App("splash.html".into()))
                .title("Newen Launcher")
                .inner_size(300.0, 180.0)
                .resizable(false)
                .decorations(false)
                .always_on_top(true)
                .center()
                .build();

            Ok(())
        })
        // Registro de TODOS los comandos disponibles para el Frontend
        .invoke_handler(tauri::generate_handler![
            // Gestión
            get_versions,
            get_installed_versions,
            get_version_metadata,
            // Descargas
            download_client,
            download_game_files,
            download_java,
            delete_version,
            // Sistema
            detect_system_java,
            launch_game,
            // Discord
            discord_init,
            discord_set_activity,
            discord_clear_activity,
            discord_shutdown,
            // Instancias
            list_instances,
            list_instance_content,
            toggle_instance_content,
            delete_instance_content,
            open_instance_content_folder,
            list_instance_reports,
            read_instance_report,
            get_runtime_metrics,
            create_instance,
            update_instance,
            delete_instance,
            open_instance_folder,
            clear_cache,
            close_splash,
            repair_instance,
            generate_diagnostic_report,
            upload_diagnostic_report,
            // Modrinth
            modrinth_search,
            modrinth_list_versions,
            modrinth_get_project,
            modrinth_install_version,
            modrinth_install_modpack,
            modrinth_install_modpack_with_backup,
            import_modpack_mrpack,
            export_modpack_mrpack,
            modrinth_install_datapack,
            apply_optimization_pack,
            rollback_optimization,
            curseforge_search,
            // Auth
            login_offline,
            start_ms_login,
            poll_ms_login,
            restore_ms_session,
            logout_session,
            refresh_ms_profile,
            // Forge
            install_forge,
            install_fabric,
            install_neoforge,
            list_instance_worlds,
            open_world_datapacks_folder,
            import_datapack_zip,
            // Skins (offline)
            get_active_skin,
            set_active_skin_base64,
            set_active_skin_url,
            clear_active_skin,
            get_active_cape,
            set_active_cape_base64,
            set_active_cape_url,
            clear_active_cape,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("error while running tauri application: {}", e);
        });
}

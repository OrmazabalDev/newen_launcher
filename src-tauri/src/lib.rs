// Declaracion de modulos (deben existir los archivos .rs correspondientes)
mod auth;
mod commands;
mod content;
mod curseforge;
mod diagnostics;
mod discord;
mod downloader;
mod error;
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
mod state;
mod utils;
mod worlds;

use commands::*;
use state::AppState;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

// --- PUNTO DE ENTRADA PRINCIPAL ---
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            let _ = app.handle().plugin(tauri_plugin_updater::Builder::new().build());

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

            #[cfg(debug_assertions)]
            {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    if let Some(splash) = app_handle.get_webview_window("splash") {
                        let _ = splash.close();
                    }
                    if let Some(main) = app_handle.get_webview_window("main") {
                        let _ = main.show();
                        let _ = main.set_focus();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Gestion
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

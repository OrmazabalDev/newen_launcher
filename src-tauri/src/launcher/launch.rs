use crate::downloader::download_libraries_concurrent;
use crate::models::{
    GameProcessPayload, GameSettings, MinecraftProfile, ProgressPayload, VersionManifest,
    VersionMetadata,
};
use crate::utils::{get_launcher_dir, hide_background_window};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;

use super::args::{build_arguments, build_classpath};
use super::fs::{ensure_disk_space, open_launch_log, resolve_game_dir};
use super::java::{ensure_java_runtime, resolve_java_binary, resolve_required_java_version};
use super::mods::detect_mod_loader_conflicts;
use super::natives::ensure_natives;
use super::options::apply_options_settings;
use super::skins::prepare_offline_skin_pack;
use super::version::{
    extract_base_version, mc_minor_from_version_id, resolve_version, should_skip_game_jar,
};

pub async fn launch_game_impl(
    app: &AppHandle,
    version_id: String,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
    profile_cache: &Mutex<Option<MinecraftProfile>>,
    settings: Option<GameSettings>,
    forge_profile: Option<String>,
    instance_id: Option<String>,
) -> Result<String, String> {
    let profile = {
        let cache = profile_cache
            .lock()
            .map_err(|_| "Error cache perfil".to_string())?;
        cache.clone().ok_or("No has iniciado sesion.".to_string())?
    };

    let settings = settings.unwrap_or(GameSettings {
        resolution: crate::models::Resolution {
            width: 1280,
            height: 720,
        },
        fullscreen: true,
        memory: crate::models::MemorySettings {
            min_gb: 1,
            max_gb: 2,
        },
        java_args: String::new(),
        java_path: String::new(),
        max_fps: 120,
    });

    let resolved = resolve_version(app, &version_id, metadata_cache)?;
    let required_java =
        resolve_required_java_version(app, &version_id, &resolved, manifest_cache, metadata_cache)
            .await?;

    let base_dir = get_launcher_dir(app);
    let lib_dir = base_dir.join("libraries");
    let assets_dir = base_dir.join("assets");
    let natives_dir = base_dir.join("versions").join(&version_id).join("natives");
    let game_dir = resolve_game_dir(
        app,
        &version_id,
        forge_profile.as_deref(),
        instance_id.as_deref(),
    )?;
    let is_forge = version_id.contains("-forge-");
    let is_neoforge = version_id.contains("neoforge");
    let is_fabric = version_id.contains("fabric");

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Preparando entorno de juego...".to_string(),
            percent: 0.0,
        },
    );

    ensure_java_runtime(
        app,
        &version_id,
        required_java.as_ref(),
        manifest_cache,
        metadata_cache,
        &settings,
    )
    .await?;

    tokio_fs::create_dir_all(&game_dir)
        .await
        .map_err(|e| e.to_string())?;
    if instance_id.is_some() || is_forge || is_neoforge || is_fabric {
        let _ = tokio_fs::create_dir_all(game_dir.join("mods")).await;
        let _ = tokio_fs::create_dir_all(game_dir.join("config")).await;
    }
    detect_mod_loader_conflicts(&game_dir, is_forge, is_neoforge, is_fabric).await?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Verificando librerias...".to_string(),
            percent: 5.0,
        },
    );
    download_libraries_concurrent(&resolved.libraries, &lib_dir).await?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Extrayendo librerias nativas...".to_string(),
            percent: 10.0,
        },
    );
    ensure_natives(&resolved.libraries, &lib_dir, &natives_dir).await?;

    let skin_pack = prepare_offline_skin_pack(&app, &game_dir, &version_id, &profile).await?;
    apply_options_settings(&game_dir, &settings, skin_pack.as_deref()).await?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Construyendo classpath...".to_string(),
            percent: 30.0,
        },
    );
    let base_version = extract_base_version(&version_id);
    let include_game_jar = !((is_forge || is_neoforge) && should_skip_game_jar(&base_version));
    let classpath = build_classpath(&resolved, &base_dir, &lib_dir, include_game_jar);
    let separator = if cfg!(windows) { ";" } else { ":" };

    let jar_path = base_dir
        .join("versions")
        .join(&resolved.jar)
        .join(format!("{}.jar", resolved.jar));
    if !jar_path.exists() {
        return Err(format!(
            "No se encontro el jar base: {}",
            jar_path.to_string_lossy()
        ));
    }

    ensure_disk_space(app, &game_dir, 1_000_000_000).await?;

    let (mut jvm_args, game_args) = build_arguments(
        &resolved,
        &profile,
        &settings,
        &version_id,
        &game_dir,
        &assets_dir,
        &natives_dir,
        &lib_dir,
        &classpath,
        separator,
    );

    // Ensure module flags for Forge 1.18+ to avoid module resolution issues
    if is_forge || is_neoforge {
        let minor = mc_minor_from_version_id(&version_id);
        if minor >= 18 && !jvm_args.iter().any(|a| a == "--add-modules") {
            jvm_args.push("--add-modules".to_string());
            jvm_args.push("ALL-MODULE-PATH".to_string());
        }
    }

    let mut args = Vec::new();
    args.extend(jvm_args);
    args.push(resolved.main_class);
    args.extend(game_args);

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Lanzando Minecraft...".to_string(),
            percent: 100.0,
        },
    );

    let (log_path, log_out, log_err) = tokio::task::spawn_blocking({
        let base_dir = base_dir.clone();
        move || open_launch_log(&base_dir)
    })
    .await
    .map_err(|e| e.to_string())??;
    let java_bin = resolve_java_binary(&settings, required_java.as_ref(), &base_dir)?;

    let mut cmd = Command::new(java_bin);
    cmd.args(args)
        .current_dir(&game_dir)
        .stdout(log_out)
        .stderr(log_err);
    hide_background_window(&mut cmd);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Error al iniciar proceso Java: {}", e))?;

    let pid = child.id();
    let _ = app.emit("game-started", GameProcessPayload { pid, code: None });

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let status = child.wait().ok();
        let code = status.and_then(|s| s.code());
        let _ = app_handle.emit("game-exited", GameProcessPayload { pid, code });
    });

    Ok(format!(
        "Juego lanzado con PID: {} (log: {})",
        pid,
        log_path.to_string_lossy()
    ))
}

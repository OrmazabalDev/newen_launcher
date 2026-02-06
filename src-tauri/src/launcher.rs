use crate::downloader::download_java_impl;
use crate::downloader::download_libraries_concurrent;
use crate::downloader::get_version_metadata_impl;
use crate::models::{
    GameProcessPayload, GameSettings, JavaVersion, Library, MinecraftProfile, ProgressPayload,
    Rule, VersionArgument, VersionArguments, VersionJson, VersionManifest, VersionMetadata,
};
use crate::utils::{
    detect_os_adoptium, extract_native_jar, get_launcher_dir, hide_background_window,
    map_component_to_java_version, maven_artifact_path, should_download_lib,
};
use sha1::{Digest, Sha1};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::path::PathBuf as StdPathBuf;
use std::process::Command;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;

#[derive(Clone)]
struct ResolvedVersion {
    main_class: String,
    minecraft_arguments: Option<String>,
    arguments: Option<VersionArguments>,
    libraries: Vec<Library>,
    asset_index_id: String,
    jar: String,
    java_version: Option<JavaVersion>,
}

async fn resolve_required_java_version(
    app: &AppHandle,
    version_id: &str,
    resolved: &ResolvedVersion,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> Result<Option<JavaVersion>, String> {
    let base_version = extract_base_version(version_id);
    let _ = get_version_metadata_impl(app, base_version.clone(), manifest_cache, metadata_cache)
        .await?;
    let cache = metadata_cache
        .lock()
        .map_err(|_| "Error cache".to_string())?;
    let meta_java = cache.as_ref().and_then(|m| m.java_version.clone());
    let inferred = infer_java_version_from_mc(&base_version);
    Ok(pick_highest_java_version(&[
        resolved.java_version.clone(),
        meta_java,
        inferred,
    ]))
}

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

fn resolve_game_dir(
    app: &AppHandle,
    version_id: &str,
    forge_profile: Option<&str>,
    instance_id: Option<&str>,
) -> Result<PathBuf, String> {
    let base = get_launcher_dir(app);
    if let Some(id) = instance_id {
        let path = base.join("instances").join(id);
        return Ok(path);
    }
    if version_id.contains("neoforge") {
        let profile = forge_profile.unwrap_or("default");
        let path = base
            .join("profiles")
            .join("neoforge")
            .join(version_id)
            .join(profile);
        return Ok(path);
    }
    if version_id.contains("-forge-") {
        let profile = forge_profile.unwrap_or("default");
        let path = base
            .join("profiles")
            .join("forge")
            .join(version_id)
            .join(profile);
        return Ok(path);
    }
    Ok(base)
}

fn resolve_version(
    app: &AppHandle,
    version_id: &str,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> Result<ResolvedVersion, String> {
    let v = load_version_json(app, version_id, metadata_cache)?;
    if let Some(parent_id) = v.inherits_from.clone() {
        let parent = resolve_version(app, &parent_id, metadata_cache)?;
        Ok(merge_versions(parent, v))
    } else {
        Ok(to_resolved(v))
    }
}

fn load_version_json(
    app: &AppHandle,
    version_id: &str,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> Result<VersionJson, String> {
    let version_path = get_launcher_dir(app)
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));
    if version_path.exists() {
        let raw = std::fs::read_to_string(&version_path).map_err(|e| e.to_string())?;
        let parsed: VersionJson = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        return Ok(parsed);
    }

    let cache = metadata_cache
        .lock()
        .map_err(|_| "Error cache".to_string())?;
    if let Some(meta) = &*cache {
        if meta.id == version_id {
            let value = serde_json::to_value(meta).map_err(|e| e.to_string())?;
            let parsed: VersionJson = serde_json::from_value(value).map_err(|e| e.to_string())?;
            return Ok(parsed);
        }
    }
    Err("No se encontro version json".to_string())
}

fn to_resolved(v: VersionJson) -> ResolvedVersion {
    let jar = v.jar.clone().unwrap_or_else(|| v.id.clone());
    ResolvedVersion {
        main_class: v
            .main_class
            .unwrap_or_else(|| "net.minecraft.client.main.Main".to_string()),
        minecraft_arguments: v.minecraft_arguments,
        arguments: v.arguments,
        libraries: v.libraries.unwrap_or_default(),
        asset_index_id: v
            .asset_index
            .map(|a| a.id)
            .unwrap_or_else(|| "legacy".to_string()),
        jar,
        java_version: v.java_version,
    }
}

fn merge_versions(parent: ResolvedVersion, child: VersionJson) -> ResolvedVersion {
    let mut libs = parent.libraries.clone();
    if let Some(child_libs) = &child.libraries {
        libs.extend(child_libs.clone());
    }

    let merged_args = merge_arguments(&parent.arguments, &child.arguments);
    let minecraft_arguments = child.minecraft_arguments.or(parent.minecraft_arguments);
    let main_class = child.main_class.unwrap_or(parent.main_class);
    let jar = child.jar.unwrap_or(parent.jar);
    let asset_index_id = child
        .asset_index
        .map(|a| a.id)
        .unwrap_or(parent.asset_index_id);
    let java_version = match (child.java_version, parent.java_version) {
        (Some(c), Some(p)) => {
            if c.major_version >= p.major_version {
                Some(c)
            } else {
                Some(p)
            }
        }
        (Some(c), None) => Some(c),
        (None, Some(p)) => Some(p),
        (None, None) => None,
    };

    ResolvedVersion {
        main_class,
        minecraft_arguments,
        arguments: merged_args,
        libraries: libs,
        asset_index_id,
        jar,
        java_version,
    }
}

fn merge_arguments(
    parent: &Option<VersionArguments>,
    child: &Option<VersionArguments>,
) -> Option<VersionArguments> {
    match (parent, child) {
        (Some(p), Some(c)) => Some(VersionArguments {
            game: merge_arg_list(&p.game, &c.game),
            jvm: merge_arg_list(&p.jvm, &c.jvm),
        }),
        (Some(p), None) => Some(p.clone()),
        (None, Some(c)) => Some(c.clone()),
        (None, None) => None,
    }
}

fn merge_arg_list(
    a: &Option<Vec<VersionArgument>>,
    b: &Option<Vec<VersionArgument>>,
) -> Option<Vec<VersionArgument>> {
    let mut out = Vec::new();
    if let Some(list) = a {
        out.extend(list.clone());
    }
    if let Some(list) = b {
        out.extend(list.clone());
    }
    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

fn natives_signature(libraries: &Vec<Library>) -> String {
    let os_key = match std::env::consts::OS {
        "windows" => "windows",
        "linux" => "linux",
        "macos" => "osx",
        _ => "err",
    };
    let mut entries: Vec<String> = Vec::new();
    for lib in libraries {
        if !should_download_lib(lib) {
            continue;
        }
        if let Some(downloads) = &lib.downloads {
            if let Some(classifiers) = &downloads.classifiers {
                for (key, artifact) in classifiers {
                    if key.contains(os_key) {
                        entries.push(format!(
                            "{}:{}:{}",
                            artifact.path, artifact.sha1, artifact.size
                        ));
                    }
                }
            }
        }
    }
    entries.sort();
    let mut hasher = Sha1::new();
    for item in entries {
        hasher.update(item.as_bytes());
    }
    format!("{:x}", hasher.finalize())
}

async fn ensure_natives(
    libraries: &Vec<Library>,
    lib_dir: &PathBuf,
    natives_dir: &PathBuf,
) -> Result<(), String> {
    let signature = natives_signature(libraries);
    let stamp_path = natives_dir.join(".natives_stamp");

    if natives_dir.exists() {
        if let Ok(stamp) = tokio_fs::read_to_string(&stamp_path).await {
            if stamp.trim() == signature {
                return Ok(());
            }
        }
        let _ = tokio_fs::remove_dir_all(natives_dir).await;
    }

    tokio_fs::create_dir_all(natives_dir)
        .await
        .map_err(|e| e.to_string())?;

    let os_key = match std::env::consts::OS {
        "windows" => "windows",
        "linux" => "linux",
        "macos" => "osx",
        _ => "err",
    };

    let mut native_jars: Vec<PathBuf> = Vec::new();
    for lib in libraries {
        if !should_download_lib(lib) {
            continue;
        }
        if let Some(downloads) = &lib.downloads {
            if let Some(classifiers) = &downloads.classifiers {
                for (key, artifact) in classifiers {
                    if key.contains(os_key) {
                        native_jars.push(lib_dir.join(&artifact.path));
                    }
                }
            }
        }
    }

    let natives_dir_owned = natives_dir.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<(), String> {
        for jar_path in native_jars {
            if !jar_path.exists() {
                return Err(format!("Falta nativo: {}", jar_path.to_string_lossy()));
            }
            extract_native_jar(&jar_path, &natives_dir_owned)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?;

    result?;
    tokio_fs::write(&stamp_path, signature)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn build_classpath(
    resolved: &ResolvedVersion,
    base_dir: &PathBuf,
    lib_dir: &PathBuf,
    include_game_jar: bool,
) -> String {
    let mut cp_paths = Vec::new();
    let mut seen = HashSet::new();

    for lib in &resolved.libraries {
        if !should_download_lib(lib) {
            continue;
        }
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                let path = lib_dir.join(&artifact.path).to_string_lossy().to_string();
                if seen.insert(path.clone()) {
                    cp_paths.push(path);
                }
                continue;
            }
        }
        if let Some(path) = maven_artifact_path(&lib.name) {
            let path = lib_dir.join(path).to_string_lossy().to_string();
            if seen.insert(path.clone()) {
                cp_paths.push(path);
            }
        }
    }

    if include_game_jar {
        let jar_id = &resolved.jar;
        let client_jar = base_dir
            .join("versions")
            .join(jar_id)
            .join(format!("{}.jar", jar_id));
        let client_path = client_jar.to_string_lossy().to_string();
        if seen.insert(client_path.clone()) {
            cp_paths.push(client_path);
        }
    }

    let separator = if cfg!(windows) { ";" } else { ":" };
    cp_paths.join(separator)
}

fn should_skip_game_jar(version_id: &str) -> bool {
    mc_minor_from_version_id(version_id) >= 17
}

fn mc_minor_from_version_id(version_id: &str) -> u32 {
    let base = version_id.split('-').next().unwrap_or(version_id);
    let parts: Vec<&str> = base.split('.').collect();
    parts
        .get(1)
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(0)
}

fn build_arguments(
    resolved: &ResolvedVersion,
    profile: &MinecraftProfile,
    settings: &GameSettings,
    version_id: &str,
    game_dir: &PathBuf,
    assets_dir: &PathBuf,
    natives_dir: &PathBuf,
    lib_dir: &PathBuf,
    classpath: &str,
    separator: &str,
) -> (Vec<String>, Vec<String>) {
    let mut vars = HashMap::new();
    vars.insert("auth_player_name".to_string(), profile.name.clone());
    vars.insert("version_name".to_string(), version_id.to_string());
    vars.insert(
        "game_directory".to_string(),
        game_dir.to_string_lossy().to_string(),
    );
    vars.insert(
        "assets_root".to_string(),
        assets_dir.to_string_lossy().to_string(),
    );
    vars.insert(
        "assets_index_name".to_string(),
        resolved.asset_index_id.clone(),
    );
    vars.insert("auth_uuid".to_string(), profile.id.clone());
    let access_token = profile
        .access_token
        .clone()
        .unwrap_or_else(|| "0".to_string());
    let user_type = profile
        .user_type
        .clone()
        .unwrap_or_else(|| "mojang".to_string());
    let auth_xuid = profile.xuid.clone().unwrap_or_else(|| "0".to_string());
    vars.insert("auth_access_token".to_string(), access_token);
    vars.insert("clientid".to_string(), "0".to_string());
    vars.insert("auth_xuid".to_string(), auth_xuid);
    vars.insert("user_properties".to_string(), "{}".to_string());
    vars.insert("user_type".to_string(), user_type);
    vars.insert("version_type".to_string(), "release".to_string());
    vars.insert("classpath".to_string(), classpath.to_string());
    vars.insert(
        "natives_directory".to_string(),
        natives_dir.to_string_lossy().to_string(),
    );
    vars.insert("launcher_name".to_string(), "NewenLauncher".to_string());
    vars.insert("launcher_version".to_string(), "1.0".to_string());
    vars.insert("classpath_separator".to_string(), separator.to_string());
    vars.insert(
        "library_directory".to_string(),
        lib_dir.to_string_lossy().to_string(),
    );
    vars.insert(
        "resolution_width".to_string(),
        settings.resolution.width.to_string(),
    );
    vars.insert(
        "resolution_height".to_string(),
        settings.resolution.height.to_string(),
    );

    let mut features = HashMap::new();
    features.insert("is_demo_user".to_string(), false);
    features.insert("has_custom_resolution".to_string(), true);
    features.insert("is_fullscreen".to_string(), settings.fullscreen);
    features.insert("has_quick_plays_support".to_string(), false);

    let mut jvm_args = if let Some(args) = &resolved.arguments {
        build_args_list(args.jvm.as_ref(), &vars, &features)
    } else {
        Vec::new()
    };

    if !settings.java_args.trim().is_empty() {
        for arg in settings.java_args.split_whitespace() {
            if !arg.trim().is_empty() {
                jvm_args.push(arg.to_string());
            }
        }
    }

    let mut min_gb = settings.memory.min_gb.max(1);
    let max_gb = settings.memory.max_gb.max(1);
    if min_gb > max_gb {
        min_gb = max_gb;
    }
    if !jvm_args.iter().any(|a| a.starts_with("-Xmx")) {
        jvm_args.insert(0, format!("-Xmx{}G", max_gb));
    }
    if !jvm_args.iter().any(|a| a.starts_with("-Xms")) {
        jvm_args.insert(0, format!("-Xms{}G", min_gb));
    }
    if !jvm_args
        .iter()
        .any(|a| a.starts_with("-Djava.library.path="))
    {
        jvm_args.push(format!("-Djava.library.path={}", vars["natives_directory"]));
    }
    if !jvm_args.iter().any(|a| a == "-cp" || a == "-classpath") {
        jvm_args.push("-cp".to_string());
        jvm_args.push(vars["classpath"].to_string());
    }

    let mut game_args = if let Some(args) = &resolved.arguments {
        build_args_list(args.game.as_ref(), &vars, &features)
    } else if let Some(raw) = &resolved.minecraft_arguments {
        raw.split_whitespace()
            .filter_map(|s| normalize_arg(substitute_vars(s, &vars)))
            .collect()
    } else {
        Vec::new()
    };

    if settings.fullscreen && !game_args.iter().any(|a| a == "--fullscreen") {
        game_args.push("--fullscreen".to_string());
    }

    (jvm_args, game_args)
}

fn resolve_java_binary(
    settings: &GameSettings,
    required: Option<&JavaVersion>,
    base_dir: &PathBuf,
) -> Result<String, String> {
    let candidate = settings.java_path.trim();
    if candidate.is_empty() {
        if let Some(req) = required {
            if let Some(portable) = find_portable_java(base_dir, &req.component) {
                return Ok(portable.to_string_lossy().to_string());
            }
            if let Some(portable) = find_portable_java_for_major(base_dir, req.major_version) {
                return Ok(portable.to_string_lossy().to_string());
            }
            return Err(format!(
                "No se encontro Java portable compatible (requiere Java {}).",
                req.major_version
            ));
        }
        if let Some(portable) = find_best_portable_java(base_dir) {
            return Ok(portable.to_string_lossy().to_string());
        }
        if cfg!(windows) {
            return Ok("javaw".to_string());
        }
        return Ok("java".to_string());
    }
    let path = PathBuf::from(candidate);
    if path.exists() {
        return Ok(candidate.to_string());
    }
    Err("Ruta de Java invalida".to_string())
}

async fn ensure_java_runtime(
    app: &AppHandle,
    version_id: &str,
    required: Option<&JavaVersion>,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
    settings: &GameSettings,
) -> Result<(), String> {
    let base_dir = get_launcher_dir(app);
    let custom_path = settings.java_path.trim();
    if !custom_path.is_empty() {
        let path = PathBuf::from(custom_path);
        if path.exists() {
            if let Some(req) = required {
                if let Some(major) = detect_java_major_at_path(&path) {
                    if major >= req.major_version {
                        return Ok(());
                    }
                }
            } else {
                return Ok(());
            }
        }
    }

    if let Some(req) = required {
        if find_portable_java(&base_dir, &req.component).is_some()
            || find_portable_java_for_major(&base_dir, req.major_version).is_some()
        {
            return Ok(());
        }

        let base_version = extract_base_version(version_id);
        let _ =
            get_version_metadata_impl(app, base_version.clone(), manifest_cache, metadata_cache)
                .await?;
        let _ = download_java_impl(app, Some(base_version), manifest_cache, metadata_cache)
            .await
            .map_err(|e| format!("No se pudo descargar Java automaticamente: {}", e))?;

        if find_portable_java(&base_dir, &req.component).is_some()
            || find_portable_java_for_major(&base_dir, req.major_version).is_some()
        {
            return Ok(());
        }
        return Err("Java portable descargado pero no se encontro el ejecutable.".to_string());
    }
    if find_best_portable_java(&base_dir).is_some() {
        return Ok(());
    }
    Ok(())
}

struct ModScanResult {
    fabric_only: Vec<String>,
    forge_only: Vec<String>,
    neoforge_only: Vec<String>,
}

async fn detect_mod_loader_conflicts(
    game_dir: &PathBuf,
    is_forge: bool,
    is_neoforge: bool,
    is_fabric: bool,
) -> Result<(), String> {
    if !is_forge && !is_neoforge && !is_fabric {
        return Ok(());
    }
    let mods_dir = game_dir.join("mods");
    if !mods_dir.exists() {
        return Ok(());
    }

    let mods_dir_clone = mods_dir.clone();
    let scan = tokio::task::spawn_blocking(move || scan_mods_for_loader(&mods_dir_clone))
        .await
        .map_err(|e| e.to_string())??;

    // Forge: block Fabric-only and NeoForge-only jars.
    if is_forge && (!scan.fabric_only.is_empty() || !scan.neoforge_only.is_empty()) {
        let mut mixed = scan.fabric_only.clone();
        mixed.extend(scan.neoforge_only.clone());
        let sample = mixed.join(", ");
        return Err(format!(
            "Se detectaron mods incompatibles en una instancia Forge ({sample}). Mueve esos mods a una instancia compatible o eliminalos.",
        ));
    }

    // NeoForge: modpacks can include jars multi-loader, so only hard-block Fabric-only jars.
    if is_neoforge && !scan.fabric_only.is_empty() {
        let sample = scan.fabric_only.join(", ");
        return Err(format!(
            "Se detectaron mods Fabric en una instancia NeoForge ({sample}). Mueve esos mods a una instancia compatible o eliminalos.",
        ));
    }

    // Fabric: block Forge-only and NeoForge-only jars.
    if is_fabric && (!scan.forge_only.is_empty() || !scan.neoforge_only.is_empty()) {
        let mut mixed = scan.forge_only.clone();
        mixed.extend(scan.neoforge_only.clone());
        let sample = mixed.join(", ");
        return Err(format!(
            "Se detectaron mods incompatibles en una instancia Fabric ({sample}). Mueve esos mods a una instancia compatible o eliminalos.",
        ));
    }

    Ok(())
}

fn scan_mods_for_loader(mods_dir: &StdPathBuf) -> Result<ModScanResult, String> {
    let mut fabric_only = Vec::new();
    let mut forge_only = Vec::new();
    let mut neoforge_only = Vec::new();

    let entries = match fs::read_dir(mods_dir) {
        Ok(e) => e,
        Err(e) => return Err(e.to_string()),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        if ext != "jar" {
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("mod.jar")
            .to_string();

        let file = match fs::File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let mut archive = match zip::ZipArchive::new(file) {
            Ok(z) => z,
            Err(_) => continue,
        };

        let mut is_fabric = false;
        let mut has_forge_meta = false;
        let mut has_neoforge_meta = false;
        for i in 0..archive.len() {
            let name = match archive.by_index(i) {
                Ok(f) => f.name().to_string(),
                Err(_) => continue,
            };
            if name.eq_ignore_ascii_case("fabric.mod.json")
                || name.eq_ignore_ascii_case("quilt.mod.json")
            {
                is_fabric = true;
            }
            if name.eq_ignore_ascii_case("meta-inf/mods.toml") {
                has_forge_meta = true;
            }
            if name.eq_ignore_ascii_case("meta-inf/neoforge.mods.toml") {
                has_neoforge_meta = true;
            }
            if is_fabric && has_forge_meta && has_neoforge_meta {
                break;
            }
        }

        if is_fabric && !has_forge_meta && !has_neoforge_meta && fabric_only.len() < 4 {
            fabric_only.push(file_name.clone());
        }
        if has_forge_meta && !is_fabric && !has_neoforge_meta && forge_only.len() < 4 {
            forge_only.push(file_name.clone());
        }
        if has_neoforge_meta && !is_fabric && !has_forge_meta && neoforge_only.len() < 4 {
            neoforge_only.push(file_name);
        }
    }

    Ok(ModScanResult {
        fabric_only,
        forge_only,
        neoforge_only,
    })
}
// detect_system_java_major removed: launcher always prefers portable runtimes.

fn detect_java_major_at_path(path: &PathBuf) -> Option<u32> {
    let mut cmd = std::process::Command::new(path);
    cmd.arg("-version");
    hide_background_window(&mut cmd);
    let output = cmd.output().ok()?;
    let full = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    if let Some(start) = full.find("version \"") {
        let rest = &full[start + 9..];
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
            return Some(major);
        }
    }
    None
}

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

fn find_portable_java(base_dir: &PathBuf, component: &str) -> Option<PathBuf> {
    let (os_api, arch_api) = detect_os_adoptium();
    let root = base_dir
        .join("runtime")
        .join(component)
        .join(format!("{}-{}", os_api, arch_api));
    if !root.exists() {
        return None;
    }

    let is_windows = cfg!(windows);

    let mut stack = vec![root];
    let mut java_fallback: Option<PathBuf> = None;
    while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            let name = match path.file_name().and_then(|s| s.to_str()) {
                Some(n) => n,
                None => continue,
            };
            if is_windows {
                if name.eq_ignore_ascii_case("javaw.exe") {
                    return Some(path);
                }
                if name.eq_ignore_ascii_case("java.exe") && java_fallback.is_none() {
                    java_fallback = Some(path);
                }
            } else if name == "java" {
                return Some(path);
            }
        }
    }
    java_fallback
}

fn find_portable_java_for_major(base_dir: &PathBuf, required_major: u32) -> Option<PathBuf> {
    let runtime_root = base_dir.join("runtime");
    if !runtime_root.exists() {
        return None;
    }
    let mut candidates: Vec<(u32, PathBuf)> = Vec::new();
    let entries = fs::read_dir(&runtime_root).ok()?;
    for entry in entries.flatten() {
        let comp_path = entry.path();
        if !comp_path.is_dir() {
            continue;
        }
        let component = match comp_path.file_name().and_then(|s| s.to_str()) {
            Some(c) => c,
            None => continue,
        };
        let major = map_component_to_java_version(component);
        if major < required_major {
            continue;
        }
        if let Some(found) = find_portable_java(base_dir, component) {
            candidates.push((major, found));
        }
    }
    candidates.sort_by_key(|(m, _)| *m);
    candidates.first().map(|(_, p)| p.clone())
}

fn find_best_portable_java(base_dir: &PathBuf) -> Option<PathBuf> {
    let runtime_root = base_dir.join("runtime");
    if !runtime_root.exists() {
        return None;
    }
    let mut candidates: Vec<(u32, PathBuf)> = Vec::new();
    let entries = fs::read_dir(&runtime_root).ok()?;
    for entry in entries.flatten() {
        let comp_path = entry.path();
        if !comp_path.is_dir() {
            continue;
        }
        let component = match comp_path.file_name().and_then(|s| s.to_str()) {
            Some(c) => c,
            None => continue,
        };
        let major = map_component_to_java_version(component);
        if let Some(found) = find_portable_java(base_dir, component) {
            candidates.push((major, found));
        }
    }
    candidates.sort_by_key(|(m, _)| *m);
    candidates.last().map(|(_, p)| p.clone())
}

fn pick_highest_java_version(candidates: &[Option<JavaVersion>]) -> Option<JavaVersion> {
    let mut best: Option<JavaVersion> = None;
    for item in candidates {
        let Some(j) = item.clone() else { continue };
        let replace = match &best {
            None => true,
            Some(current) => j.major_version >= current.major_version,
        };
        if replace {
            best = Some(j);
        }
    }
    best
}

fn infer_java_version_from_mc(version_id: &str) -> Option<JavaVersion> {
    let base = version_id.split('-').next().unwrap_or(version_id);
    let parts: Vec<&str> = base.split('.').collect();
    let minor = parts
        .get(1)
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(0);
    if minor >= 21 {
        return Some(JavaVersion {
            component: "java-runtime-delta".to_string(),
            major_version: 21,
        });
    }
    if minor >= 18 {
        return Some(JavaVersion {
            component: "java-runtime-gamma".to_string(),
            major_version: 17,
        });
    }
    if minor == 17 {
        return Some(JavaVersion {
            component: "java-runtime-beta".to_string(),
            major_version: 16,
        });
    }
    Some(JavaVersion {
        component: "java-runtime-alpha".to_string(),
        major_version: 8,
    })
}

async fn apply_options_settings(
    game_dir: &PathBuf,
    settings: &GameSettings,
    skin_pack: Option<&str>,
) -> Result<(), String> {
    let options_path = game_dir.join("options.txt");
    let mut lines: Vec<String> = Vec::new();
    if let Ok(raw) = tokio_fs::read_to_string(&options_path).await {
        lines = raw.lines().map(|s| s.to_string()).collect();
    }

    let mut found_fps = false;
    let mut resource_idx: Option<usize> = None;
    let mut incompatible_idx: Option<usize> = None;
    let mut resource_list: Vec<String> = Vec::new();

    for (idx, line) in lines.iter_mut().enumerate() {
        if line.starts_with("maxFps:") {
            *line = format!("maxFps:{}", settings.max_fps);
            found_fps = true;
        }
        if let Some(rest) = line.strip_prefix("particles:") {
            let raw = rest.trim();
            let mapped = match raw {
                "all" => "0",
                "decreased" => "1",
                "minimal" => "2",
                _ => {
                    if raw.parse::<i32>().is_ok() {
                        raw
                    } else {
                        "1"
                    }
                }
            };
            *line = format!("particles:{}", mapped);
        }
        if let Some(rest) = line.strip_prefix("resourcePacks:") {
            resource_idx = Some(idx);
            if let Ok(parsed) = serde_json::from_str::<Vec<String>>(rest) {
                resource_list = parsed;
            }
        }
        if line.starts_with("incompatibleResourcePacks:") {
            incompatible_idx = Some(idx);
        }
    }
    if !found_fps {
        lines.push(format!("maxFps:{}", settings.max_fps));
    }

    let pack_id = "file/NewenOfflineSkin";
    if let Some(_pack) = skin_pack {
        if resource_list.is_empty() {
            resource_list = vec![pack_id.to_string(), "vanilla".to_string()];
        } else {
            resource_list.retain(|p| p != pack_id);
            resource_list.insert(0, pack_id.to_string());
            if !resource_list.iter().any(|p| p == "vanilla") {
                resource_list.push("vanilla".to_string());
            }
        }
    } else {
        resource_list.retain(|p| p != pack_id);
    }

    let serialized = serde_json::to_string(&resource_list).unwrap_or_else(|_| "[]".to_string());
    let line_value = format!("resourcePacks:{}", serialized);
    if let Some(idx) = resource_idx {
        lines[idx] = line_value;
    } else {
        lines.push(line_value);
    }
    if incompatible_idx.is_none() {
        lines.push("incompatibleResourcePacks:[]".to_string());
    }

    let text = lines.join("\n");
    tokio_fs::write(&options_path, text)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn prepare_offline_skin_pack(
    app: &AppHandle,
    game_dir: &PathBuf,
    version_id: &str,
    profile: &MinecraftProfile,
) -> Result<Option<String>, String> {
    if !profile.is_offline {
        return Ok(None);
    }
    let skins_dir = get_launcher_dir(app).join("skins");
    let skin_path = skins_dir.join("active.png");
    let cape_path = skins_dir.join("active_cape.png");
    if !skin_path.exists() {
        let pack_dir = game_dir.join("resourcepacks").join("NewenOfflineSkin");
        if pack_dir.exists() {
            let _ = tokio_fs::remove_dir_all(&pack_dir).await;
        }
        return Ok(None);
    }

    let pack_dir = game_dir.join("resourcepacks").join("NewenOfflineSkin");
    let textures_dir = pack_dir
        .join("assets")
        .join("minecraft")
        .join("textures")
        .join("entity");
    let player_dir = textures_dir.join("player");
    let wide_dir = player_dir.join("wide");
    let slim_dir = player_dir.join("slim");
    tokio_fs::create_dir_all(&wide_dir)
        .await
        .map_err(|e| e.to_string())?;
    tokio_fs::create_dir_all(&slim_dir)
        .await
        .map_err(|e| e.to_string())?;

    // Newer paths
    let _ = tokio_fs::copy(&skin_path, wide_dir.join("steve.png")).await;
    let _ = tokio_fs::copy(&skin_path, slim_dir.join("alex.png")).await;
    // Legacy paths (older versions)
    tokio_fs::create_dir_all(&textures_dir)
        .await
        .map_err(|e| e.to_string())?;
    let _ = tokio_fs::copy(&skin_path, textures_dir.join("steve.png")).await;
    let _ = tokio_fs::copy(&skin_path, textures_dir.join("alex.png")).await;

    // Cape (optional)
    let cape_dir = textures_dir.join("cape");
    if cape_path.exists() {
        let _ = tokio_fs::create_dir_all(&cape_dir).await;
        let _ = tokio_fs::copy(&cape_path, textures_dir.join("cape.png")).await;
        let _ = tokio_fs::copy(&cape_path, cape_dir.join("cape.png")).await;
    } else {
        let _ = tokio_fs::remove_file(textures_dir.join("cape.png")).await;
        let _ = tokio_fs::remove_file(cape_dir.join("cape.png")).await;
    }

    let pack_format = pack_format_for_version(version_id);
    let meta = format!(
        "{{\"pack\":{{\"pack_format\":{},\"description\":\"Newen Offline Skin\"}}}}",
        pack_format
    );
    tokio_fs::write(pack_dir.join("pack.mcmeta"), meta)
        .await
        .map_err(|e| e.to_string())?;

    let _ = tokio_fs::write(
        pack_dir.join("pack.png"),
        tokio_fs::read(&skin_path).await.unwrap_or_default(),
    )
    .await;

    Ok(Some("file/NewenOfflineSkin".to_string()))
}

fn pack_format_for_version(version_id: &str) -> i32 {
    let base = version_id.split('-').next().unwrap_or(version_id);
    let mut parts = base.split('.');
    let _major = parts
        .next()
        .and_then(|p| p.parse::<u32>().ok())
        .unwrap_or(1);
    let minor = parts
        .next()
        .and_then(|p| p.parse::<u32>().ok())
        .unwrap_or(0);
    let patch = parts
        .next()
        .and_then(|p| p.parse::<u32>().ok())
        .unwrap_or(0);

    if minor >= 20 {
        if patch >= 2 {
            18
        } else {
            15
        }
    } else if minor == 19 {
        if patch >= 4 {
            13
        } else if patch >= 3 {
            12
        } else {
            9
        }
    } else if minor == 18 {
        8
    } else {
        7
    }
}

fn normalize_arg(arg: String) -> Option<String> {
    let trimmed = arg.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut out = trimmed.to_string();
    if out.starts_with("-DFabricMcEmu=") {
        out = out.replace(' ', "");
    } else if out.starts_with("-D") {
        out = out.replace("= ", "=").replace(" =", "=");
    }
    Some(out)
}

fn build_args_list(
    args: Option<&Vec<VersionArgument>>,
    vars: &HashMap<String, String>,
    features: &HashMap<String, bool>,
) -> Vec<String> {
    let mut out = Vec::new();
    let list = match args {
        Some(a) => a,
        None => return out,
    };

    for arg in list {
        match arg {
            VersionArgument::Str(s) => {
                let value = substitute_vars(s, vars);
                if let Some(cleaned) = normalize_arg(value) {
                    out.push(cleaned);
                }
            }
            VersionArgument::Obj { rules, value } => {
                if rules_allow(rules.as_ref(), features) {
                    if let Some(v) = value {
                        for s in value_to_strings(v) {
                            let value = substitute_vars(&s, vars);
                            if let Some(cleaned) = normalize_arg(value) {
                                out.push(cleaned);
                            }
                        }
                    }
                }
            }
            VersionArgument::Any(v) => {
                for s in value_to_strings(v) {
                    let value = substitute_vars(&s, vars);
                    if let Some(cleaned) = normalize_arg(value) {
                        out.push(cleaned);
                    }
                }
            }
        }
    }
    out
}

fn rules_allow(rules: Option<&Vec<Rule>>, features: &HashMap<String, bool>) -> bool {
    let rules = match rules {
        Some(r) => r,
        None => return true,
    };
    let current_os = match std::env::consts::OS {
        "windows" => "windows",
        "macos" => "osx",
        "linux" => "linux",
        _ => "unknown",
    };

    let mut allow = false;
    for rule in rules {
        let mut applies = true;
        if let Some(os_rule) = &rule.os {
            applies = os_rule.name == current_os;
        }
        if let Some(feats) = &rule.features {
            for (k, v) in feats {
                if features.get(k).copied().unwrap_or(false) != *v {
                    applies = false;
                }
            }
        }
        if applies {
            allow = rule.action == "allow";
        }
    }
    allow
}

fn value_to_strings(v: &serde_json::Value) -> Vec<String> {
    match v {
        serde_json::Value::String(s) => vec![s.clone()],
        serde_json::Value::Array(arr) => arr
            .iter()
            .filter_map(|x| x.as_str().map(|s| s.to_string()))
            .collect(),
        _ => Vec::new(),
    }
}

fn substitute_vars(s: &str, vars: &HashMap<String, String>) -> String {
    let mut out = s.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("${{{}}}", k), v);
    }
    out
}

// Descargas concurrentes y verificadas viven en downloader.rs

fn open_launch_log(base_dir: &PathBuf) -> Result<(PathBuf, Stdio, Stdio), String> {
    let logs_dir = base_dir.join("logs");
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    let log_path = logs_dir.join("launcher-latest.log");
    let file = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let file_err = file.try_clone().map_err(|e| e.to_string())?;
    Ok((log_path, Stdio::from(file), Stdio::from(file_err)))
}

async fn ensure_disk_space(
    app: &AppHandle,
    preferred_dir: &Path,
    min_bytes: u64,
) -> Result<(), String> {
    let target = if preferred_dir.exists() {
        preferred_dir.to_path_buf()
    } else {
        get_launcher_dir(app)
    };

    let target_clone = target.clone();
    let free = tokio::task::spawn_blocking(move || -> Result<u64, String> {
        free_space_bytes(&target_clone)
    })
    .await
    .map_err(|e| e.to_string())??;

    if free < min_bytes {
        return Err(format!(
            "Espacio insuficiente. Disponible: {} MB, requerido: {} MB",
            free / (1024 * 1024),
            min_bytes / (1024 * 1024)
        ));
    }
    Ok(())
}

fn free_space_bytes(path: &Path) -> Result<u64, String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        let mut free_bytes: u64 = 0;
        let mut total_bytes: u64 = 0;
        let mut total_free: u64 = 0;
        let mut wide: Vec<u16> = OsStr::new(path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let ok = unsafe {
            windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
                wide.as_mut_ptr(),
                &mut free_bytes as *mut u64,
                &mut total_bytes as *mut u64,
                &mut total_free as *mut u64,
            )
        };
        if ok == 0 {
            return Err("No se pudo obtener espacio libre".to_string());
        }
        return Ok(free_bytes);
    }

    #[cfg(unix)]
    {
        use libc::statvfs;
        use std::ffi::CString;
        let c_path = CString::new(path.to_string_lossy().to_string()).map_err(|e| e.to_string())?;
        unsafe {
            let mut stat: statvfs = std::mem::zeroed();
            if statvfs(c_path.as_ptr(), &mut stat) != 0 {
                return Err("No se pudo obtener espacio libre".to_string());
            }
            let free = stat.f_bavail as u64 * stat.f_bsize as u64;
            return Ok(free);
        }
    }

    #[cfg(not(any(unix, target_os = "windows")))]
    {
        let _ = path;
        Err("No se pudo obtener espacio libre".to_string())
    }
}

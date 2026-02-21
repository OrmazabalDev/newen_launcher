use crate::content::upsert_mod_metadata;
use crate::downloader::{
    download_client_impl, download_file_checked, download_game_files_impl, fetch_text_with_cache,
    get_version_metadata_impl,
};
use crate::fabric::install_fabric_impl;
use crate::forge::install_forge_impl;
use crate::instances::{create_instance_impl, get_instance_impl, refresh_instance_mods_cache};
use crate::models::{
    Instance, InstanceCreateRequest, InstanceSummary, ModMetadataEntry, ModrinthPackIndex, ModrinthProject,
    ModrinthSearchResponse, ModrinthVersion, ProgressPayload, VersionManifest, VersionMetadata,
};
use crate::neoforge::install_neoforge_impl;
use crate::optimization::apply_options_profile;
use crate::repair::repair_instance_impl;
use crate::utils::append_action_log;
use crate::utils::get_launcher_dir;
use crate::worlds::world_datapacks_dir;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use futures_util::{stream, StreamExt};
use reqwest::Url;
use serde::de::DeserializeOwned;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;
use zip::ZipArchive;
use zip::write::FileOptions;

const MODPACK_CONCURRENCY: usize = 8;

fn instance_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    get_launcher_dir(app).join("instances").join(instance_id)
}

fn instance_mods_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    instance_dir(app, instance_id).join("mods")
}

fn instance_resourcepacks_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    instance_dir(app, instance_id).join("resourcepacks")
}

fn instance_shaderpacks_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    instance_dir(app, instance_id).join("shaderpacks")
}

fn modpack_exports_dir(app: &AppHandle) -> PathBuf {
    get_launcher_dir(app).join("exports").join("modpacks")
}

fn resolve_export_path(
    app: &AppHandle,
    inst: &Instance,
    dest_path: Option<String>,
) -> Result<PathBuf, String> {
    let safe_name = sanitize_pack_name(&inst.name);
    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    if let Some(path) = dest_path {
        let mut target = PathBuf::from(path);
        if target.exists() && target.is_dir() {
            target = target.join(format!("{}_{}.mrpack", safe_name, ts));
        } else if target
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            != Some("mrpack".to_string())
        {
            target.set_extension("mrpack");
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        return Ok(target);
    }

    let export_dir = modpack_exports_dir(app);
    std::fs::create_dir_all(&export_dir).map_err(|e| e.to_string())?;
    Ok(export_dir.join(format!("{}_{}.mrpack", safe_name, ts)))
}

fn sanitize_pack_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "modpack".to_string();
    }
    trimmed
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect()
}

fn extract_base_version(version_id: &str) -> String {
    if let Some((base, _)) = version_id.split_once("-forge-") {
        return base.to_string();
    }
    if let Some((base, _)) = version_id.split_once("-neoforge-") {
        return base.to_string();
    }
    if let Some(raw) = version_id.strip_prefix("neoforge-") {
        let parts: Vec<&str> = raw.split('.').collect();
        let minor = parts.get(0).and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
        let patch = parts.get(1).and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
        if minor > 0 {
            return if patch > 0 {
                format!("1.{}.{}", minor, patch)
            } else {
                format!("1.{}", minor)
            };
        }
    }
    if version_id.starts_with("fabric-loader-") {
        let parts: Vec<&str> = version_id.split('-').collect();
        return parts.last().unwrap_or(&version_id).to_string();
    }
    version_id.to_string()
}

fn parse_loader_version(inst: &Instance) -> (String, HashMap<String, String>) {
    let mut deps = HashMap::new();
    let mc_version = extract_base_version(&inst.version);
    deps.insert("minecraft".to_string(), mc_version.clone());
    match inst.loader.as_str() {
        "fabric" => {
            if inst.version.starts_with("fabric-loader-") {
                let parts: Vec<&str> = inst.version.split('-').collect();
                if parts.len() >= 3 {
                    let loader_version = parts[2].to_string();
                    deps.insert("fabric-loader".to_string(), loader_version);
                }
            }
        }
        "forge" => {
            if let Some((_, forge_version)) = inst.version.split_once("-forge-") {
                deps.insert("forge".to_string(), forge_version.to_string());
            }
        }
        "neoforge" => {
            if let Some((_, neo_version)) = inst.version.split_once("-neoforge-") {
                deps.insert("neoforge".to_string(), neo_version.to_string());
            }
        }
        _ => {}
    }
    (mc_version, deps)
}

fn should_skip_override(rel: &Path) -> bool {
    let mut components = rel.components();
    let first = match components.next() {
        Some(c) => c.as_os_str().to_string_lossy().to_string(),
        None => return true,
    };
    matches!(
        first.as_str(),
        "logs"
            | "crash-reports"
            | "saves"
            | "backups"
            | ".launcher"
            | "screenshots"
            | "cache"
    )
}

fn add_overrides_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    base: &Path,
    dir: &Path,
    options: FileOptions,
) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let rel = path.strip_prefix(base).map_err(|e| e.to_string())?;
        if rel.as_os_str().is_empty() {
            continue;
        }
        if should_skip_override(rel) {
            continue;
        }
        if path.is_dir() {
            add_overrides_to_zip(zip, base, &path, options)?;
            continue;
        }
        if rel.file_name().and_then(|s| s.to_str()) == Some("mods.cache.json") {
            continue;
        }
        let rel_name = rel.to_string_lossy().replace('\\', "/");
        let zip_name = format!("overrides/{}", rel_name);
        zip.start_file(zip_name, options)
            .map_err(|e| e.to_string())?;
        let mut f = std::fs::File::open(&path).map_err(|e| e.to_string())?;
        std::io::copy(&mut f, zip).map_err(|e| e.to_string())?;
    }
    Ok(())
}

async fn fetch_json_cached<T: DeserializeOwned>(app: &AppHandle, url: &str) -> Result<T, String> {
    let text = fetch_text_with_cache(app, url, None, false).await?;
    serde_json::from_str::<T>(&text).map_err(|e| {
        let preview: String = text.chars().take(200).collect();
        format!("JSON invalido: {} ({})", e, preview)
    })
}

fn pick_primary_file(version: &ModrinthVersion) -> Option<(&str, &str, u64, Option<&str>)> {
    if version.files.is_empty() {
        return None;
    }
    let file = version
        .files
        .iter()
        .find(|f| f.primary)
        .unwrap_or(&version.files[0]);
    let sha1 = file.hashes.get("sha1").map(|s| s.as_str());
    Some((file.url.as_str(), file.filename.as_str(), file.size, sha1))
}

async fn download_modpack_file(
    app: &AppHandle,
    version: &ModrinthVersion,
) -> Result<PathBuf, String> {
    let (url, filename, size, sha1) =
        pick_primary_file(version).ok_or("No hay archivo de modpack".to_string())?;
    let cache_dir = get_launcher_dir(app).join("cache").join("modpacks");
    tokio_fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let safe_name = if filename.ends_with(".mrpack") {
        filename.to_string()
    } else {
        format!("{}.mrpack", version.id)
    };
    let pack_path = cache_dir.join(safe_name);
    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Descargando modpack...".to_string(),
            percent: 5.0,
        },
    );
    download_file_checked(url, &pack_path, size, sha1).await?;
    Ok(pack_path)
}

fn parse_pack_index(raw: &str) -> Result<ModrinthPackIndex, String> {
    let trimmed = raw.trim_start_matches('\u{feff}').trim();
    if trimmed.is_empty() {
        return Err("modrinth.index.json esta vacio".to_string());
    }
    serde_json::from_str(trimmed).map_err(|e| {
        let preview: String = trimmed.chars().take(120).collect();
        format!("Error parseando modrinth.index.json: {} ({})", e, preview)
    })
}

fn zip_read_index(pack_path: &Path) -> Result<ModrinthPackIndex, String> {
    let file = std::fs::File::open(pack_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().replace('\\', "/");
        if name == "modrinth.index.json" {
            let mut data = String::new();
            entry.read_to_string(&mut data).map_err(|e| e.to_string())?;
            return parse_pack_index(&data);
        }
    }
    Err("modrinth.index.json no encontrado".to_string())
}

async fn install_modpack_from_pack(
    app: &AppHandle,
    instance_id: &str,
    pack_path: &Path,
) -> Result<usize, String> {
    let base = instance_dir(app, instance_id);
    tokio_fs::create_dir_all(&base)
        .await
        .map_err(|e| e.to_string())?;

    let base_clone = base.clone();
    let pack_path_clone = pack_path.to_path_buf();
    let index =
        tokio::task::spawn_blocking(move || zip_extract_overrides(&pack_path_clone, &base_clone))
            .await
            .map_err(|e| e.to_string())??;

    let mut specs: Vec<(String, PathBuf, u64, Option<String>)> = Vec::new();
    for entry in index.files {
        if entry.path.contains("..") || entry.path.starts_with('/') || entry.path.starts_with('\\')
        {
            return Err("Ruta invalida en modpack".to_string());
        }
        if let Some(env) = &entry.env {
            if let Some(client) = &env.client {
                if client == "unsupported" {
                    continue;
                }
            }
        }
        if entry.downloads.is_empty() {
            continue;
        }
        let url = entry.downloads[0].clone();
        let sha1 = entry.hashes.get("sha1").map(|s| s.to_string());
        let dest = base.join(&entry.path);
        specs.push((url, dest, entry.file_size, sha1));
    }

    if specs.is_empty() {
        let _ = app.emit(
            "download-progress",
            ProgressPayload {
                task: "Modpack listo".to_string(),
                percent: 100.0,
            },
        );
        return Ok(0);
    }

    let total = specs.len();
    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: format!("Instalando modpack 0/{}", total),
            percent: 10.0,
        },
    );

    let mut stream = stream::iter(specs.into_iter().map(|(url, dest, size, sha1)| async move {
        download_file_checked(&url, &dest, size, sha1.as_deref()).await
    }))
    .buffer_unordered(MODPACK_CONCURRENCY);

    let mut installed = 0usize;
    while let Some(res) = stream.next().await {
        res?;
        installed += 1;
        let pct = 10.0 + (installed as f64 / total as f64) * 90.0;
        let _ = app.emit(
            "download-progress",
            ProgressPayload {
                task: format!("Instalando modpack {}/{}", installed, total),
                percent: pct.min(100.0),
            },
        );
    }

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Modpack listo".to_string(),
            percent: 100.0,
        },
    );
    Ok(installed)
}

fn zip_extract_overrides(
    pack_path: &Path,
    instance_base: &Path,
) -> Result<ModrinthPackIndex, String> {
    let file = std::fs::File::open(pack_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut index_raw = None;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().replace('\\', "/");
        if name == "modrinth.index.json" {
            let mut data = String::new();
            entry.read_to_string(&mut data).map_err(|e| e.to_string())?;
            index_raw = Some(data);
            continue;
        }

        let rel = if let Some(rest) = name.strip_prefix("overrides/") {
            rest
        } else if let Some(rest) = name.strip_prefix("client-overrides/") {
            rest
        } else {
            continue;
        };

        if rel.is_empty() || rel.contains("..") || rel.starts_with('/') || rel.starts_with('\\') {
            continue;
        }

        let dest = instance_base.join(rel);
        if entry.is_dir() {
            std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        }
    }

    let raw = index_raw.ok_or("modrinth.index.json no encontrado".to_string())?;
    parse_pack_index(&raw)
}

async fn install_modpack(
    app: &AppHandle,
    instance_id: &str,
    version: &ModrinthVersion,
    loader: Option<&str>,
) -> Result<usize, String> {
    let pack_path = download_modpack_file(app, version).await?;
    let pack_path_clone = pack_path.clone();
    let index = tokio::task::spawn_blocking(move || zip_read_index(&pack_path_clone))
        .await
        .map_err(|e| e.to_string())??;

    if let Some(l) = loader {
        let requires_forge = index.dependencies.contains_key("forge");
        let requires_neoforge = index.dependencies.contains_key("neoforge");
        let requires_fabric = index.dependencies.contains_key("fabric-loader");
        if requires_forge && l != "forge" {
            return Err("Este modpack requiere Forge.".to_string());
        }
        if requires_neoforge && l != "neoforge" {
            return Err("Este modpack requiere NeoForge.".to_string());
        }
        if requires_fabric && l != "fabric" {
            return Err("Este modpack requiere Fabric.".to_string());
        }
    }

    install_modpack_from_pack(app, instance_id, &pack_path).await
}

async fn install_simple_pack(
    app: &AppHandle,
    instance_id: &str,
    version: &ModrinthVersion,
    kind: &str,
) -> Result<usize, String> {
    let (url, filename, size, sha1) =
        pick_primary_file(version).ok_or("No hay archivo para instalar".to_string())?;
    let dest_dir = match kind {
        "resourcepack" => instance_resourcepacks_dir(app, instance_id),
        "shader" => instance_shaderpacks_dir(app, instance_id),
        _ => instance_mods_dir(app, instance_id),
    };
    tokio_fs::create_dir_all(&dest_dir)
        .await
        .map_err(|e| e.to_string())?;
    let dest = dest_dir.join(filename);
    download_file_checked(url, &dest, size, sha1).await?;
    Ok(1)
}

pub async fn modrinth_search_impl(
    app: &AppHandle,
    query: String,
    limit: Option<u32>,
    offset: Option<u32>,
    loader: Option<String>,
    game_version: Option<String>,
    index: Option<String>,
    project_type: Option<String>,
    categories: Option<Vec<String>>,
) -> Result<ModrinthSearchResponse, String> {
    let safe_query = if query.trim().is_empty() {
        "*".to_string()
    } else {
        query
    };
    let project_type = match project_type {
        Some(p) if !p.trim().is_empty() => p,
        _ => "mod".to_string(),
    };
    let mut facets: Vec<Vec<String>> = vec![vec![format!("project_type:{}", project_type)]];
    if let Some(v) = game_version {
        if !v.trim().is_empty() {
            facets.push(vec![format!("versions:{}", v)]);
        }
    }
    if project_type == "mod" {
        if let Some(l) = loader {
            if !l.trim().is_empty() {
                facets.push(vec![format!("categories:{}", l)]);
            }
        }
    }
    if let Some(list) = categories {
        let mapped: Vec<String> = list
            .into_iter()
            .filter(|c| !c.trim().is_empty())
            .map(|c| format!("categories:{}", c))
            .collect();
        if !mapped.is_empty() {
            facets.push(mapped);
        }
    }
    let facets_json = serde_json::to_string(&facets).map_err(|e| e.to_string())?;

    let mut params = vec![
        ("query", safe_query),
        ("facets", facets_json),
        ("index", index.unwrap_or_else(|| "downloads".to_string())),
    ];
    if let Some(l) = limit {
        params.push(("limit", l.to_string()));
    }
    if let Some(o) = offset {
        params.push(("offset", o.to_string()));
    }

    let url = Url::parse_with_params("https://api.modrinth.com/v2/search", &params)
        .map_err(|e| e.to_string())?;
    fetch_json_cached::<ModrinthSearchResponse>(app, url.as_str()).await
}

pub async fn modrinth_list_versions_impl(
    app: &AppHandle,
    project_id: String,
    loader: Option<String>,
    game_version: Option<String>,
) -> Result<Vec<ModrinthVersion>, String> {
    let mut params: Vec<(String, String)> = Vec::new();
    if let Some(l) = loader {
        params.push(("loaders".to_string(), format!("[\"{}\"]", l)));
    }
    if let Some(v) = game_version {
        params.push(("game_versions".to_string(), format!("[\"{}\"]", v)));
    }

    let url = if params.is_empty() {
        Url::parse(&format!(
            "https://api.modrinth.com/v2/project/{}/version",
            project_id
        ))
        .map_err(|e| e.to_string())?
    } else {
        Url::parse_with_params(
            &format!("https://api.modrinth.com/v2/project/{}/version", project_id),
            params,
        )
        .map_err(|e| e.to_string())?
    };

    fetch_json_cached::<Vec<ModrinthVersion>>(app, url.as_str()).await
}

pub async fn modrinth_get_project_impl(
    app: &AppHandle,
    project_id: String,
) -> Result<ModrinthProject, String> {
    let url = format!("https://api.modrinth.com/v2/project/{}", project_id);
    fetch_json_cached::<ModrinthProject>(app, &url).await
}

async fn modrinth_get_version(
    app: &AppHandle,
    version_id: &str,
) -> Result<ModrinthVersion, String> {
    let url = format!("https://api.modrinth.com/v2/version/{}", version_id);
    fetch_json_cached::<ModrinthVersion>(app, &url).await
}

async fn get_version_cached(
    app: &AppHandle,
    cache: &mut HashMap<String, ModrinthVersion>,
    version_id: &str,
) -> Result<ModrinthVersion, String> {
    if let Some(v) = cache.get(version_id) {
        return Ok(v.clone());
    }
    let v = modrinth_get_version(app, version_id).await?;
    cache.insert(version_id.to_string(), v.clone());
    Ok(v)
}

async fn install_version_with_deps(
    app: &AppHandle,
    instance_id: &str,
    root_version_id: &str,
    loader: Option<&str>,
    game_version: Option<&str>,
) -> Result<usize, String> {
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
                .map_err(|e| e.to_string())?;
            if let Some((url, filename, size, sha1)) = pick_primary_file(&version) {
                let dest = mods_dir.join(filename);
                download_file_checked(url, &dest, size, sha1).await?;
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

pub async fn modrinth_install_version_impl(
    app: &AppHandle,
    instance_id: String,
    version_id: String,
    loader: Option<String>,
    game_version: Option<String>,
    project_type: Option<String>,
) -> Result<String, String> {
    let base = instance_dir(app, &instance_id);
    if !base.exists() {
        return Err("La instancia no existe".to_string());
    }

    let project_type = project_type.unwrap_or_else(|| "mod".to_string());
    if project_type == "datapack" {
        return Err("Los Data Packs requieren un mundo. Próximamente.".to_string());
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
            &format!(
                "resourcepack_install instance={} version={}",
                instance_id, version_id
            ),
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
            &format!(
                "shader_install instance={} version={}",
                instance_id, version_id
            ),
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
        &format!(
            "mod_install instance={} version={}",
            instance_id, version_id
        ),
    )
    .await;
    Ok(format!("Instalados {} mods/dependencias", installed))
}

pub async fn modrinth_install_datapack_impl(
    app: &AppHandle,
    instance_id: String,
    world_id: String,
    version_id: String,
) -> Result<String, String> {
    let base = instance_dir(app, &instance_id);
    if !base.exists() {
        return Err("La instancia no existe".to_string());
    }

    let world_dir = base.join("saves").join(&world_id);
    if !world_dir.exists() {
        return Err("El mundo no existe".to_string());
    }

    let version = modrinth_get_version(app, &version_id).await?;
    let (url, filename, size, sha1) =
        pick_primary_file(&version).ok_or("No hay archivo para instalar".to_string())?;

    let dest_dir = world_datapacks_dir(app, &instance_id, &world_id);
    tokio_fs::create_dir_all(&dest_dir)
        .await
        .map_err(|e| e.to_string())?;
    let dest = dest_dir.join(filename);
    download_file_checked(url, &dest, size, sha1).await?;

    let _ = append_action_log(
        app,
        &format!(
            "datapack_install instance={} world={} version={}",
            instance_id, world_id, version_id
        ),
    )
    .await;

    Ok(format!("Datapack instalado ({})", filename))
}

pub async fn modrinth_install_modpack_impl(
    app: &AppHandle,
    version_id: String,
    name: String,
    thumbnail: Option<String>,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> Result<InstanceSummary, String> {
    let version = modrinth_get_version(app, &version_id)
        .await
        .map_err(|e| format!("Version Modrinth: {}", e))?;
    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Preparando modpack...".to_string(),
            percent: 0.0,
        },
    );
    let pack_path = download_modpack_file(app, &version)
        .await
        .map_err(|e| format!("Descarga del modpack: {}", e))?;
    let pack_path_clone = pack_path.clone();
    let index = tokio::task::spawn_blocking(move || zip_read_index(&pack_path_clone))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("Lectura del modpack: {}", e))?;

    let mc_version = index
        .dependencies
        .get("minecraft")
        .cloned()
        .ok_or("El modpack no indica version de Minecraft".to_string())?;

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
        .map_err(|e| format!("Instalar NeoForge: {}", e))?
    } else if loader == "forge" {
        install_forge_impl(
            app,
            mc_version.clone(),
            forge_dep.clone(),
            manifest_cache,
            metadata_cache,
        )
        .await
        .map_err(|e| format!("Instalar Forge: {}", e))?
    } else if loader == "fabric" {
        install_fabric_impl(
            app,
            mc_version.clone(),
            fabric_dep.clone(),
            manifest_cache,
            metadata_cache,
        )
        .await
        .map_err(|e| format!("Instalar Fabric: {}", e))?
    } else {
        get_version_metadata_impl(app, mc_version.clone(), manifest_cache, metadata_cache)
            .await
            .map_err(|e| format!("Metadata Minecraft: {}", e))?;
        download_client_impl(app, mc_version.clone(), metadata_cache)
            .await
            .map_err(|e| format!("Descargar cliente: {}", e))?;
        download_game_files_impl(app, mc_version.clone(), metadata_cache)
            .await
            .map_err(|e| format!("Descargar assets: {}", e))?;
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
        .map_err(|e| format!("Crear instancia: {}", e))?;
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
        return Err(format!(
            "Instalar archivos del modpack: {}. {}",
            err, repair_msg
        ));
    }
    let _ = append_action_log(
        app,
        &format!(
            "modpack_install instance={} version={}",
            created.id, version_id
        ),
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
) -> Result<InstanceSummary, String> {
    let original_name = file_name.clone();
    let bytes = BASE64_STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("El archivo esta vacio".to_string());
    }
    let cache_dir = get_launcher_dir(app).join("cache").join("modpacks");
    tokio_fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;
    let safe_name = if file_name.ends_with(".mrpack") {
        file_name.clone()
    } else {
        format!("{}.mrpack", file_name.trim_end_matches(".zip"))
    };
    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let pack_path = cache_dir.join(format!("import_{}_{}", ts, safe_name));
    tokio_fs::write(&pack_path, bytes)
        .await
        .map_err(|e| e.to_string())?;

    let pack_path_clone = pack_path.clone();
    let index = tokio::task::spawn_blocking(move || zip_read_index(&pack_path_clone))
        .await
        .map_err(|e| e.to_string())??;

    let mc_version = index
        .dependencies
        .get("minecraft")
        .cloned()
        .ok_or("El modpack no indica version de Minecraft".to_string())?;

    let forge_dep = index.dependencies.get("forge").cloned();
    let neoforge_dep = index.dependencies.get("neoforge").cloned();
    let fabric_dep = index
        .dependencies
        .get("fabric-loader")
        .cloned()
        .or_else(|| index.dependencies.get("quilt-loader").cloned());

    if index.dependencies.contains_key("quilt-loader") {
        return Err("Quilt no esta soportado aun".to_string());
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
        .map_err(|e| format!("Instalar NeoForge: {}", e))?
    } else if loader == "forge" {
        install_forge_impl(
            app,
            mc_version.clone(),
            forge_dep.clone(),
            manifest_cache,
            metadata_cache,
        )
        .await
        .map_err(|e| format!("Instalar Forge: {}", e))?
    } else if loader == "fabric" {
        install_fabric_impl(
            app,
            mc_version.clone(),
            fabric_dep.clone(),
            manifest_cache,
            metadata_cache,
        )
        .await
        .map_err(|e| format!("Instalar Fabric: {}", e))?
    } else {
        get_version_metadata_impl(app, mc_version.clone(), manifest_cache, metadata_cache)
            .await
            .map_err(|e| format!("Metadata Minecraft: {}", e))?;
        download_client_impl(app, mc_version.clone(), metadata_cache)
            .await
            .map_err(|e| format!("Descargar cliente: {}", e))?;
        download_game_files_impl(app, mc_version.clone(), metadata_cache)
            .await
            .map_err(|e| format!("Descargar assets: {}", e))?;
        mc_version.clone()
    };

    let instance_name = name
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| {
            original_name
                .trim_end_matches(".mrpack")
                .trim_end_matches(".zip")
                .to_string()
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
        .map_err(|e| format!("Crear instancia: {}", e))?;

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
        return Err(format!("Instalar archivos del modpack: {}. {}", err, repair_msg));
    }

    let _ = refresh_instance_mods_cache(app, &created.id).await;
    let _ = append_action_log(
        app,
        &format!("modpack_import instance={} file={}", created.id, safe_name),
    )
    .await;
    Ok(created)
}

pub async fn export_modpack_mrpack_impl(
    app: &AppHandle,
    instance_id: String,
    dest_path: Option<String>,
) -> Result<String, String> {
    let inst = get_instance_impl(app, &instance_id).await?;
    let instance_dir = instance_dir(app, &instance_id);
    if !instance_dir.exists() {
        return Err("La instancia no existe".to_string());
    }

    let (_mc_version, deps) = parse_loader_version(&inst);
    let index_json = json!({
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": inst.id,
        "name": inst.name,
        "summary": "Exportado desde Newen Launcher",
        "files": [],
        "dependencies": deps,
    });

    let zip_path = resolve_export_path(app, &inst, dest_path)?;

    let file = std::fs::File::create(&zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let index_raw = serde_json::to_vec_pretty(&index_json).map_err(|e| e.to_string())?;
    zip.start_file("modrinth.index.json", options)
        .map_err(|e| e.to_string())?;
    std::io::Write::write_all(&mut zip, &index_raw).map_err(|e| e.to_string())?;

    add_overrides_to_zip(&mut zip, &instance_dir, &instance_dir, options)?;

    zip.finish().map_err(|e| e.to_string())?;
    let _ = append_action_log(
        app,
        &format!("modpack_export instance={} path={}", instance_id, zip_path.to_string_lossy()),
    )
    .await;
    Ok(zip_path.to_string_lossy().to_string())
}

fn optimization_mods(loader: &str, game_version: &str) -> Vec<&'static str> {
    match loader {
        "fabric" => vec![
            "sodium",
            "lithium",
            "starlight",
            "ferrite-core",
            "entityculling",
        ],
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
    // More robust fallback order for rare versions.
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
    installed
        .iter()
        .any(|p| p == "embeddium" || p == "rubidium" || p == "magnesium")
}

fn detect_mod_conflicts(mods_dir: &Path) -> Vec<String> {
    if !mods_dir.exists() {
        return Vec::new();
    }
    let mut conflicts = Vec::new();
    let entries = match std::fs::read_dir(mods_dir) {
        Ok(e) => e,
        Err(_) => return conflicts,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
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
) -> Result<String, String> {
    let base = instance_dir(app, &instance_id);
    if !base.exists() {
        return Err("La instancia no existe".to_string());
    }
    let inst = get_instance_impl(app, &instance_id).await?;
    if inst.tags.iter().any(|t| t == "modpack") {
        return Err("No se puede aplicar optimizacion a modpacks.".to_string());
    }
    let mods_dir = instance_mods_dir(app, &instance_id);
    let conflicts = detect_mod_conflicts(&mods_dir);
    if !conflicts.is_empty() {
        return Err(format!(
            "Se detectaron mods incompatibles con la optimizacion: {}. Elimina esos mods y vuelve a intentar.",
            conflicts.join(", ")
        ));
    }

    let list = optimization_mods(&loader, &game_version);
    if list.is_empty() {
        return Err("El loader no es compatible con optimizaciones automáticas".to_string());
    }
    if game_version.trim().is_empty() {
        return Err("La versión de Minecraft es inválida.".to_string());
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
            return Err(format!(
                "No se encontraron versiones compatibles en Modrinth para: {}. Verifica loader/version o intenta mas tarde.",
                missing_projects.join(", ")
            ));
        }
        return Err(
            "No se instalaron mods nuevos. Si ya estaban instalados, esta instancia ya esta optimizada. Si no, revisa la version o el loader."
                .to_string(),
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
            render_mod_used
                .clone()
                .unwrap_or_else(|| "none".to_string())
        ),
    )
    .await;

    Ok(format!(
        "Optimizacion aplicada: {} mods instalados",
        installed
    ))
}

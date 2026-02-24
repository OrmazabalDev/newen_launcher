use crate::downloader::{download_java_impl, get_version_metadata_impl};
use crate::error::AppResult;
use crate::models::{GameSettings, JavaVersion, VersionManifest, VersionMetadata};
use crate::utils::{
    detect_os_adoptium, get_launcher_dir, hide_background_window, map_component_to_java_version,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::AppHandle;

use super::version::{extract_base_version, ResolvedVersion};

pub(crate) async fn resolve_required_java_version(
    app: &AppHandle,
    version_id: &str,
    resolved: &ResolvedVersion,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> AppResult<Option<JavaVersion>> {
    let base_version = extract_base_version(version_id);
    let _ = get_version_metadata_impl(app, base_version.clone(), manifest_cache, metadata_cache)
        .await?;
    let cache = metadata_cache.lock().map_err(|_| "Error cache".to_string())?;
    let meta_java = cache.as_ref().and_then(|m| m.java_version.clone());
    let inferred = infer_java_version_from_mc(&base_version);
    Ok(pick_highest_java_version(&[resolved.java_version.clone(), meta_java, inferred]))
}

pub(crate) fn resolve_java_binary(
    settings: &GameSettings,
    required: Option<&JavaVersion>,
    base_dir: &Path,
) -> AppResult<String> {
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
            )
            .into());
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
    Err("Ruta de Java invalida".to_string().into())
}

pub(crate) async fn ensure_java_runtime(
    app: &AppHandle,
    version_id: &str,
    required: Option<&JavaVersion>,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
    settings: &GameSettings,
) -> AppResult<()> {
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
            .map_err(|e| {
            crate::error::AppError::Message(format!(
                "No se pudo descargar Java automaticamente: {}",
                e
            ))
        })?;

        if find_portable_java(&base_dir, &req.component).is_some()
            || find_portable_java_for_major(&base_dir, req.major_version).is_some()
        {
            return Ok(());
        }
        return Err("Java portable descargado pero no se encontro el ejecutable."
            .to_string()
            .into());
    }
    if find_best_portable_java(&base_dir).is_some() {
        return Ok(());
    }
    Ok(())
}

fn detect_java_major_at_path(path: &Path) -> Option<u32> {
    let mut cmd = Command::new(path);
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
                version_str.split('.').nth(1).unwrap_or("0").parse().unwrap_or(0)
            } else {
                version_str.split('.').next().unwrap_or("0").parse().unwrap_or(0)
            };
            return Some(major);
        }
    }
    None
}

fn find_portable_java(base_dir: &Path, component: &str) -> Option<PathBuf> {
    let (os_api, arch_api) = detect_os_adoptium();
    let root = base_dir.join("runtime").join(component).join(format!("{}-{}", os_api, arch_api));
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

fn find_portable_java_for_major(base_dir: &Path, required_major: u32) -> Option<PathBuf> {
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

fn find_best_portable_java(base_dir: &Path) -> Option<PathBuf> {
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
    let minor = parts.get(1).and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
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
        return Some(JavaVersion { component: "java-runtime-beta".to_string(), major_version: 16 });
    }
    Some(JavaVersion { component: "java-runtime-alpha".to_string(), major_version: 8 })
}

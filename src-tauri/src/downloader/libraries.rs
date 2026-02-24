use super::download::{should_download_file, DownloadSpec};
use super::versions::load_version_json_from_disk;
use crate::error::AppResult;
use crate::models::{Library, ProgressPayload};
use crate::utils::{
    get_launcher_dir, library_artifact_url, maven_artifact_path, should_download_lib,
};
use std::collections::HashSet;
use std::path::Path;
use tauri::{AppHandle, Emitter};

pub(crate) async fn build_library_specs(
    libraries: &[Library],
    lib_dir: &Path,
) -> AppResult<Vec<DownloadSpec>> {
    let os_key = match std::env::consts::OS {
        "windows" => "windows",
        "linux" => "linux",
        "macos" => "osx",
        _ => "err",
    };
    let mut specs = Vec::new();

    for lib in libraries {
        if !should_download_lib(lib) {
            continue;
        }
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                if !artifact.url.is_empty() {
                    let path = lib_dir.join(&artifact.path);
                    if should_download_file(&path, Some(artifact.size), Some(&artifact.sha1), true)
                        .await?
                    {
                        specs.push(DownloadSpec {
                            url: artifact.url.clone(),
                            path,
                            sha1: Some(artifact.sha1.clone()),
                            size: Some(artifact.size),
                        });
                    }
                }
            }
            if let Some(classifiers) = &downloads.classifiers {
                for (key, artifact) in classifiers {
                    if !key.contains(os_key) || artifact.url.is_empty() {
                        continue;
                    }
                    let path = lib_dir.join(&artifact.path);
                    if should_download_file(&path, Some(artifact.size), Some(&artifact.sha1), true)
                        .await?
                    {
                        specs.push(DownloadSpec {
                            url: artifact.url.clone(),
                            path,
                            sha1: Some(artifact.sha1.clone()),
                            size: Some(artifact.size),
                        });
                    }
                }
            }
        }
        if lib.downloads.is_none() {
            if let Some(path) = maven_artifact_path(&lib.name) {
                if let Some(url) = library_artifact_url(lib) {
                    let path = lib_dir.join(&path);
                    let sha1 = lib.sha1.clone();
                    let size = lib.size;
                    if should_download_file(&path, size, sha1.as_deref(), true).await? {
                        specs.push(DownloadSpec { url, path, sha1, size });
                    }
                }
            }
        }
    }

    Ok(specs)
}

pub async fn download_libraries_concurrent(libraries: &[Library], lib_dir: &Path) -> AppResult<()> {
    let specs = build_library_specs(libraries, lib_dir).await?;
    super::download_specs_concurrent(
        None,
        specs,
        super::LIB_CONCURRENCY,
        "Librerias",
        0.0,
        100.0,
        10,
    )
    .await
}

pub(crate) async fn resolve_version_libraries(
    app: &AppHandle,
    version_id: &str,
    visited: &mut HashSet<String>,
) -> AppResult<Vec<Library>> {
    let mut libs: Vec<Library> = Vec::new();
    let mut stack: Vec<String> = vec![version_id.to_string()];

    while let Some(current) = stack.pop() {
        if !visited.insert(current.clone()) {
            return Err("Ciclo detectado en inheritsFrom".to_string().into());
        }
        let v = load_version_json_from_disk(app, &current).await?;
        if let Some(parent) = v.inherits_from.as_deref() {
            if !visited.contains(parent) {
                stack.push(parent.to_string());
            }
        }
        if let Some(child_libs) = v.libraries {
            libs.extend(child_libs);
        }
    }

    Ok(libs)
}

pub async fn download_libraries_for_version_impl(
    app: &AppHandle,
    version_id: String,
) -> AppResult<String> {
    let mut visited = HashSet::new();
    let libraries = resolve_version_libraries(app, &version_id, &mut visited).await?;
    let lib_dir = get_launcher_dir(app).join("libraries");
    let _ = app.emit(
        "download-progress",
        ProgressPayload { task: "Verificando librerias...".to_string(), percent: 0.0 },
    );
    download_libraries_concurrent(&libraries, &lib_dir).await?;
    Ok("Librerias verificadas".to_string())
}

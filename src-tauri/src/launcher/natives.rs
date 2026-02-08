use crate::models::Library;
use crate::utils::{extract_native_jar, should_download_lib};
use sha1::{Digest, Sha1};
use std::path::PathBuf;
use tokio::fs as tokio_fs;

pub(crate) fn natives_signature(libraries: &Vec<Library>) -> String {
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

pub(crate) async fn ensure_natives(
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

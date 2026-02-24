use crate::models::Library;
use once_cell::sync::Lazy;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tokio::fs as tokio_fs;
use zip::write::FileOptions;

use crate::error::AppResult;
pub fn hide_background_window(cmd: &mut std::process::Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
    }
}

// Crear directorio si no existe
pub fn ensure_dir(path: &Path) -> AppResult<()> {
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    }
    Ok(())
}

// Crear directorio async si no existe
pub async fn ensure_dir_async(path: &Path) -> AppResult<()> {
    if tokio_fs::try_exists(path).await.unwrap_or(false) {
        return Ok(());
    }
    tokio_fs::create_dir_all(path)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    Ok(())
}

// Obtener directorio del launcher
pub fn get_launcher_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    let mut path = app_handle.path().app_data_dir().unwrap_or(PathBuf::from("."));
    path.push(".launcher_mc_files");
    if let Err(e) = ensure_dir(&path) {
        eprintln!("No se pudo crear dir base: {}", e);
    }
    path
}

// Detectar OS para API de Adoptium
pub fn detect_os_adoptium() -> (&'static str, &'static str) {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    let os_api = match os {
        "windows" => "windows",
        "linux" => "linux",
        "macos" => "mac",
        _ => "linux",
    };

    let arch_api = match arch {
        "x86_64" => "x64",
        "x86" => "x86",
        "aarch64" => "aarch64",
        _ => "x64",
    };

    (os_api, arch_api)
}

// Crear cliente HTTP con User-Agent
pub fn create_client() -> reqwest::Client {
    static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
        reqwest::Client::builder().user_agent("NewenLauncher/1.0").build().unwrap_or_else(|e| {
            eprintln!("Error creando HTTP client: {}", e);
            reqwest::Client::new()
        })
    });

    HTTP_CLIENT.clone()
}

// Mapear componente de Mojang a versión de Java
pub fn map_component_to_java_version(component: &str) -> u32 {
    match component {
        "java-runtime-alpha" | "jre-legacy" | "minecraft-java-exe" => 8,
        "java-runtime-beta" => 16,
        "java-runtime-gamma" => 17,
        "java-runtime-delta" => 21,
        _ => 17,
    }
}

// Lógica para decidir si descargar una librería
pub fn should_download_lib(lib: &Library) -> bool {
    if let Some(rules) = &lib.rules {
        let mut allow = false;
        let current_os = match std::env::consts::OS {
            "windows" => "windows",
            "macos" => "osx",
            "linux" => "linux",
            _ => "unknown",
        };

        for rule in rules {
            if let Some(os_rule) = &rule.os {
                if os_rule.name == current_os {
                    allow = rule.action == "allow";
                }
            } else {
                allow = rule.action == "allow";
            }
        }
        allow
    } else {
        true
    }
}

pub fn maven_artifact_path(name: &str) -> Option<String> {
    let (coords, ext) = match name.split_once('@') {
        Some((c, e)) if !e.trim().is_empty() => (c, e.trim()),
        _ => (name, "jar"),
    };
    let parts: Vec<&str> = coords.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let classifier = if parts.len() >= 4 { Some(parts[3]) } else { None };
    let filename = if let Some(classifier) = classifier {
        format!("{artifact}-{version}-{classifier}.{ext}")
    } else {
        format!("{artifact}-{version}.{ext}")
    };
    Some(format!("{}/{}/{}/{}", group, artifact, version, filename))
}

pub fn library_artifact_url(lib: &Library) -> Option<String> {
    let path = maven_artifact_path(&lib.name)?;
    let base = lib
        .url
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("https://libraries.minecraft.net/");
    let base = if base.ends_with('/') { base.to_string() } else { format!("{}/", base) };
    Some(format!("{}{}", base, path))
}

// Extraer nativos de un JAR
pub fn extract_native_jar(jar_path: &Path, natives_dir: &Path) -> AppResult<()> {
    let file =
        fs::File::open(jar_path).map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| crate::error::AppError::Message(e.to_string()))?;

    for i in 0..archive.len() {
        let mut file =
            archive.by_index(i).map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        let name = file.name().to_string();

        // Ignorar meta-data
        if name.starts_with("META-INF") || name.ends_with('/') {
            continue;
        }

        // Extraer solo dll/so/dylib
        if name.ends_with(".dll") || name.ends_with(".so") || name.ends_with(".dylib") {
            let outpath = natives_dir.join(name);
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
            io::copy(&mut file, &mut outfile)
                .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        }
    }
    Ok(())
}

pub async fn append_action_log(app: &tauri::AppHandle, message: &str) -> AppResult<()> {
    let base = get_launcher_dir(app);
    let logs_dir = base.join("logs");
    tokio_fs::create_dir_all(&logs_dir)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let log_path = logs_dir.join("actions.log");
    let mut file = tokio_fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let line = format!("[{}] {}\n", ts, message);
    use tokio::io::AsyncWriteExt;
    file.write_all(line.as_bytes())
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    Ok(())
}

pub fn zip_dir_to_file(src_dir: &Path, dest_zip: &Path) -> AppResult<()> {
    if !src_dir.exists() {
        return Err("Directorio a respaldar no existe".to_string().into());
    }
    if let Some(parent) = dest_zip.parent() {
        ensure_dir(parent)?;
    }
    let file =
        fs::File::create(dest_zip).map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    fn add_dir(
        zip: &mut zip::ZipWriter<fs::File>,
        base: &Path,
        path: &Path,
        options: FileOptions,
    ) -> AppResult<()> {
        let entries =
            fs::read_dir(path).map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        for entry in entries {
            let entry = entry.map_err(|e| crate::error::AppError::Message(e.to_string()))?;
            let entry_path = entry.path();
            let rel = entry_path
                .strip_prefix(base)
                .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
            let name = rel.to_string_lossy().replace('\\', "/");
            if entry_path.is_dir() {
                zip.add_directory(format!("{}/", name), options)
                    .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
                add_dir(zip, base, &entry_path, options)?;
            } else {
                zip.start_file(name, options)
                    .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
                let mut f = fs::File::open(&entry_path)
                    .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
                io::copy(&mut f, zip)
                    .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
            }
        }
        Ok(())
    }

    add_dir(&mut zip, src_dir, src_dir, options)?;
    zip.finish().map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    Ok(())
}

pub fn prune_old_backups(dir: &Path, keep: usize) -> AppResult<()> {
    if !dir.exists() {
        return Ok(());
    }
    let mut entries: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| crate::error::AppError::Message(e.to_string()))? {
        let entry = entry.map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let meta = entry.metadata().map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        let modified = meta.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        entries.push((path, modified));
    }
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    if entries.len() <= keep {
        return Ok(());
    }
    for (path, _) in entries.into_iter().skip(keep) {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

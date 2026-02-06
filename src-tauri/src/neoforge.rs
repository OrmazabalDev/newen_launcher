use crate::downloader::{
    download_client_impl, download_game_files_impl, get_version_metadata_impl, get_versions_impl,
};
use crate::models::{ProgressPayload, VersionManifest, VersionMetadata};
use crate::utils::{create_client, get_launcher_dir, hide_background_window};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;

fn normalize_version_hint(raw: &str) -> String {
    let token = raw
        .split(|c: char| c == ' ' || c == ',' || c == ';')
        .next()
        .unwrap_or("")
        .trim();
    token
        .trim_start_matches(|c: char| !c.is_ascii_digit())
        .to_string()
}

fn parse_mc_version_prefix(mc_version: &str) -> Result<String, String> {
    let mut parts = mc_version.split('.');
    let major = parts
        .next()
        .ok_or("Version de Minecraft invalida".to_string())?;
    let minor = parts
        .next()
        .ok_or("Version de Minecraft invalida".to_string())?;
    let patch = parts.next().unwrap_or("0");
    if major != "1" {
        return Err("Solo se soportan versiones modernas de Minecraft (1.x)".to_string());
    }
    Ok(format!("{}.{}.", minor, patch))
}

fn extract_versions_from_xml(xml: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = xml;
    while let Some(start) = rest.find("<version>") {
        let s = &rest[start + "<version>".len()..];
        if let Some(end) = s.find("</version>") {
            out.push(s[..end].trim().to_string());
            rest = &s[end + "</version>".len()..];
        } else {
            break;
        }
    }
    out
}

fn compare_neoforge_version(a: &str, b: &str) -> std::cmp::Ordering {
    let parse_numbers = |s: &str| -> Vec<u32> {
        let mut out = Vec::new();
        let mut current = String::new();
        for ch in s.chars() {
            if ch.is_ascii_digit() {
                current.push(ch);
            } else if !current.is_empty() {
                out.push(current.parse::<u32>().unwrap_or(0));
                current.clear();
            }
        }
        if !current.is_empty() {
            out.push(current.parse::<u32>().unwrap_or(0));
        }
        out
    };

    let stability_rank = |s: &str| -> i32 {
        let lower = s.to_lowercase();
        if lower.contains("alpha") {
            0
        } else if lower.contains("beta") {
            1
        } else if lower.contains("snapshot") {
            -1
        } else {
            2
        }
    };

    let av = parse_numbers(a);
    let bv = parse_numbers(b);
    let max_len = av.len().max(bv.len());
    for i in 0..max_len {
        let a_i = *av.get(i).unwrap_or(&0);
        let b_i = *bv.get(i).unwrap_or(&0);
        if a_i != b_i {
            return a_i.cmp(&b_i);
        }
    }

    let a_rank = stability_rank(a);
    let b_rank = stability_rank(b);
    if a_rank != b_rank {
        return a_rank.cmp(&b_rank);
    }
    a.cmp(b)
}

async fn fetch_neoforge_versions() -> Result<Vec<String>, String> {
    let url = "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml";
    let client = create_client();
    let xml = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    Ok(extract_versions_from_xml(&xml))
}

async fn resolve_neoforge_build(
    mc_version: &str,
    build_override: Option<String>,
) -> Result<String, String> {
    let prefix = parse_mc_version_prefix(mc_version)?;
    let mut filtered: Vec<String> = fetch_neoforge_versions()
        .await?
        .into_iter()
        .filter(|v| v.starts_with(&prefix))
        .collect();

    if filtered.is_empty() {
        return Err(format!(
            "No se encontraron builds NeoForge para Minecraft {}",
            mc_version
        ));
    }

    filtered.sort_by(|a, b| compare_neoforge_version(b, a));

    if let Some(raw) = build_override {
        let hint = normalize_version_hint(&raw);
        if !hint.is_empty() {
            if let Some(found) = filtered.iter().find(|v| *v == &hint) {
                return Ok(found.clone());
            }
            if let Some(found) = filtered
                .iter()
                .find(|v| v.starts_with(&format!("{}{}", prefix, hint)))
            {
                return Ok(found.clone());
            }
            if let Some(found) = filtered.iter().find(|v| v.ends_with(&hint)) {
                return Ok(found.clone());
            }
        }
    }

    let stable = filtered
        .iter()
        .find(|v| {
            let lower = v.to_lowercase();
            !lower.contains("alpha") && !lower.contains("beta") && !lower.contains("snapshot")
        })
        .cloned();
    Ok(stable.unwrap_or_else(|| filtered[0].clone()))
}

fn get_neoforge_profiles_dir(app: &AppHandle, version_id: &str) -> PathBuf {
    get_launcher_dir(app)
        .join("profiles")
        .join("neoforge")
        .join(version_id)
}

fn ensure_default_neoforge_profile(app: &AppHandle, version_id: &str) -> Result<(), String> {
    let profile_dir = get_neoforge_profiles_dir(app, version_id).join("default");
    fs::create_dir_all(profile_dir.join("mods")).map_err(|e| e.to_string())?;
    fs::create_dir_all(profile_dir.join("config")).map_err(|e| e.to_string())?;
    Ok(())
}

async fn list_version_dirs(versions_dir: &PathBuf) -> HashSet<String> {
    let mut out = HashSet::new();
    if let Ok(mut entries) = tokio_fs::read_dir(versions_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(ft) = entry.file_type().await {
                if ft.is_dir() {
                    if let Ok(name) = entry.file_name().into_string() {
                        out.insert(name);
                    }
                }
            }
        }
    }
    out
}

fn detect_installed_neoforge_id(
    mc_version: &str,
    neoforge_version: &str,
    before: &HashSet<String>,
    after: &HashSet<String>,
) -> String {
    let expected = format!("{}-neoforge-{}", mc_version, neoforge_version);
    if after.contains(&expected) {
        return expected;
    }

    let mut new_items: Vec<String> = after.difference(before).cloned().collect();
    new_items.sort();
    if let Some(found) = new_items
        .iter()
        .find(|v| v.contains("neoforge") && v.contains(mc_version))
    {
        return found.clone();
    }
    if let Some(found) = new_items.iter().find(|v| v.contains("neoforge")) {
        return found.clone();
    }
    if let Some(found) = new_items.first() {
        return found.clone();
    }

    if let Some(found) = after
        .iter()
        .find(|v| v.contains("neoforge") && v.contains(mc_version))
    {
        return found.clone();
    }
    if let Some(found) = after.iter().find(|v| v.contains("neoforge")) {
        return found.clone();
    }
    expected
}

async fn download_neoforge_installer(
    app: &AppHandle,
    neoforge_version: &str,
) -> Result<PathBuf, String> {
    let installers_dir = get_launcher_dir(app).join("neoforge_installers");
    tokio_fs::create_dir_all(&installers_dir)
        .await
        .map_err(|e| e.to_string())?;
    let installer_path =
        installers_dir.join(format!("neoforge-{}-installer.jar", neoforge_version));

    if installer_path.exists() {
        return Ok(installer_path);
    }

    let url = format!(
        "https://maven.neoforged.net/releases/net/neoforged/neoforge/{0}/neoforge-{0}-installer.jar",
        neoforge_version
    );
    let client = create_client();
    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    tokio_fs::write(&installer_path, &bytes)
        .await
        .map_err(|e| e.to_string())?;
    Ok(installer_path)
}

async fn ensure_launcher_profiles(base_dir: &PathBuf) -> Result<(), String> {
    let path = base_dir.join("launcher_profiles.json");
    if path.exists() {
        return Ok(());
    }

    let content = r#"{
  "profiles": {},
  "clientToken": "launcher-mc-tauri",
  "launcherVersion": {
    "name": "launcher-mc-tauri",
    "format": 21
  }
}"#;
    tokio_fs::write(&path, content)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn run_neoforge_installer(app: &AppHandle, installer_path: &PathBuf) -> Result<(), String> {
    let base_dir = get_launcher_dir(app);
    ensure_launcher_profiles(&base_dir).await?;
    let base_dir_clone = base_dir.clone();
    let installer = installer_path.to_path_buf();

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let attempts: Vec<Vec<String>> = vec![
            vec![
                "-jar".to_string(),
                installer.to_string_lossy().to_string(),
                "--install-client".to_string(),
                "--install-dir".to_string(),
                base_dir_clone.to_string_lossy().to_string(),
            ],
            vec![
                "-jar".to_string(),
                installer.to_string_lossy().to_string(),
                "--install-client".to_string(),
                base_dir_clone.to_string_lossy().to_string(),
            ],
            vec![
                "-jar".to_string(),
                installer.to_string_lossy().to_string(),
                "--installClient".to_string(),
                "--installDir".to_string(),
                base_dir_clone.to_string_lossy().to_string(),
            ],
            vec![
                "-jar".to_string(),
                installer.to_string_lossy().to_string(),
                "--installClient".to_string(),
                base_dir_clone.to_string_lossy().to_string(),
            ],
            vec![
                "-jar".to_string(),
                installer.to_string_lossy().to_string(),
                "--install-client".to_string(),
            ],
            vec![
                "-jar".to_string(),
                installer.to_string_lossy().to_string(),
                "--installClient".to_string(),
            ],
        ];

        for args in attempts {
            let mut cmd = std::process::Command::new("java");
            cmd.args(&args);
            cmd.current_dir(&base_dir_clone);
            hide_background_window(&mut cmd);
            let output = cmd
                .output()
                .map_err(|e| format!("No se pudo ejecutar java: {}", e))?;
            if output.status.success() {
                return Ok(());
            }
        }
        Err(
            "El instalador NeoForge no pudo ejecutarse en modo headless. Verifica Java."
                .to_string(),
        )
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(())
}

pub async fn install_neoforge_impl(
    app: &AppHandle,
    mc_version: String,
    neoforge_build_override: Option<String>,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> Result<String, String> {
    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Preparando NeoForge...".to_string(),
            percent: 0.0,
        },
    );

    if manifest_cache
        .lock()
        .map_err(|_| "Error lock".to_string())?
        .is_none()
    {
        let _ = get_versions_impl(app, manifest_cache).await?;
    }
    get_version_metadata_impl(app, mc_version.clone(), manifest_cache, metadata_cache).await?;
    download_client_impl(app, mc_version.clone(), metadata_cache).await?;
    download_game_files_impl(app, mc_version.clone(), metadata_cache).await?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Resolviendo build NeoForge...".to_string(),
            percent: 10.0,
        },
    );

    let neoforge_build = resolve_neoforge_build(&mc_version, neoforge_build_override).await?;
    let expected_id = format!("{}-neoforge-{}", mc_version, neoforge_build);
    let versions_dir = get_launcher_dir(app).join("versions");
    let existing = list_version_dirs(&versions_dir).await;
    if existing.contains(&expected_id) {
        ensure_default_neoforge_profile(app, &expected_id)?;
        return Ok(expected_id);
    }

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Descargando instalador NeoForge...".to_string(),
            percent: 20.0,
        },
    );
    let installer_path = download_neoforge_installer(app, &neoforge_build).await?;

    let before = list_version_dirs(&versions_dir).await;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Ejecutando instalador NeoForge...".to_string(),
            percent: 50.0,
        },
    );
    run_neoforge_installer(app, &installer_path).await?;

    let after = list_version_dirs(&versions_dir).await;
    let installed_id = detect_installed_neoforge_id(&mc_version, &neoforge_build, &before, &after);
    let installed_path = versions_dir.join(&installed_id);
    if !installed_path.exists() {
        return Err(
            "No se encontro la carpeta de NeoForge instalada. Verifica Java o el instalador."
                .to_string(),
        );
    }
    let installed_json = installed_path.join(format!("{}.json", installed_id));
    if !installed_json.exists() {
        return Err(
            "NeoForge no genero el archivo de version (.json). Revisa el log del instalador."
                .to_string(),
        );
    }

    ensure_default_neoforge_profile(app, &installed_id)?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "NeoForge instalado".to_string(),
            percent: 100.0,
        },
    );
    Ok(installed_id)
}

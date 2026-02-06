use crate::downloader::{
    download_client_impl, download_game_files_impl, get_version_metadata_impl, get_versions_impl,
};
use crate::models::{ForgePromotions, ProgressPayload, VersionManifest, VersionMetadata};
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

pub async fn install_forge_impl(
    app: &AppHandle,
    mc_version: String,
    forge_build_override: Option<String>,
    manifest_cache: &Mutex<Option<VersionManifest>>,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> Result<String, String> {
    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Preparando Forge...".to_string(),
            percent: 0.0,
        },
    );

    // Asegurar que la version base exista (cliente + assets)
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
            task: "Resolviendo build Forge...".to_string(),
            percent: 10.0,
        },
    );
    let forge_build = match forge_build_override {
        Some(build) if !build.trim().is_empty() => {
            let hint = normalize_version_hint(&build);
            if hint.is_empty() {
                resolve_latest_forge_build(&mc_version).await?
            } else {
                hint
            }
        }
        _ => resolve_latest_forge_build(&mc_version).await?,
    };
    let forge_version = if forge_build.starts_with(&format!("{}-", mc_version)) {
        forge_build
    } else {
        format!("{}-{}", mc_version, forge_build)
    };

    let forge_build_only = forge_version
        .trim_start_matches(&format!("{}-", mc_version))
        .to_string();
    let expected_id = format!("{}-forge-{}", mc_version, forge_build_only);
    let versions_dir = get_launcher_dir(app).join("versions");
    let existing = list_version_dirs(&versions_dir).await;
    if existing.contains(&expected_id) {
        ensure_default_forge_profile(app, &expected_id)?;
        return Ok(expected_id);
    }

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Descargando instalador Forge...".to_string(),
            percent: 20.0,
        },
    );
    let installer_path = download_forge_installer(app, &forge_version).await?;

    let before = list_version_dirs(&versions_dir).await;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Ejecutando instalador Forge...".to_string(),
            percent: 50.0,
        },
    );
    run_forge_installer(app, &installer_path).await?;

    let after = list_version_dirs(&versions_dir).await;
    let installed_id = detect_installed_forge_id(&mc_version, &forge_version, &before, &after);
    let installed_path = versions_dir.join(&installed_id);
    if !installed_path.exists() {
        return Err(
            "No se encontro la carpeta de Forge instalada. Verifica Java o el instalador."
                .to_string(),
        );
    }
    let installed_json = installed_path.join(format!("{}.json", installed_id));
    if !installed_json.exists() {
        return Err(
            "Forge no genero el archivo de version (.json). Revisa el log del instalador."
                .to_string(),
        );
    }

    ensure_default_forge_profile(app, &installed_id)?;

    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            task: "Forge instalado".to_string(),
            percent: 100.0,
        },
    );
    Ok(installed_id)
}

fn get_forge_profiles_dir(app: &AppHandle, version_id: &str) -> PathBuf {
    get_launcher_dir(app)
        .join("profiles")
        .join("forge")
        .join(version_id)
}

fn ensure_default_forge_profile(app: &AppHandle, version_id: &str) -> Result<(), String> {
    let profile_dir = get_forge_profiles_dir(app, version_id).join("default");
    fs::create_dir_all(profile_dir.join("mods")).map_err(|e| e.to_string())?;
    fs::create_dir_all(profile_dir.join("config")).map_err(|e| e.to_string())?;
    Ok(())
}

async fn resolve_latest_forge_build(mc_version: &str) -> Result<String, String> {
    if let Ok(build) = fetch_promotions_latest(mc_version).await {
        if !build.is_empty() {
            return Ok(build);
        }
    }
    fetch_maven_latest(mc_version).await
}

async fn fetch_promotions_latest(mc_version: &str) -> Result<String, String> {
    let url =
        "https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json";
    let client = create_client();
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let promos: ForgePromotions = resp.json().await.map_err(|e| e.to_string())?;

    let direct_key = format!("{}-latest", mc_version);
    if let Some(v) = promos.promos.get(&direct_key) {
        return Ok(v.clone());
    }

    // Fallback: cualquier key que empiece con mc_version y termine en -latest
    let mut candidates: Vec<&String> = promos
        .promos
        .iter()
        .filter(|(k, _)| k.starts_with(mc_version) && k.ends_with("-latest"))
        .map(|(_, v)| v)
        .collect();

    candidates.sort_by(|a, b| compare_semver(b, a));
    candidates
        .first()
        .cloned()
        .cloned()
        .ok_or("No hay build latest en promociones".to_string())
}

async fn fetch_maven_latest(mc_version: &str) -> Result<String, String> {
    let url = "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";
    let client = create_client();
    let xml = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let versions = extract_versions_from_xml(&xml);
    let mut filtered: Vec<String> = versions
        .into_iter()
        .filter(|v| v.starts_with(&format!("{}-", mc_version)))
        .collect();

    if filtered.is_empty() {
        return Err("No se encontraron builds Forge para esa version".to_string());
    }

    filtered.sort_by(|a, b| compare_forge_version(b, a, mc_version));
    Ok(filtered[0].clone())
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

fn compare_forge_version(a: &str, b: &str, mc_version: &str) -> std::cmp::Ordering {
    let a_build = a.trim_start_matches(&format!("{}-", mc_version));
    let b_build = b.trim_start_matches(&format!("{}-", mc_version));
    compare_semver(a_build, b_build)
}

fn compare_semver(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |s: &str| -> Vec<u32> {
        s.split('.')
            .map(|seg| {
                let digits: String = seg.chars().take_while(|c| c.is_ascii_digit()).collect();
                digits.parse::<u32>().unwrap_or(0)
            })
            .collect()
    };
    let av = parse(a);
    let bv = parse(b);
    let max_len = av.len().max(bv.len());
    for i in 0..max_len {
        let a_i = *av.get(i).unwrap_or(&0);
        let b_i = *bv.get(i).unwrap_or(&0);
        if a_i != b_i {
            return a_i.cmp(&b_i);
        }
    }
    std::cmp::Ordering::Equal
}

async fn download_forge_installer(app: &AppHandle, forge_version: &str) -> Result<PathBuf, String> {
    let installers_dir = get_launcher_dir(app).join("forge_installers");
    tokio_fs::create_dir_all(&installers_dir)
        .await
        .map_err(|e| e.to_string())?;
    let installer_path = installers_dir.join(format!("forge-{}-installer.jar", forge_version));

    if installer_path.exists() {
        return Ok(installer_path);
    }

    let url = format!(
        "https://maven.minecraftforge.net/net/minecraftforge/forge/{0}/forge-{0}-installer.jar",
        forge_version
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

fn detect_installed_forge_id(
    mc_version: &str,
    forge_version: &str,
    before: &HashSet<String>,
    after: &HashSet<String>,
) -> String {
    // 1) Si ya existe el ID esperado, usarlo
    let expected = format!(
        "{}-forge-{}",
        mc_version,
        forge_version.trim_start_matches(&format!("{}-", mc_version))
    );
    if after.contains(&expected) {
        return expected;
    }

    // 2) Diferencia entre listas antes/despues
    let mut new_items: Vec<String> = after.difference(before).cloned().collect();
    new_items.sort();
    if let Some(found) = new_items
        .iter()
        .find(|v| v.contains("forge") && v.contains(mc_version))
    {
        return found.clone();
    }
    if let Some(found) = new_items.first() {
        return found.clone();
    }

    // 3) Fallback: buscar algo que contenga forge
    if let Some(found) = after
        .iter()
        .find(|v| v.contains("forge") && v.contains(mc_version))
    {
        return found.clone();
    }
    expected
}

async fn run_forge_installer(app: &AppHandle, installer_path: &PathBuf) -> Result<(), String> {
    let base_dir = get_launcher_dir(app);
    ensure_launcher_profiles(&base_dir).await?;
    let base_dir_clone = base_dir.clone();
    let installer = installer_path.to_path_buf();
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let attempts: Vec<Vec<String>> = vec![
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
        Err("El instalador Forge no pudo ejecutarse en modo headless. Verifica Java.".to_string())
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(())
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

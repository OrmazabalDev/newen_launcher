use crate::error::{AppError, AppResult};
use crate::utils::{
    create_client, ensure_dir, ensure_dir_async, get_launcher_dir, hide_background_window,
};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tokio::fs as tokio_fs;

fn get_neoforge_profiles_dir(app: &AppHandle, version_id: &str) -> PathBuf {
    get_launcher_dir(app).join("profiles").join("neoforge").join(version_id)
}

pub(super) fn ensure_default_neoforge_profile(app: &AppHandle, version_id: &str) -> AppResult<()> {
    let profile_dir = get_neoforge_profiles_dir(app, version_id).join("default");
    ensure_dir(&profile_dir.join("mods"))?;
    ensure_dir(&profile_dir.join("config"))?;
    Ok(())
}

pub(super) async fn list_version_dirs(versions_dir: &Path) -> HashSet<String> {
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

pub(super) fn detect_installed_neoforge_id(
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
    if let Some(found) = new_items.iter().find(|v| v.contains("neoforge") && v.contains(mc_version))
    {
        return found.clone();
    }
    if let Some(found) = new_items.iter().find(|v| v.contains("neoforge")) {
        return found.clone();
    }
    if let Some(found) = new_items.first() {
        return found.clone();
    }

    if let Some(found) = after.iter().find(|v| v.contains("neoforge") && v.contains(mc_version)) {
        return found.clone();
    }
    if let Some(found) = after.iter().find(|v| v.contains("neoforge")) {
        return found.clone();
    }
    expected
}

pub(super) async fn download_neoforge_installer(
    app: &AppHandle,
    neoforge_version: &str,
) -> AppResult<PathBuf> {
    let installers_dir = get_launcher_dir(app).join("neoforge_installers");
    ensure_dir_async(&installers_dir).await?;
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
        .map_err(|e| AppError::Message(e.to_string()))?
        .bytes()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;
    tokio_fs::write(&installer_path, &bytes).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(installer_path)
}

async fn ensure_launcher_profiles(base_dir: &Path) -> AppResult<()> {
    let path = base_dir.join("launcher_profiles.json");
    if path.exists() {
        return Ok(());
    }

    let content = r#"{
  \"profiles\": {},
  \"clientToken\": \"launcher-mc-tauri\",
  \"launcherVersion\": {
    \"name\": \"launcher-mc-tauri\",
    \"format\": 21
  }
}"#;
    tokio_fs::write(&path, content).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}

pub(super) async fn run_neoforge_installer(
    app: &AppHandle,
    installer_path: &Path,
) -> AppResult<()> {
    let base_dir = get_launcher_dir(app);
    ensure_launcher_profiles(&base_dir).await?;
    let base_dir_clone = base_dir.clone();
    let installer = installer_path.to_path_buf();

    tokio::task::spawn_blocking(move || -> AppResult<()> {
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
                .map_err(|e| AppError::Message(format!("No se pudo ejecutar java: {}", e)))?;
            if output.status.success() {
                return Ok(());
            }
        }
        Err("El instalador NeoForge no pudo ejecutarse en modo headless. Verifica Java."
            .to_string()
            .into())
    })
    .await
    .map_err(|e| AppError::Message(e.to_string()))??;

    Ok(())
}

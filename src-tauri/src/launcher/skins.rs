use crate::models::MinecraftProfile;
use crate::utils::get_launcher_dir;
use std::path::PathBuf;
use tauri::AppHandle;
use tokio::fs as tokio_fs;

pub(crate) async fn prepare_offline_skin_pack(
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

pub(crate) fn pack_format_for_version(version_id: &str) -> i32 {
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

use crate::models::SkinInfo;
use crate::utils::get_launcher_dir;
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;
use tokio::fs as tokio_fs;

const ACTIVE_SKIN_FILE: &str = "active.png";
const ACTIVE_META_FILE: &str = "active.json";
const ACTIVE_CAPE_FILE: &str = "active_cape.png";

#[derive(Serialize, Deserialize)]
struct SkinMeta {
    name: String,
    model: String,
}

fn skins_dir(app: &AppHandle) -> PathBuf {
    get_launcher_dir(app).join("skins")
}

fn active_skin_path(app: &AppHandle) -> PathBuf {
    skins_dir(app).join(ACTIVE_SKIN_FILE)
}

fn active_meta_path(app: &AppHandle) -> PathBuf {
    skins_dir(app).join(ACTIVE_META_FILE)
}

fn active_cape_path(app: &AppHandle) -> PathBuf {
    skins_dir(app).join(ACTIVE_CAPE_FILE)
}

fn clean_base64(data: &str) -> &str {
    if let Some(idx) = data.find("base64,") {
        return &data[idx + "base64,".len()..];
    }
    data
}

fn is_png_header(bytes: &[u8]) -> bool {
    bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
}

async fn read_active_skin(app: &AppHandle) -> Result<Option<SkinInfo>, String> {
    let path = active_skin_path(app);
    if !path.exists() {
        return Ok(None);
    }
    let meta_path = active_meta_path(app);
    let meta = if let Ok(raw) = tokio_fs::read_to_string(&meta_path).await {
        serde_json::from_str::<SkinMeta>(&raw).unwrap_or(SkinMeta {
            name: "Skin".to_string(),
            model: "steve".to_string(),
        })
    } else {
        SkinMeta {
            name: "Skin".to_string(),
            model: "steve".to_string(),
        }
    };

    let bytes = tokio_fs::read(&path).await.map_err(|e| e.to_string())?;
    let data_url = format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(bytes)
    );
    Ok(Some(SkinInfo {
        name: meta.name,
        model: meta.model,
        data_url,
    }))
}

#[tauri::command]
pub async fn get_active_skin(app: AppHandle) -> Result<Option<SkinInfo>, String> {
    read_active_skin(&app).await
}

#[tauri::command]
pub async fn set_active_skin_base64(
    app: AppHandle,
    name: String,
    model: String,
    data: String,
) -> Result<SkinInfo, String> {
    let cleaned = clean_base64(&data);
    let bytes = general_purpose::STANDARD
        .decode(cleaned)
        .map_err(|_| "Datos de skin inválidos".to_string())?;
    if !is_png_header(&bytes) {
        return Err("La skin debe ser un PNG válido".to_string());
    }

    let dir = skins_dir(&app);
    tokio_fs::create_dir_all(&dir)
        .await
        .map_err(|e| e.to_string())?;
    tokio_fs::write(active_skin_path(&app), &bytes)
        .await
        .map_err(|e| e.to_string())?;
    let meta = SkinMeta {
        name: if name.trim().is_empty() {
            "Skin".to_string()
        } else {
            name.trim().to_string()
        },
        model: if model.trim().is_empty() {
            "steve".to_string()
        } else {
            model.trim().to_string()
        },
    };
    let meta_json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    tokio_fs::write(active_meta_path(&app), meta_json)
        .await
        .map_err(|e| e.to_string())?;

    let data_url = format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(bytes)
    );
    Ok(SkinInfo {
        name: meta.name,
        model: meta.model,
        data_url,
    })
}

#[tauri::command]
pub async fn set_active_skin_url(
    app: AppHandle,
    url: String,
    name: Option<String>,
    model: String,
) -> Result<SkinInfo, String> {
    let client = crate::utils::create_client();
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
    if !is_png_header(&bytes) {
        return Err("La URL no apunta a un PNG válido".to_string());
    }

    let dir = skins_dir(&app);
    tokio_fs::create_dir_all(&dir)
        .await
        .map_err(|e| e.to_string())?;
    tokio_fs::write(active_skin_path(&app), &bytes)
        .await
        .map_err(|e| e.to_string())?;
    let meta = SkinMeta {
        name: name
            .and_then(|n| {
                if n.trim().is_empty() {
                    None
                } else {
                    Some(n.trim().to_string())
                }
            })
            .unwrap_or_else(|| "Skin".to_string()),
        model: if model.trim().is_empty() {
            "steve".to_string()
        } else {
            model.trim().to_string()
        },
    };
    let meta_json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    tokio_fs::write(active_meta_path(&app), meta_json)
        .await
        .map_err(|e| e.to_string())?;

    let data_url = format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(bytes)
    );
    Ok(SkinInfo {
        name: meta.name,
        model: meta.model,
        data_url,
    })
}

#[tauri::command]
pub async fn clear_active_skin(app: AppHandle) -> Result<(), String> {
    let _ = tokio_fs::remove_file(active_skin_path(&app)).await;
    let _ = tokio_fs::remove_file(active_meta_path(&app)).await;
    Ok(())
}

#[tauri::command]
pub async fn get_active_cape(app: AppHandle) -> Result<Option<String>, String> {
    let path = active_cape_path(&app);
    if !path.exists() {
        return Ok(None);
    }
    let bytes = tokio_fs::read(&path).await.map_err(|e| e.to_string())?;
    let data_url = format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(bytes)
    );
    Ok(Some(data_url))
}

#[tauri::command]
pub async fn set_active_cape_base64(app: AppHandle, data: String) -> Result<String, String> {
    let cleaned = clean_base64(&data);
    let bytes = general_purpose::STANDARD
        .decode(cleaned)
        .map_err(|_| "Datos de cape inválidos".to_string())?;
    if !is_png_header(&bytes) {
        return Err("La cape debe ser un PNG válido".to_string());
    }
    let dir = skins_dir(&app);
    tokio_fs::create_dir_all(&dir)
        .await
        .map_err(|e| e.to_string())?;
    tokio_fs::write(active_cape_path(&app), &bytes)
        .await
        .map_err(|e| e.to_string())?;
    let data_url = format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(bytes)
    );
    Ok(data_url)
}

#[tauri::command]
pub async fn set_active_cape_url(app: AppHandle, url: String) -> Result<String, String> {
    let client = crate::utils::create_client();
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
    if !is_png_header(&bytes) {
        return Err("La URL no apunta a un PNG válido".to_string());
    }
    let dir = skins_dir(&app);
    tokio_fs::create_dir_all(&dir)
        .await
        .map_err(|e| e.to_string())?;
    tokio_fs::write(active_cape_path(&app), &bytes)
        .await
        .map_err(|e| e.to_string())?;
    let data_url = format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(bytes)
    );
    Ok(data_url)
}

#[tauri::command]
pub async fn clear_active_cape(app: AppHandle) -> Result<(), String> {
    let _ = tokio_fs::remove_file(active_cape_path(&app)).await;
    Ok(())
}

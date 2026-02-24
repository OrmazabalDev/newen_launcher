mod ms_flow;
mod profile;
mod session;

pub use ms_flow::{poll_ms_login_impl, start_ms_login_impl};

use crate::error::AppResult;
use crate::models::MinecraftProfile;
use std::sync::Mutex;
use tauri::AppHandle;
use uuid::Uuid;

use ms_flow::{fetch_mc_profile, login_minecraft_with_ms, refresh_ms_token};
use session::{clear_session, load_session, now_unix, save_session};

// Lógica de Login Offline
pub async fn login_offline_impl(
    username: String,
    profile_cache: &Mutex<Option<MinecraftProfile>>,
) -> AppResult<String> {
    if username.trim().len() < 3 {
        return Err("El nombre de usuario debe tener al menos 3 caracteres.".to_string().into());
    }

    let uuid = Uuid::new_v3(&Uuid::NAMESPACE_OID, username.as_bytes());
    let access_token = "offline_access_token";

    let profile = MinecraftProfile {
        id: uuid.to_string().replace("-", ""),
        name: username.clone(),
        is_offline: true,
        skin_url: None,
        cape_urls: Vec::new(),
        access_token: None,
        xuid: None,
        user_type: Some("mojang".to_string()),
    };

    {
        let mut cache =
            profile_cache.lock().map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
        *cache = Some(profile.clone());
    }

    let result = serde_json::json!({
        "status": "success",
        "access_token": access_token,
        "id": profile.id,
        "name": profile.name,
        "is_offline": true,
        "skin_url": profile.skin_url,
        "cape_urls": profile.cape_urls
    });

    Ok(result.to_string())
}

pub async fn restore_ms_session_impl(
    app: &AppHandle,
    profile_cache: &Mutex<Option<MinecraftProfile>>,
) -> AppResult<String> {
    let mut session = load_session(app).await?;
    let now = now_unix();
    if session.mc_expires_at <= now + 30 {
        let token = refresh_ms_token(&session.refresh_token).await?;
        let (mc_access, xuid, profile, mc_expires_at) =
            login_minecraft_with_ms(&token.access_token).await?;
        session.refresh_token = token.refresh_token;
        session.mc_access_token = mc_access.clone();
        session.mc_expires_at = mc_expires_at;
        session.profile_id = profile.id.clone();
        session.profile_name = profile.name.clone();
        session.skin_url = profile.skin_url.clone();
        session.cape_urls = profile.cape_urls.clone();
        session.xuid = xuid.clone();
        save_session(app, &session).await?;

        let mut cache =
            profile_cache.lock().map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
        let mut stored_profile = profile.clone();
        stored_profile.access_token = Some(mc_access);
        stored_profile.xuid = xuid;
        stored_profile.user_type = Some("msa".to_string());
        *cache = Some(stored_profile);

        let result = serde_json::json!({
            "status": "success",
            "id": profile.id,
            "name": profile.name,
            "is_offline": false,
            "skin_url": profile.skin_url,
            "cape_urls": profile.cape_urls
        });
        return Ok(result.to_string());
    }

    let profile = MinecraftProfile {
        id: session.profile_id.clone(),
        name: session.profile_name.clone(),
        is_offline: false,
        skin_url: session.skin_url.clone(),
        cape_urls: session.cape_urls.clone(),
        access_token: Some(session.mc_access_token.clone()),
        xuid: session.xuid.clone(),
        user_type: Some("msa".to_string()),
    };

    {
        let mut cache =
            profile_cache.lock().map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
        *cache = Some(profile.clone());
    }

    let result = serde_json::json!({
        "status": "success",
        "id": profile.id,
        "name": profile.name,
        "is_offline": false,
        "skin_url": profile.skin_url,
        "cape_urls": profile.cape_urls
    });
    Ok(result.to_string())
}

pub async fn logout_impl(
    app: &AppHandle,
    profile_cache: &Mutex<Option<MinecraftProfile>>,
) -> AppResult<()> {
    clear_session(app).await?;
    let mut cache =
        profile_cache.lock().map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
    *cache = None;
    Ok(())
}

pub async fn refresh_ms_profile_impl(
    app: &AppHandle,
    profile_cache: &Mutex<Option<MinecraftProfile>>,
) -> AppResult<String> {
    let mut session = load_session(app).await?;
    let now = now_unix();
    if session.mc_expires_at <= now + 30 {
        let token = refresh_ms_token(&session.refresh_token).await?;
        let (mc_access, xuid, profile, mc_expires_at) =
            login_minecraft_with_ms(&token.access_token).await?;
        session.refresh_token = token.refresh_token;
        session.mc_access_token = mc_access.clone();
        session.mc_expires_at = mc_expires_at;
        session.profile_id = profile.id.clone();
        session.profile_name = profile.name.clone();
        session.skin_url = profile.skin_url.clone();
        session.cape_urls = profile.cape_urls.clone();
        session.xuid = xuid.clone();
        save_session(app, &session).await?;

        let mut cache =
            profile_cache.lock().map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
        let mut stored_profile = profile.clone();
        stored_profile.access_token = Some(mc_access);
        stored_profile.xuid = xuid;
        stored_profile.user_type = Some("msa".to_string());
        *cache = Some(stored_profile);

        let result = serde_json::json!({
            "status": "success",
            "id": profile.id,
            "name": profile.name,
            "is_offline": false,
            "skin_url": profile.skin_url,
            "cape_urls": profile.cape_urls
        });
        return Ok(result.to_string());
    }

    let profile = fetch_mc_profile(&session.mc_access_token).await?;
    session.profile_id = profile.id.clone();
    session.profile_name = profile.name.clone();
    session.skin_url = profile.skin_url.clone();
    session.cape_urls = profile.cape_urls.clone();
    save_session(app, &session).await?;

    {
        let mut cache =
            profile_cache.lock().map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
        let mut stored_profile = profile.clone();
        stored_profile.access_token = Some(session.mc_access_token.clone());
        stored_profile.xuid = session.xuid.clone();
        stored_profile.user_type = Some("msa".to_string());
        *cache = Some(stored_profile);
    }

    let result = serde_json::json!({
        "status": "success",
        "id": profile.id,
        "name": profile.name,
        "is_offline": false,
        "skin_url": profile.skin_url,
        "cape_urls": profile.cape_urls
    });
    Ok(result.to_string())
}

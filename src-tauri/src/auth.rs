use crate::models::{
    DeviceCodeResponse, MCLoginResponse, MCProfileResponse, MSDeviceCodeError, MSTokenFullResponse,
    MinecraftProfile, XBLResponse,
};
use crate::utils::get_launcher_dir;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use uuid::Uuid;

const MS_CLIENT_ID: &str = "00000000402b5328";
const MS_SCOPE: &str = "XboxLive.signin offline_access";
const MS_DEVICE_CODE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBL_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";

#[derive(Serialize, Deserialize, Debug, Clone)]
struct StoredSession {
    refresh_token: String,
    mc_access_token: String,
    mc_expires_at: u64,
    profile_id: String,
    profile_name: String,
    skin_url: Option<String>,
    #[serde(default)]
    cape_urls: Vec<String>,
    xuid: Option<String>,
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn auth_session_path(app: &AppHandle) -> std::path::PathBuf {
    get_launcher_dir(app).join("auth").join("session.json")
}

async fn save_session(app: &AppHandle, session: &StoredSession) -> Result<(), String> {
    let path = auth_session_path(app);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(session).map_err(|e| e.to_string())?;
    tokio::fs::write(path, raw).await.map_err(|e| e.to_string())
}

async fn load_session(app: &AppHandle) -> Result<StoredSession, String> {
    let path = auth_session_path(app);
    let raw = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

async fn clear_session(app: &AppHandle) -> Result<(), String> {
    let path = auth_session_path(app);
    if path.exists() {
        tokio::fs::remove_file(path)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Lógica de Login Offline
pub async fn login_offline_impl(
    username: String,
    profile_cache: &Mutex<Option<MinecraftProfile>>,
) -> Result<String, String> {
    if username.trim().len() < 3 {
        return Err("El nombre de usuario debe tener al menos 3 caracteres.".to_string());
    }

    // Generar UUID consistente basado en el nombre
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

    // Guardar en el estado global
    {
        let mut cache = profile_cache
            .lock()
            .map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
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

pub async fn start_ms_login_impl(_app: &AppHandle) -> Result<DeviceCodeResponse, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(MS_DEVICE_CODE_URL)
        .form(&[("client_id", MS_CLIENT_ID), ("scope", MS_SCOPE)])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Error Microsoft: {}", res.status()));
    }

    let device = res
        .json::<DeviceCodeResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(device)
}

pub async fn poll_ms_login_impl(
    app: &AppHandle,
    device_code: String,
    profile_cache: &Mutex<Option<MinecraftProfile>>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(MS_TOKEN_URL)
        .form(&[
            ("client_id", MS_CLIENT_ID),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("device_code", &device_code),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let err = res.json::<MSDeviceCodeError>().await.ok();
        if let Some(err) = err {
            return Err(err.error);
        }
        return Err("microsoft_login_failed".to_string());
    }

    let token = res
        .json::<MSTokenFullResponse>()
        .await
        .map_err(|e| e.to_string())?;
    let (mc_access, xuid, profile, mc_expires_at) =
        login_minecraft_with_ms(&token.access_token).await?;

    let stored = StoredSession {
        refresh_token: token.refresh_token,
        mc_access_token: mc_access.clone(),
        mc_expires_at,
        profile_id: profile.id.clone(),
        profile_name: profile.name.clone(),
        skin_url: profile.skin_url.clone(),
        cape_urls: profile.cape_urls.clone(),
        xuid: xuid.clone(),
    };
    save_session(app, &stored).await?;

    // Guardar en cache
    {
        let mut cache = profile_cache
            .lock()
            .map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
        let mut stored_profile = profile.clone();
        stored_profile.access_token = Some(mc_access);
        stored_profile.xuid = xuid;
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

pub async fn restore_ms_session_impl(
    app: &AppHandle,
    profile_cache: &Mutex<Option<MinecraftProfile>>,
) -> Result<String, String> {
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

        let mut cache = profile_cache
            .lock()
            .map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
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
        let mut cache = profile_cache
            .lock()
            .map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
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
) -> Result<(), String> {
    clear_session(app).await?;
    let mut cache = profile_cache
        .lock()
        .map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
    *cache = None;
    Ok(())
}

pub async fn refresh_ms_profile_impl(
    app: &AppHandle,
    profile_cache: &Mutex<Option<MinecraftProfile>>,
) -> Result<String, String> {
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

        let mut cache = profile_cache
            .lock()
            .map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
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
        let mut cache = profile_cache
            .lock()
            .map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
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

async fn refresh_ms_token(refresh_token: &str) -> Result<MSTokenFullResponse, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(MS_TOKEN_URL)
        .form(&[
            ("client_id", MS_CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("scope", MS_SCOPE),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!(
            "Error al refrescar sesión Microsoft: {}",
            res.status()
        ));
    }
    res.json::<MSTokenFullResponse>()
        .await
        .map_err(|e| e.to_string())
}

async fn login_minecraft_with_ms(
    ms_access_token: &str,
) -> Result<(String, Option<String>, MinecraftProfile, u64), String> {
    let client = reqwest::Client::new();

    let xbl_res = client
        .post(XBL_AUTH_URL)
        .json(&serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={}", ms_access_token)
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !xbl_res.status().is_success() {
        return Err("No se pudo autenticar con Xbox Live".to_string());
    }
    let xbl = xbl_res
        .json::<XBLResponse>()
        .await
        .map_err(|e| e.to_string())?;
    let uhs = xbl
        .display_claims
        .xui
        .get(0)
        .map(|x| x.uhs.clone())
        .ok_or("No se encontro UHS en respuesta de Xbox Live".to_string())?;

    let xsts_res = client
        .post(XSTS_AUTH_URL)
        .json(&serde_json::json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbl.token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !xsts_res.status().is_success() {
        return Err("No se pudo autenticar con XSTS".to_string());
    }
    let xsts = xsts_res
        .json::<XBLResponse>()
        .await
        .map_err(|e| e.to_string())?;

    let mc_login_res = client
        .post(MC_LOGIN_URL)
        .json(&serde_json::json!({
            "identityToken": format!("XBL3.0 x={};{}", uhs, xsts.token)
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !mc_login_res.status().is_success() {
        return Err("No se pudo autenticar en Minecraft".to_string());
    }
    let mc_login = mc_login_res
        .json::<MCLoginResponse>()
        .await
        .map_err(|e| e.to_string())?;

    let profile_res = client
        .get(MC_PROFILE_URL)
        .bearer_auth(&mc_login.access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if profile_res.status().as_u16() == 404 {
        return Err("Esta cuenta no tiene Minecraft Java".to_string());
    }
    if !profile_res.status().is_success() {
        return Err("No se pudo obtener el perfil de Minecraft".to_string());
    }

    let mc_profile = profile_res
        .json::<MCProfileResponse>()
        .await
        .map_err(|e| e.to_string())?;
    let profile = profile_from_mc(mc_profile);

    let mc_expires_at = now_unix() + 23 * 60 * 60;
    Ok((mc_login.access_token, None, profile, mc_expires_at))
}

async fn fetch_mc_profile(access_token: &str) -> Result<MinecraftProfile, String> {
    let client = reqwest::Client::new();
    let profile_res = client
        .get(MC_PROFILE_URL)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if profile_res.status().as_u16() == 404 {
        return Err("Esta cuenta no tiene Minecraft Java".to_string());
    }
    if !profile_res.status().is_success() {
        return Err("No se pudo obtener el perfil de Minecraft".to_string());
    }
    let mc_profile = profile_res
        .json::<MCProfileResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(profile_from_mc(mc_profile))
}

fn profile_from_mc(mc_profile: MCProfileResponse) -> MinecraftProfile {
    let skin_url = pick_active_skin(&mc_profile);
    let cape_urls = pick_capes(&mc_profile);
    MinecraftProfile {
        id: mc_profile.id,
        name: mc_profile.name,
        is_offline: false,
        skin_url,
        cape_urls,
        access_token: None,
        xuid: None,
        user_type: Some("msa".to_string()),
    }
}

fn pick_active_skin(profile: &MCProfileResponse) -> Option<String> {
    profile
        .skins
        .iter()
        .find(|s| s.state.as_deref() == Some("ACTIVE"))
        .and_then(|s| s.url.clone())
        .or_else(|| profile.skins.first().and_then(|s| s.url.clone()))
}

fn pick_capes(profile: &MCProfileResponse) -> Vec<String> {
    let mut out: Vec<String> = profile.capes.iter().filter_map(|c| c.url.clone()).collect();
    out.sort();
    out.dedup();
    if let Some(active) = profile
        .capes
        .iter()
        .find(|c| c.state.as_deref() == Some("ACTIVE"))
        .and_then(|c| c.url.clone())
    {
        out.retain(|c| c != &active);
        out.insert(0, active);
    }
    out
}

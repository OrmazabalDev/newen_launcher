use crate::error::{AppError, AppResult};
use crate::models::{
    DeviceCodeResponse, MCLoginResponse, MCProfileResponse, MSDeviceCodeError, MSTokenFullResponse,
    MinecraftProfile, XBLResponse,
};
use std::sync::Mutex;
use tauri::AppHandle;

use super::profile::profile_from_mc;
use super::session::{now_unix, save_session, StoredSession};

const MS_CLIENT_ID: &str = "00000000402b5328";
const MS_SCOPE: &str = "XboxLive.signin offline_access";
const MS_DEVICE_CODE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBL_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";

pub async fn start_ms_login_impl(_app: &AppHandle) -> AppResult<DeviceCodeResponse> {
    let client = reqwest::Client::new();
    let res = client
        .post(MS_DEVICE_CODE_URL)
        .form(&[("client_id", MS_CLIENT_ID), ("scope", MS_SCOPE)])
        .send()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;

    if !res.status().is_success() {
        return Err(format!("Error Microsoft: {}", res.status()).into());
    }

    let device =
        res.json::<DeviceCodeResponse>().await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(device)
}

pub async fn poll_ms_login_impl(
    app: &AppHandle,
    device_code: String,
    profile_cache: &Mutex<Option<MinecraftProfile>>,
) -> AppResult<String> {
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
        .map_err(|e| AppError::Message(e.to_string()))?;

    if !res.status().is_success() {
        let err = res.json::<MSDeviceCodeError>().await.ok();
        if let Some(err) = err {
            return Err(err.error.into());
        }
        return Err("microsoft_login_failed".to_string().into());
    }

    let token =
        res.json::<MSTokenFullResponse>().await.map_err(|e| AppError::Message(e.to_string()))?;
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

    {
        let mut cache =
            profile_cache.lock().map_err(|_| "Error al bloquear el cache de perfil".to_string())?;
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

pub(super) async fn refresh_ms_token(refresh_token: &str) -> AppResult<MSTokenFullResponse> {
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
        .map_err(|e| AppError::Message(e.to_string()))?;

    if !res.status().is_success() {
        return Err(format!("Error al refrescar sesion Microsoft: {}", res.status()).into());
    }
    res.json::<MSTokenFullResponse>().await.map_err(|e| AppError::Message(e.to_string()))
}

pub(super) async fn login_minecraft_with_ms(
    ms_access_token: &str,
) -> AppResult<(String, Option<String>, MinecraftProfile, u64)> {
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
        .map_err(|e| AppError::Message(e.to_string()))?;
    if !xbl_res.status().is_success() {
        return Err("No se pudo autenticar con Xbox Live".to_string().into());
    }
    let xbl = xbl_res.json::<XBLResponse>().await.map_err(|e| AppError::Message(e.to_string()))?;
    let uhs = xbl.display_claims.xui.first().map(|x| x.uhs.clone()).ok_or_else(|| {
        AppError::Message("No se encontro UHS en respuesta de Xbox Live".to_string())
    })?;

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
        .map_err(|e| AppError::Message(e.to_string()))?;
    if !xsts_res.status().is_success() {
        return Err("No se pudo autenticar con XSTS".to_string().into());
    }
    let xsts =
        xsts_res.json::<XBLResponse>().await.map_err(|e| AppError::Message(e.to_string()))?;

    let mc_login_res = client
        .post(MC_LOGIN_URL)
        .json(&serde_json::json!({
            "identityToken": format!("XBL3.0 x={};{}", uhs, xsts.token)
        }))
        .send()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;
    if !mc_login_res.status().is_success() {
        return Err("No se pudo autenticar en Minecraft".to_string().into());
    }
    let mc_login = mc_login_res
        .json::<MCLoginResponse>()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;

    let profile_res = client
        .get(MC_PROFILE_URL)
        .bearer_auth(&mc_login.access_token)
        .send()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;

    if profile_res.status().as_u16() == 404 {
        return Err("Esta cuenta no tiene Minecraft Java".to_string().into());
    }
    if !profile_res.status().is_success() {
        return Err("No se pudo obtener el perfil de Minecraft".to_string().into());
    }

    let mc_profile = profile_res
        .json::<MCProfileResponse>()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;
    let profile = profile_from_mc(mc_profile);

    let mc_expires_at = now_unix() + 23 * 60 * 60;
    Ok((mc_login.access_token, None, profile, mc_expires_at))
}

pub(super) async fn fetch_mc_profile(access_token: &str) -> AppResult<MinecraftProfile> {
    let client = reqwest::Client::new();
    let profile_res = client
        .get(MC_PROFILE_URL)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;

    if profile_res.status().as_u16() == 404 {
        return Err("Esta cuenta no tiene Minecraft Java".to_string().into());
    }
    if !profile_res.status().is_success() {
        return Err("No se pudo obtener el perfil de Minecraft".to_string().into());
    }
    let mc_profile = profile_res
        .json::<MCProfileResponse>()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;
    Ok(profile_from_mc(mc_profile))
}

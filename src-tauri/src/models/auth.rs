use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MinecraftProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub is_offline: bool,
    #[serde(default)]
    pub skin_url: Option<String>,
    #[serde(default)]
    pub cape_urls: Vec<String>,
    #[serde(skip)]
    pub access_token: Option<String>,
    #[serde(skip)]
    pub xuid: Option<String>,
    #[serde(skip)]
    pub user_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DeviceCodeResponse {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub message: Option<String>,
    pub interval: Option<u64>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MSTokenResponse {
    pub access_token: String,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MSTokenFullResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MSDeviceCodeError {
    pub error: String,
    pub error_description: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct XBLResponse {
    #[serde(rename = "Token")]
    pub token: String,
    #[serde(rename = "DisplayClaims")]
    pub display_claims: XBLDisplayClaims,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct XBLDisplayClaims {
    pub xui: Vec<XBLXui>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct XBLXui {
    pub uhs: String,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MCLoginResponse {
    pub access_token: String,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MCProfileResponse {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub skins: Vec<MCSkin>,
    #[serde(default)]
    pub capes: Vec<MCCape>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MCSkin {
    pub id: Option<String>,
    pub state: Option<String>,
    pub url: Option<String>,
    pub variant: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct MCCape {
    pub id: Option<String>,
    pub state: Option<String>,
    pub url: Option<String>,
}

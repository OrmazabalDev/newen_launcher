use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeSearchResponse {
    pub data: Vec<CurseForgeMod>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeMod {
    pub id: u64,
    pub name: String,
    pub summary: String,
    #[serde(rename = "downloadCount")]
    pub download_count: f64,
    #[serde(rename = "dateModified")]
    pub date_modified: String,
    pub logo: Option<CurseForgeLogo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseForgeLogo {
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail_url: String,
}

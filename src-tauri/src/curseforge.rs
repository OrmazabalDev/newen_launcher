use crate::models::CurseForgeSearchResponse;
use crate::utils::create_client;

const CURSEFORGE_API: &str = "https://api.curseforge.com/v1/mods/search";
const MINECRAFT_GAME_ID: u32 = 432;

pub async fn curseforge_search_impl(
    query: String,
    page_size: Option<u32>,
    index: Option<u32>,
) -> Result<CurseForgeSearchResponse, String> {
    let api_key = std::env::var("CURSEFORGE_API_KEY")
        .map_err(|_| "Falta CURSEFORGE_API_KEY en el entorno".to_string())?;
    let mut params = vec![
        ("gameId", MINECRAFT_GAME_ID.to_string()),
        ("searchFilter", query),
    ];
    if let Some(size) = page_size {
        params.push(("pageSize", size.to_string()));
    }
    if let Some(idx) = index {
        params.push(("index", idx.to_string()));
    }

    let url = reqwest::Url::parse_with_params(CURSEFORGE_API, params).map_err(|e| e.to_string())?;
    let client = create_client();
    let resp = client
        .get(url)
        .header("x-api-key", api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let data = resp
        .json::<CurseForgeSearchResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(data)
}

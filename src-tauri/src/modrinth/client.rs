use crate::downloader::fetch_text_with_cache;
use crate::error::{AppError, AppResult};
use crate::models::{ModrinthProject, ModrinthSearchResponse, ModrinthVersion};
use reqwest::Url;
use serde::de::DeserializeOwned;
use tauri::AppHandle;

async fn fetch_json_cached<T: DeserializeOwned>(app: &AppHandle, url: &str) -> AppResult<T> {
    let text = fetch_text_with_cache(app, url, None, false).await?;
    serde_json::from_str::<T>(&text).map_err(|e| {
        let preview: String = text.chars().take(200).collect();
        AppError::Message(format!("JSON invalido: {} ({})", e, preview))
    })
}

pub async fn modrinth_search_impl(
    app: &AppHandle,
    query: String,
    limit: Option<u32>,
    offset: Option<u32>,
    loader: Option<String>,
    game_version: Option<String>,
    index: Option<String>,
    project_type: Option<String>,
    categories: Option<Vec<String>>,
) -> AppResult<ModrinthSearchResponse> {
    let safe_query = if query.trim().is_empty() { "*".to_string() } else { query };
    let project_type = match project_type {
        Some(p) if !p.trim().is_empty() => p,
        _ => "mod".to_string(),
    };
    let mut facets: Vec<Vec<String>> = vec![vec![format!("project_type:{}", project_type)]];
    if let Some(v) = game_version {
        if !v.trim().is_empty() {
            facets.push(vec![format!("versions:{}", v)]);
        }
    }
    if project_type == "mod" {
        if let Some(l) = loader {
            if !l.trim().is_empty() {
                facets.push(vec![format!("categories:{}", l)]);
            }
        }
    }
    if let Some(list) = categories {
        let mapped: Vec<String> = list
            .into_iter()
            .filter(|c| !c.trim().is_empty())
            .map(|c| format!("categories:{}", c))
            .collect();
        if !mapped.is_empty() {
            facets.push(mapped);
        }
    }
    let facets_json =
        serde_json::to_string(&facets).map_err(|e| AppError::Message(e.to_string()))?;

    let mut params = vec![
        ("query", safe_query),
        ("facets", facets_json),
        ("index", index.unwrap_or_else(|| "downloads".to_string())),
    ];
    if let Some(l) = limit {
        params.push(("limit", l.to_string()));
    }
    if let Some(o) = offset {
        params.push(("offset", o.to_string()));
    }

    let url = Url::parse_with_params("https://api.modrinth.com/v2/search", &params)
        .map_err(|e| AppError::Message(e.to_string()))?;
    fetch_json_cached::<ModrinthSearchResponse>(app, url.as_str()).await
}

pub async fn modrinth_list_versions_impl(
    app: &AppHandle,
    project_id: String,
    loader: Option<String>,
    game_version: Option<String>,
) -> AppResult<Vec<ModrinthVersion>> {
    let mut params: Vec<(String, String)> = Vec::new();
    if let Some(l) = loader {
        params.push(("loaders".to_string(), format!("[\"{}\"]", l)));
    }
    if let Some(v) = game_version {
        params.push(("game_versions".to_string(), format!("[\"{}\"]", v)));
    }

    let url = if params.is_empty() {
        Url::parse(&format!("https://api.modrinth.com/v2/project/{}/version", project_id))
            .map_err(|e| AppError::Message(e.to_string()))?
    } else {
        Url::parse_with_params(
            &format!("https://api.modrinth.com/v2/project/{}/version", project_id),
            params,
        )
        .map_err(|e| AppError::Message(e.to_string()))?
    };

    fetch_json_cached::<Vec<ModrinthVersion>>(app, url.as_str()).await
}

pub async fn modrinth_get_project_impl(
    app: &AppHandle,
    project_id: String,
) -> AppResult<ModrinthProject> {
    let url = format!("https://api.modrinth.com/v2/project/{}", project_id);
    fetch_json_cached::<ModrinthProject>(app, &url).await
}

pub(super) async fn modrinth_get_version(
    app: &AppHandle,
    version_id: &str,
) -> AppResult<ModrinthVersion> {
    let url = format!("https://api.modrinth.com/v2/version/{}", version_id);
    fetch_json_cached::<ModrinthVersion>(app, &url).await
}

use crate::models::ProgressPayload;
use crate::utils::create_client;
use download::{download_with_retry, DownloadSpec};
use futures_util::stream;
use futures_util::StreamExt;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

const LIB_CONCURRENCY: usize = 12;
const ASSET_CONCURRENCY: usize = 12;
const DOWNLOAD_RETRIES: usize = 2;

mod http_cache;
mod download;
mod libraries;
mod versions;
mod assets;
mod java;

pub use http_cache::fetch_text_with_cache;
pub use download::download_file_checked;

async fn download_specs_concurrent(
    app: Option<&AppHandle>,
    specs: Vec<DownloadSpec>,
    limit: usize,
    label: &str,
    base: f64,
    span: f64,
    step: usize,
) -> Result<(), String> {
    if specs.is_empty() {
        if let Some(app) = app {
            let _ = app.emit(
                "download-progress",
                ProgressPayload {
                    task: format!("{} 0/0", label),
                    percent: base + span,
                },
            );
        }
        return Ok(());
    }

    let client = Arc::new(create_client());
    let total = specs.len();
    let mut stream = stream::iter(specs.into_iter().map(|spec| {
        let client = client.clone();
        async move { download_with_retry(client, spec, DOWNLOAD_RETRIES).await }
    }))
    .buffer_unordered(limit);

    let mut done = 0usize;
    while let Some(res) = stream.next().await {
        match res {
            Ok(()) => {}
            Err(e) => return Err(e),
        }

        done += 1;
        if let Some(app) = app {
            if done == total || done % step == 0 {
                let percent = base + (done as f64 / total as f64) * span;
                let _ = app.emit(
                    "download-progress",
                    ProgressPayload {
                        task: format!("{} {}/{}", label, done, total),
                        percent,
                    },
                );
            }
        }
    }

    Ok(())
}
pub use libraries::{download_libraries_concurrent, download_libraries_for_version_impl};
pub use versions::{download_client_impl, get_version_metadata_impl, get_versions_impl};
pub use assets::download_game_files_impl;
pub use java::download_java_impl;


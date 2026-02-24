use crate::error::AppResult;
use crate::utils::create_client;
use futures_util::StreamExt;
use sha1::{Digest, Sha1};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs as tokio_fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const DOWNLOAD_RETRIES: usize = 2;

#[derive(Clone)]
pub struct DownloadSpec {
    pub url: String,
    pub path: PathBuf,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

async fn sha1_file(path: &Path) -> AppResult<String> {
    let mut file = tokio_fs::File::open(path)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let mut hasher = Sha1::new();
    let mut buf = vec![0u8; 8192];
    loop {
        let n = file
            .read(&mut buf)
            .await
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub async fn is_valid_file(
    path: &Path,
    expected_size: Option<u64>,
    expected_sha1: Option<&str>,
    verify_sha1: bool,
) -> AppResult<bool> {
    if let Some(size) = expected_size {
        if let Ok(meta) = tokio_fs::metadata(path).await {
            if meta.len() != size {
                return Ok(false);
            }
        } else {
            return Ok(false);
        }
    }
    if verify_sha1 {
        if let Some(sha1) = expected_sha1 {
            let actual = sha1_file(path).await?;
            if actual != sha1 {
                return Ok(false);
            }
        }
    }
    Ok(true)
}

pub async fn should_download_file(
    path: &Path,
    expected_size: Option<u64>,
    expected_sha1: Option<&str>,
    verify_sha1_existing: bool,
) -> AppResult<bool> {
    if path.exists() {
        let ok = is_valid_file(path, expected_size, expected_sha1, verify_sha1_existing).await?;
        if ok {
            return Ok(false);
        }
        let _ = tokio_fs::remove_file(path).await;
    }
    Ok(true)
}

fn set_last_err(slot: &mut Option<String>, msg: String) {
    if slot.is_none() {
        *slot = Some(msg);
    }
}

pub async fn download_url_to_path(url: &str, dest: &Path) -> AppResult<()> {
    if let Some(parent) = dest.parent() {
        tokio_fs::create_dir_all(parent)
            .await
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    }
    let tmp_path = dest.with_extension("tmp");
    let client = create_client();
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?
        .error_for_status()
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let mut file = tokio_fs::File::create(&tmp_path)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        file.write_all(&chunk).await.map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    }
    let _ = file.flush().await;
    let _ = tokio_fs::remove_file(dest).await;
    tokio_fs::rename(&tmp_path, dest)
        .await
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
    Ok(())
}

pub async fn download_with_retry(
    client: Arc<reqwest::Client>,
    spec: DownloadSpec,
    retries: usize,
) -> AppResult<()> {
    let mut last_err: Option<String> = None;
    for _ in 0..=retries {
        if let Some(parent) = spec.path.parent() {
            tokio_fs::create_dir_all(parent)
                .await
                .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        }
        let tmp_path = spec.path.with_extension("tmp");
        let resp = client.get(&spec.url).send().await;
        let resp = match resp {
            Ok(r) => match r.error_for_status() {
                Ok(ok) => ok,
                Err(e) => {
                    set_last_err(&mut last_err, e.to_string());
                    continue;
                }
            },
            Err(e) => {
                set_last_err(&mut last_err, e.to_string());
                continue;
            }
        };

        let mut file = match tokio_fs::File::create(&tmp_path).await {
            Ok(f) => f,
            Err(e) => {
                set_last_err(&mut last_err, e.to_string());
                continue;
            }
        };

        let mut stream = resp.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    set_last_err(&mut last_err, e.to_string());
                    break;
                }
            };
            if let Err(e) = file.write_all(&chunk).await {
                set_last_err(&mut last_err, e.to_string());
                break;
            }
        }
        let _ = file.flush().await;

        if let Err(e) =
            is_valid_file(&tmp_path, spec.size, spec.sha1.as_deref(), spec.sha1.is_some()).await
        {
            set_last_err(&mut last_err, e.to_string());
            let _ = tokio_fs::remove_file(&tmp_path).await;
            continue;
        }

        let _ = tokio_fs::remove_file(&spec.path).await;
        if let Err(e) = tokio_fs::rename(&tmp_path, &spec.path).await {
            set_last_err(&mut last_err, e.to_string());
            let _ = tokio_fs::remove_file(&tmp_path).await;
            continue;
        }

        return Ok(());
    }

    Err(last_err.unwrap_or_else(|| "Descarga fallida".to_string()).into())
}

pub async fn download_file_checked(
    url: &str,
    dest: &Path,
    expected_size: u64,
    expected_sha1: Option<&str>,
) -> AppResult<()> {
    let path = dest.to_path_buf();
    if !should_download_file(&path, Some(expected_size), expected_sha1, true).await? {
        return Ok(());
    }
    let spec = DownloadSpec {
        url: url.to_string(),
        path,
        sha1: expected_sha1.map(|s| s.to_string()),
        size: Some(expected_size),
    };
    download_with_retry(Arc::new(create_client()), spec, DOWNLOAD_RETRIES).await
}

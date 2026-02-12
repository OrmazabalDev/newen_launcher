use crate::utils::{append_action_log, get_launcher_dir};
use reqwest::multipart::{Form, Part};
use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::AppHandle;
use zip::write::FileOptions;

#[derive(Serialize)]
struct DiagnosticInfo {
    timestamp: String,
    os: String,
    arch: String,
    app_version: String,
    launcher_dir: String,
    instance_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    instance_id: Option<String>,
}

fn add_file_to_zip(
    zip: &mut zip::ZipWriter<fs::File>,
    file_path: &std::path::Path,
    zip_name: &str,
    options: FileOptions,
) -> Result<(), String> {
    if !file_path.exists() || !file_path.is_file() {
        return Ok(());
    }
    zip.start_file(zip_name, options)
        .map_err(|e| e.to_string())?;
    let mut f = fs::File::open(file_path).map_err(|e| e.to_string())?;
    std::io::copy(&mut f, zip).map_err(|e| e.to_string())?;
    Ok(())
}

fn add_dir_recursive(
    zip: &mut zip::ZipWriter<fs::File>,
    base: &std::path::Path,
    dir: &std::path::Path,
    prefix: &str,
    options: FileOptions,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let rel = path.strip_prefix(base).map_err(|e| e.to_string())?;
        let rel_name = rel.to_string_lossy().replace('\\', "/");
        let zip_name = if prefix.is_empty() {
            rel_name
        } else {
            format!("{}/{}", prefix, rel_name)
        };

        if path.is_dir() {
            zip.add_directory(format!("{}/", zip_name), options)
                .map_err(|e| e.to_string())?;
            add_dir_recursive(zip, base, &path, prefix, options)?;
        } else {
            add_file_to_zip(zip, &path, &zip_name, options)?;
        }
    }
    Ok(())
}

fn support_endpoint() -> Result<String, String> {
    let endpoint = std::env::var("NEWEN_SUPPORT_ENDPOINT").unwrap_or_default();
    let trimmed = endpoint.trim().to_string();
    if trimmed.is_empty() {
        return Err(
            "Soporte no configurado. Define NEWEN_SUPPORT_ENDPOINT para habilitar subida."
                .to_string(),
        );
    }
    Ok(trimmed)
}

fn support_token() -> Option<String> {
    let token = std::env::var("NEWEN_SUPPORT_TOKEN").unwrap_or_default();
    let trimmed = token.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn parse_upload_response(text: &str) -> Option<String> {
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(text) {
        if let Some(url) = json.get("url").and_then(|v| v.as_str()) {
            return Some(format!("Reporte subido: {}", url));
        }
        if let Some(url) = json.get("link").and_then(|v| v.as_str()) {
            return Some(format!("Reporte subido: {}", url));
        }
        if let Some(id) = json.get("id").and_then(|v| v.as_str()) {
            return Some(format!("Reporte subido. ID: {}", id));
        }
    }
    let trimmed = text.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return Some(format!("Reporte subido: {}", trimmed));
    }
    None
}

async fn resolve_report_path(
    app: &AppHandle,
    report_path: Option<String>,
    instance_id: Option<String>,
) -> Result<PathBuf, String> {
    if let Some(path) = report_path {
        let candidate = PathBuf::from(path);
        if candidate.extension().and_then(|s| s.to_str()) != Some("zip") {
            return Err("El reporte debe ser un archivo .zip".to_string());
        }
        if !candidate.exists() {
            return Err("El reporte no existe".to_string());
        }
        return Ok(candidate);
    }

    if let Some(id) = instance_id {
        let path = generate_diagnostic_report_for_instance_impl(app, id).await?;
        return Ok(PathBuf::from(path));
    }

    let path = generate_diagnostic_report_impl(app).await?;
    Ok(PathBuf::from(path))
}

pub async fn generate_diagnostic_report_impl(app: &AppHandle) -> Result<String, String> {
    let base = get_launcher_dir(app);
    let reports_dir = base.join("reports");
    fs::create_dir_all(&reports_dir).map_err(|e| e.to_string())?;

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let zip_path = reports_dir.join(format!("diagnostic_{}.zip", timestamp));

    let instances_file = base.join("instances.json");
    let instance_count = if instances_file.exists() {
        if let Ok(raw) = fs::read_to_string(&instances_file) {
            serde_json::from_str::<Vec<serde_json::Value>>(&raw)
                .map(|v| v.len())
                .unwrap_or(0)
        } else {
            0
        }
    } else {
        0
    };

    let info = DiagnosticInfo {
        timestamp: timestamp.clone(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: app.package_info().version.to_string(),
        launcher_dir: base.to_string_lossy().to_string(),
        instance_count,
        instance_id: None,
    };

    let file = fs::File::create(&zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let json = serde_json::to_string_pretty(&info).map_err(|e| e.to_string())?;
    zip.start_file("diagnostic.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(json.as_bytes()).map_err(|e| e.to_string())?;

    add_file_to_zip(&mut zip, &instances_file, "instances.json", options)?;

    let logs_dir = base.join("logs");
    if logs_dir.exists() {
        add_dir_recursive(&mut zip, &logs_dir, &logs_dir, "logs", options)?;
    }

    zip.finish().map_err(|e| e.to_string())?;
    let _ = append_action_log(
        app,
        &format!("diagnostic_report path={}", zip_path.to_string_lossy()),
    )
    .await;
    Ok(zip_path.to_string_lossy().to_string())
}

pub async fn generate_diagnostic_report_for_instance_impl(
    app: &AppHandle,
    instance_id: String,
) -> Result<String, String> {
    let base = get_launcher_dir(app);
    let instance_dir = base.join("instances").join(&instance_id);
    if !instance_dir.exists() {
        return Err("La instancia no existe".to_string());
    }

    let reports_dir = base.join("reports");
    fs::create_dir_all(&reports_dir).map_err(|e| e.to_string())?;

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let zip_path = reports_dir.join(format!("diagnostic_{}_{}.zip", instance_id, timestamp));

    let instances_file = base.join("instances.json");
    let instance_count = if instances_file.exists() {
        if let Ok(raw) = fs::read_to_string(&instances_file) {
            serde_json::from_str::<Vec<serde_json::Value>>(&raw)
                .map(|v| v.len())
                .unwrap_or(0)
        } else {
            0
        }
    } else {
        0
    };

    let info = DiagnosticInfo {
        timestamp: timestamp.clone(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: app.package_info().version.to_string(),
        launcher_dir: base.to_string_lossy().to_string(),
        instance_count,
        instance_id: Some(instance_id.clone()),
    };

    let file = fs::File::create(&zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let json = serde_json::to_string_pretty(&info).map_err(|e| e.to_string())?;
    zip.start_file("diagnostic.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(json.as_bytes()).map_err(|e| e.to_string())?;

    add_file_to_zip(&mut zip, &instances_file, "instances.json", options)?;

    let logs_dir = base.join("logs");
    if logs_dir.exists() {
        add_dir_recursive(&mut zip, &logs_dir, &logs_dir, "logs", options)?;
    }

    let instance_logs = instance_dir.join("logs");
    if instance_logs.exists() {
        add_dir_recursive(
            &mut zip,
            &instance_logs,
            &instance_logs,
            &format!("instances/{}/logs", instance_id),
            options,
        )?;
    }

    let instance_crash = instance_dir.join("crash-reports");
    if instance_crash.exists() {
        add_dir_recursive(
            &mut zip,
            &instance_crash,
            &instance_crash,
            &format!("instances/{}/crash-reports", instance_id),
            options,
        )?;
    }

    zip.finish().map_err(|e| e.to_string())?;
    let _ = append_action_log(
        app,
        &format!(
            "diagnostic_report instance={} path={}",
            instance_id,
            zip_path.to_string_lossy()
        ),
    )
    .await;
    Ok(zip_path.to_string_lossy().to_string())
}

pub async fn upload_diagnostic_report_impl(
    app: &AppHandle,
    report_path: Option<String>,
    instance_id: Option<String>,
) -> Result<String, String> {
    let endpoint = support_endpoint()?;
    let path = if report_path.is_some() {
        resolve_report_path(app, report_path, None).await?
    } else {
        resolve_report_path(app, None, instance_id.clone()).await?
    };

    let report_bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let report_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("report.zip")
        .to_string();
    let file_part = Part::bytes(report_bytes).file_name(report_name);
    let mut form = Form::new()
        .part("report", file_part)
        .text("app_version", app.package_info().version.to_string())
        .text("os", std::env::consts::OS.to_string())
        .text("arch", std::env::consts::ARCH.to_string());

    if let Some(id) = instance_id {
        form = form.text("instance_id", id);
    }

    let client = reqwest::Client::new();
    let mut req = client.post(endpoint).multipart(form);
    if let Some(token) = support_token() {
        req = req.bearer_auth(token);
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!(
            "Soporte respondio {}: {}",
            status.as_u16(),
            body.trim()
        ));
    }

    let msg = parse_upload_response(&body).unwrap_or_else(|| "Reporte subido.".to_string());
    let _ = append_action_log(app, &format!("diagnostic_upload path={}", path.to_string_lossy()))
        .await;
    Ok(msg)
}

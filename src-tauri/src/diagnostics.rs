use crate::utils::{append_action_log, get_launcher_dir};
use serde::Serialize;
use std::fs;
use std::io::Write;
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

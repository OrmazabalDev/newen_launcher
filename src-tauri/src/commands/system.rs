use crate::diagnostics::{
    generate_diagnostic_report_for_instance_impl, upload_diagnostic_report_impl,
};
use crate::instances::touch_instance_impl;
use crate::launcher::launch_game_impl;
use crate::models::{GameSettings, SystemJava};
use crate::repair::repair_instance_impl;
use crate::state::AppState;
use crate::utils::{get_launcher_dir, hide_background_window};
use tauri::State;
use tokio::fs as tokio_fs;

#[tauri::command]
pub async fn detect_system_java() -> Result<SystemJava, String> {
    let mut cmd = std::process::Command::new("java");
    cmd.arg("-version");
    hide_background_window(&mut cmd);
    let output = cmd.output().map_err(|_| "No se encontro java en el PATH".to_string())?;

    let full_output = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    if let Some(start) = full_output.find("version \"") {
        let rest = &full_output[start + 9..];
        if let Some(end) = rest.find('"') {
            let version_str = &rest[..end];
            let major = if version_str.starts_with("1.") {
                version_str.split('.').nth(1).unwrap_or("0").parse().unwrap_or(0)
            } else {
                version_str.split('.').next().unwrap_or("0").parse().unwrap_or(0)
            };
            return Ok(SystemJava {
                valid: true,
                version: version_str.to_string(),
                major,
                path: "java".to_string(),
                message: format!("Detectado: {}", version_str),
            });
        }
    }
    Ok(SystemJava {
        valid: false,
        version: "".to_string(),
        major: 0,
        path: "".to_string(),
        message: "No detectado".to_string(),
    })
}

fn launch_hint(message: &str) -> Option<&'static str> {
    let lower = message.to_lowercase();
    if lower.contains("no has iniciado sesion") {
        return Some("Inicia sesion y vuelve a intentar.");
    }
    if lower.contains("java") || lower.contains("runtime") || lower.contains("adoptium") {
        return Some("Revisa Java o usa la descarga automatica.");
    }
    if lower.contains("metadata") || lower.contains("manifest") {
        return Some("Revisa la lista de versiones e intenta de nuevo.");
    }
    if lower.contains("no se encontro") || lower.contains("no encontrado") {
        return Some("Reinstala el loader o la version.");
    }
    if lower.contains("no se pudo obtener espacio libre") {
        return Some("Revisa permisos del disco.");
    }
    None
}

fn support_auto_upload_enabled() -> bool {
    let raw = std::env::var("NEWEN_SUPPORT_AUTO_UPLOAD").unwrap_or_default();
    let value = raw.trim().to_lowercase();
    matches!(value.as_str(), "1" | "true" | "yes" | "on")
}

#[tauri::command]
pub async fn launch_game(
    app: tauri::AppHandle,
    version_id: String,
    settings: Option<GameSettings>,
    forge_profile: Option<String>,
    instance_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let version_for_report = version_id.clone();
    if let Some(id) = &instance_id {
        let _ = touch_instance_impl(&app, id).await;
    }
    let result = launch_game_impl(
        &app,
        version_id,
        &state.manifest_cache,
        &state.metadata_cache,
        &state.current_profile,
        settings,
        forge_profile,
        instance_id.clone(),
    )
    .await;

    if let Err(err) = result {
        let err = err.to_string();
        if let Some(id) = instance_id {
            let base = get_launcher_dir(&app);
            let logs_dir = base.join("instances").join(&id).join("logs");
            let _ = tokio_fs::create_dir_all(&logs_dir).await;
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let report_path = logs_dir.join(format!("prelaunch-error-{}.log", ts));
            let body = format!(
                "Error de pre-lanzamiento\ninstance={}\nversion={}\nerror={}\n",
                id, version_for_report, err
            );
            let prelaunch_report = tokio_fs::write(&report_path, body).await.map(|_| report_path);

            let repair = repair_instance_impl(
                &app,
                id.clone(),
                &state.manifest_cache,
                &state.metadata_cache,
            )
            .await;
            let repair_msg = match repair {
                Ok(msg) => format!("Auto-repair aplicado: {}", msg),
                Err(e) => format!("Auto-repair fallo: {}", e),
            };
            let report_msg = match prelaunch_report {
                Ok(path) => format!("Log prelaunch: {}", path.to_string_lossy()),
                Err(_) => "Log prelaunch: no se pudo guardar prelaunch-error.log".to_string(),
            };
            let diagnostic = generate_diagnostic_report_for_instance_impl(&app, id.clone()).await;
            let (diagnostic_msg, diagnostic_path) = match diagnostic {
                Ok(path) => (format!("Reporte diagnostico: {}", path), Some(path)),
                Err(e) => (format!("Reporte diagnostico: no se pudo generar ({})", e), None),
            };
            let upload_msg = if support_auto_upload_enabled() {
                match diagnostic_path {
                    Some(path) => {
                        match upload_diagnostic_report_impl(&app, Some(path), Some(id.clone()))
                            .await
                        {
                            Ok(msg) => Some(format!("Soporte: {}", msg)),
                            Err(e) => Some(format!("Soporte: {}", e)),
                        }
                    }
                    None => Some("Soporte: sin reporte para subir".to_string()),
                }
            } else {
                None
            };

            let mut full = format!("{}\n{}\n{}", err, repair_msg, report_msg);
            full = format!("{}\n{}", full, diagnostic_msg);
            if let Some(up) = upload_msg {
                full = format!("{}\n{}", full, up);
            }
            if let Some(hint) = launch_hint(&full) {
                full = format!("{}\nTip: {}", full, hint);
            }
            return Err(full);
        }
        let mut msg = err;
        if let Some(hint) = launch_hint(&msg) {
            msg = format!("{}\nTip: {}", msg, hint);
        }
        return Err(msg);
    }

    Ok("Juego iniciado".to_string())
}

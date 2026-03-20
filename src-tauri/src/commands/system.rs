use crate::diagnostics::{
    generate_diagnostic_report_for_instance_impl, upload_diagnostic_report_impl,
};
use crate::instances::{get_instance_impl, touch_instance_impl};
use crate::launcher::launch_game_impl;
use crate::models::{GameSettings, LaunchRecoveryResult, LaunchRecoveryStatus, SystemJava};
use crate::repair::repair_instance_impl;
use crate::state::AppState;
use crate::utils::{get_launcher_dir, hide_background_window};
use tauri::{AppHandle, State};
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

fn requires_java_attention(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("java") || lower.contains("adoptium") || lower.contains("runtime")
}

fn launch_success_result() -> LaunchRecoveryResult {
    LaunchRecoveryResult {
        success: true,
        recovery_status: None,
        diagnostic_path: None,
        log_path: None,
        user_message: "Juego iniciado".to_string(),
        technical_message: None,
        requires_java_attention: false,
    }
}

fn launch_failure_result(err: String) -> LaunchRecoveryResult {
    let requires_java = requires_java_attention(&err);
    let mut user_message = err.clone();
    if let Some(hint) = launch_hint(&user_message) {
        user_message = format!("{}\nTip: {}", user_message, hint);
    }
    LaunchRecoveryResult {
        success: false,
        recovery_status: None,
        diagnostic_path: None,
        log_path: None,
        user_message,
        technical_message: Some(err),
        requires_java_attention: requires_java,
    }
}

async fn build_launch_recovery_result(
    app: &AppHandle,
    instance_id: String,
    version_for_report: String,
    state: &AppState,
    err: String,
) -> LaunchRecoveryResult {
    let requires_java = requires_java_attention(&err);
    let base = get_launcher_dir(app);
    let logs_dir = base.join("instances").join(&instance_id).join("logs");
    let _ = tokio_fs::create_dir_all(&logs_dir).await;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let report_path = logs_dir.join(format!("prelaunch-error-{}.log", ts));
    let body = format!(
        "Error de pre-lanzamiento\ninstance={}\nversion={}\nerror={}\n",
        instance_id, version_for_report, err
    );
    let prelaunch_report = tokio_fs::write(&report_path, body).await.map(|_| report_path);

    let repair =
        repair_instance_impl(app, instance_id.clone(), &state.manifest_cache, &state.metadata_cache)
            .await;
    let (recovery_status, repair_msg) = match repair {
        Ok(msg) => (
            Some(LaunchRecoveryStatus::AutoRepairApplied),
            format!("Reparacion automatica aplicada: {}", msg),
        ),
        Err(e) => (
            Some(LaunchRecoveryStatus::AutoRepairFailed),
            format!("La reparacion automatica fallo: {}", e),
        ),
    };
    let log_path = prelaunch_report
        .as_ref()
        .ok()
        .map(|path| path.to_string_lossy().to_string());
    let report_msg = match prelaunch_report {
        Ok(path) => format!("Log previo al lanzamiento: {}", path.to_string_lossy()),
        Err(_) => "Log previo al lanzamiento: no se pudo guardar prelaunch-error.log".to_string(),
    };
    let diagnostic = generate_diagnostic_report_for_instance_impl(app, instance_id.clone()).await;
    let (diagnostic_msg, diagnostic_path) = match diagnostic {
        Ok(path) => (
            format!("Reporte de diagnostico: {}", path),
            Some(path.to_string()),
        ),
        Err(e) => (format!("Reporte de diagnostico: no se pudo generar ({})", e), None),
    };
    let upload_msg = if support_auto_upload_enabled() {
        match diagnostic_path.clone() {
            Some(path) => {
                match upload_diagnostic_report_impl(app, Some(path), Some(instance_id)).await {
                    Ok(msg) => Some(format!("Soporte: {}", msg)),
                    Err(e) => Some(format!("Soporte: {}", e)),
                }
            }
            None => Some("Soporte: sin reporte para subir".to_string()),
        }
    } else {
        None
    };

    let mut user_message = format!("{}\n{}\n{}", err, repair_msg, report_msg);
    user_message = format!("{}\n{}", user_message, diagnostic_msg);
    if let Some(up) = upload_msg {
        user_message = format!("{}\n{}", user_message, up);
    }
    if let Some(hint) = launch_hint(&user_message) {
        user_message = format!("{}\nTip: {}", user_message, hint);
    }

    LaunchRecoveryResult {
        success: false,
        recovery_status,
        diagnostic_path,
        log_path,
        user_message,
        technical_message: Some(err),
        requires_java_attention: requires_java,
    }
}

async fn launch_with_recovery_result_impl(
    app: &AppHandle,
    version_id: String,
    settings: Option<GameSettings>,
    forge_profile: Option<String>,
    instance_id: Option<String>,
    state: &AppState,
) -> LaunchRecoveryResult {
    let version_for_report = version_id.clone();
    let result = launch_game_impl(
        app,
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
            return build_launch_recovery_result(app, id, version_for_report, state, err).await;
        }
        return launch_failure_result(err);
    }

    launch_success_result()
}

async fn launch_instance_v2_impl(
    app: &AppHandle,
    instance_id: String,
    settings: Option<GameSettings>,
    forge_profile: Option<String>,
    state: &AppState,
) -> LaunchRecoveryResult {
    let instance = match get_instance_impl(app, &instance_id).await {
        Ok(instance) => instance,
        Err(e) => return launch_failure_result(e.to_string()),
    };
    let _ = touch_instance_impl(app, &instance_id).await;
    launch_with_recovery_result_impl(
        app,
        instance.version,
        settings,
        forge_profile,
        Some(instance_id),
        state,
    )
    .await
}

#[tauri::command]
pub async fn launch_game_v2(
    app: tauri::AppHandle,
    version_id: String,
    settings: Option<GameSettings>,
    forge_profile: Option<String>,
    instance_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<LaunchRecoveryResult, String> {
    let result = if let Some(id) = instance_id {
        launch_instance_v2_impl(&app, id, settings, forge_profile, &state).await
    } else {
        launch_with_recovery_result_impl(&app, version_id, settings, forge_profile, None, &state)
            .await
    };

    Ok(result)
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
    let result = if let Some(id) = instance_id {
        launch_instance_v2_impl(&app, id, settings, forge_profile, &state).await
    } else {
        launch_with_recovery_result_impl(&app, version_id, settings, forge_profile, None, &state)
            .await
    };

    if result.success {
        Ok(result.user_message)
    } else {
        Err(result.user_message)
    }
}

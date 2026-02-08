use crate::utils::get_launcher_dir;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::AppHandle;

pub(crate) fn resolve_game_dir(
    app: &AppHandle,
    version_id: &str,
    forge_profile: Option<&str>,
    instance_id: Option<&str>,
) -> Result<PathBuf, String> {
    let base = get_launcher_dir(app);
    if let Some(id) = instance_id {
        let path = base.join("instances").join(id);
        return Ok(path);
    }
    if version_id.contains("neoforge") {
        let profile = forge_profile.unwrap_or("default");
        let path = base
            .join("profiles")
            .join("neoforge")
            .join(version_id)
            .join(profile);
        return Ok(path);
    }
    if version_id.contains("-forge-") {
        let profile = forge_profile.unwrap_or("default");
        let path = base
            .join("profiles")
            .join("forge")
            .join(version_id)
            .join(profile);
        return Ok(path);
    }
    Ok(base)
}

pub(crate) fn open_launch_log(base_dir: &PathBuf) -> Result<(PathBuf, Stdio, Stdio), String> {
    let logs_dir = base_dir.join("logs");
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    let log_path = logs_dir.join("launcher-latest.log");
    let file = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let file_err = file.try_clone().map_err(|e| e.to_string())?;
    Ok((log_path, Stdio::from(file), Stdio::from(file_err)))
}

pub(crate) async fn ensure_disk_space(
    app: &AppHandle,
    preferred_dir: &Path,
    min_bytes: u64,
) -> Result<(), String> {
    let target = if preferred_dir.exists() {
        preferred_dir.to_path_buf()
    } else {
        get_launcher_dir(app)
    };

    let target_clone = target.clone();
    let free = tokio::task::spawn_blocking(move || -> Result<u64, String> {
        free_space_bytes(&target_clone)
    })
    .await
    .map_err(|e| e.to_string())??;

    if free < min_bytes {
        return Err(format!(
            "Espacio insuficiente. Disponible: {} MB, requerido: {} MB",
            free / (1024 * 1024),
            min_bytes / (1024 * 1024)
        ));
    }
    Ok(())
}

fn free_space_bytes(path: &Path) -> Result<u64, String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        let mut free_bytes: u64 = 0;
        let mut total_bytes: u64 = 0;
        let mut total_free: u64 = 0;
        let mut wide: Vec<u16> = OsStr::new(path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let ok = unsafe {
            windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
                wide.as_mut_ptr(),
                &mut free_bytes as *mut u64,
                &mut total_bytes as *mut u64,
                &mut total_free as *mut u64,
            )
        };
        if ok == 0 {
            return Err("No se pudo obtener espacio libre".to_string());
        }
        return Ok(free_bytes);
    }

    #[cfg(unix)]
    {
        use libc::statvfs;
        use std::ffi::CString;
        let c_path = CString::new(path.to_string_lossy().to_string()).map_err(|e| e.to_string())?;
        unsafe {
            let mut stat: statvfs = std::mem::zeroed();
            if statvfs(c_path.as_ptr(), &mut stat) != 0 {
                return Err("No se pudo obtener espacio libre".to_string());
            }
            let free = stat.f_bavail as u64 * stat.f_bsize as u64;
            return Ok(free);
        }
    }

    #[cfg(not(any(unix, target_os = "windows")))]
    {
        let _ = path;
        Err("No se pudo obtener espacio libre".to_string())
    }
}

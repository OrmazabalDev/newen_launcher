use crate::models::ModrinthVersion;
use crate::utils::get_launcher_dir;
use std::path::PathBuf;
use tauri::AppHandle;

pub(super) fn instance_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    get_launcher_dir(app).join("instances").join(instance_id)
}

pub(super) fn instance_mods_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    instance_dir(app, instance_id).join("mods")
}

pub(super) fn instance_resourcepacks_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    instance_dir(app, instance_id).join("resourcepacks")
}

pub(super) fn instance_shaderpacks_dir(app: &AppHandle, instance_id: &str) -> PathBuf {
    instance_dir(app, instance_id).join("shaderpacks")
}

pub(super) fn modpack_exports_dir(app: &AppHandle) -> PathBuf {
    get_launcher_dir(app).join("exports").join("modpacks")
}

pub(super) fn pick_primary_file(
    version: &ModrinthVersion,
) -> Option<(&str, &str, u64, Option<&str>)> {
    if version.files.is_empty() {
        return None;
    }
    let file = version.files.iter().find(|f| f.primary).unwrap_or(&version.files[0]);
    let sha1 = file.hashes.get("sha1").map(|s| s.as_str());
    Some((file.url.as_str(), file.filename.as_str(), file.size, sha1))
}

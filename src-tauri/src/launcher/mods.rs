use std::fs;
use std::path::PathBuf;

struct ModScanResult {
    fabric_only: Vec<String>,
    forge_only: Vec<String>,
    neoforge_only: Vec<String>,
}

pub(crate) async fn detect_mod_loader_conflicts(
    game_dir: &PathBuf,
    is_forge: bool,
    is_neoforge: bool,
    is_fabric: bool,
) -> Result<(), String> {
    if !is_forge && !is_neoforge && !is_fabric {
        return Ok(());
    }
    let mods_dir = game_dir.join("mods");
    if !mods_dir.exists() {
        return Ok(());
    }

    let mods_dir_clone = mods_dir.clone();
    let scan = tokio::task::spawn_blocking(move || scan_mods_for_loader(&mods_dir_clone))
        .await
        .map_err(|e| e.to_string())??;

    // Forge: block Fabric-only and NeoForge-only jars.
    if is_forge && (!scan.fabric_only.is_empty() || !scan.neoforge_only.is_empty()) {
        let mut mixed = scan.fabric_only.clone();
        mixed.extend(scan.neoforge_only.clone());
        let sample = mixed.join(", ");
        return Err(format!(
            "Se detectaron mods incompatibles en una instancia Forge ({sample}). Mueve esos mods a una instancia compatible o eliminalos.",
        ));
    }

    // NeoForge: modpacks can include jars multi-loader, so only hard-block Fabric-only jars.
    if is_neoforge && !scan.fabric_only.is_empty() {
        let sample = scan.fabric_only.join(", ");
        return Err(format!(
            "Se detectaron mods Fabric en una instancia NeoForge ({sample}). Mueve esos mods a una instancia compatible o eliminalos.",
        ));
    }

    // Fabric: block Forge-only and NeoForge-only jars.
    if is_fabric && (!scan.forge_only.is_empty() || !scan.neoforge_only.is_empty()) {
        let mut mixed = scan.forge_only.clone();
        mixed.extend(scan.neoforge_only.clone());
        let sample = mixed.join(", ");
        return Err(format!(
            "Se detectaron mods incompatibles en una instancia Fabric ({sample}). Mueve esos mods a una instancia compatible o eliminalos.",
        ));
    }

    Ok(())
}

fn scan_mods_for_loader(mods_dir: &PathBuf) -> Result<ModScanResult, String> {
    let mut fabric_only = Vec::new();
    let mut forge_only = Vec::new();
    let mut neoforge_only = Vec::new();

    let entries = match fs::read_dir(mods_dir) {
        Ok(e) => e,
        Err(e) => return Err(e.to_string()),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        if ext != "jar" {
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("mod.jar")
            .to_string();

        let file = match fs::File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let mut archive = match zip::ZipArchive::new(file) {
            Ok(z) => z,
            Err(_) => continue,
        };

        let mut is_fabric = false;
        let mut has_forge_meta = false;
        let mut has_neoforge_meta = false;
        for i in 0..archive.len() {
            let name = match archive.by_index(i) {
                Ok(file) => file.name().to_string(),
                Err(_) => continue,
            };
            if name.eq_ignore_ascii_case("fabric.mod.json") {
                is_fabric = true;
            }
            if name.eq_ignore_ascii_case("META-INF/mods.toml") {
                has_forge_meta = true;
            }
            if name.eq_ignore_ascii_case("META-INF/neoforge.mods.toml") {
                has_neoforge_meta = true;
            }
            if is_fabric && has_forge_meta && has_neoforge_meta {
                break;
            }
        }

        if is_fabric && !has_forge_meta && !has_neoforge_meta && fabric_only.len() < 4 {
            fabric_only.push(file_name.clone());
        }
        if has_forge_meta && !is_fabric && !has_neoforge_meta && forge_only.len() < 4 {
            forge_only.push(file_name.clone());
        }
        if has_neoforge_meta && !is_fabric && !has_forge_meta && neoforge_only.len() < 4 {
            neoforge_only.push(file_name);
        }
    }

    Ok(ModScanResult {
        fabric_only,
        forge_only,
        neoforge_only,
    })
}

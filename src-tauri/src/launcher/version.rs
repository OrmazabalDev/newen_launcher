use crate::error::AppResult;
use crate::models::{
    JavaVersion, Library, VersionArgument, VersionArguments, VersionJson, VersionMetadata,
};
use crate::utils::get_launcher_dir;
use std::fs;
use std::sync::Mutex;
use tauri::AppHandle;

#[derive(Clone)]
pub(crate) struct ResolvedVersion {
    pub(crate) main_class: String,
    pub(crate) minecraft_arguments: Option<String>,
    pub(crate) arguments: Option<VersionArguments>,
    pub(crate) libraries: Vec<Library>,
    pub(crate) asset_index_id: String,
    pub(crate) jar: String,
    pub(crate) java_version: Option<JavaVersion>,
}

pub(crate) fn resolve_version(
    app: &AppHandle,
    version_id: &str,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> AppResult<ResolvedVersion> {
    let v = load_version_json(app, version_id, metadata_cache)?;
    if let Some(parent_id) = v.inherits_from.clone() {
        let parent = resolve_version(app, &parent_id, metadata_cache)?;
        Ok(merge_versions(parent, v))
    } else {
        Ok(to_resolved(v))
    }
}

fn load_version_json(
    app: &AppHandle,
    version_id: &str,
    metadata_cache: &Mutex<Option<VersionMetadata>>,
) -> AppResult<VersionJson> {
    let version_path = get_launcher_dir(app)
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));
    if version_path.exists() {
        let raw = fs::read_to_string(&version_path)
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        let parsed: VersionJson = serde_json::from_str(&raw)
            .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        return Ok(parsed);
    }

    let cache = metadata_cache.lock().map_err(|_| "Error cache".to_string())?;
    if let Some(meta) = &*cache {
        if meta.id == version_id {
            let value = serde_json::to_value(meta)
                .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
            let parsed: VersionJson = serde_json::from_value(value)
                .map_err(|e| crate::error::AppError::Message(e.to_string()))?;
            return Ok(parsed);
        }
    }
    Err("No se encontro version json".to_string().into())
}

fn to_resolved(v: VersionJson) -> ResolvedVersion {
    let jar = v.jar.clone().unwrap_or_else(|| v.id.clone());
    ResolvedVersion {
        main_class: v.main_class.unwrap_or_else(|| "net.minecraft.client.main.Main".to_string()),
        minecraft_arguments: v.minecraft_arguments,
        arguments: v.arguments,
        libraries: v.libraries.unwrap_or_default(),
        asset_index_id: v.asset_index.map(|a| a.id).unwrap_or_else(|| "legacy".to_string()),
        jar,
        java_version: v.java_version,
    }
}

fn merge_versions(parent: ResolvedVersion, child: VersionJson) -> ResolvedVersion {
    let mut libs = parent.libraries.clone();
    if let Some(child_libs) = &child.libraries {
        libs.extend(child_libs.clone());
    }

    let merged_args = merge_arguments(&parent.arguments, &child.arguments);
    let minecraft_arguments = child.minecraft_arguments.or(parent.minecraft_arguments);
    let main_class = child.main_class.unwrap_or(parent.main_class);
    let jar = child.jar.unwrap_or(parent.jar);
    let asset_index_id = child.asset_index.map(|a| a.id).unwrap_or(parent.asset_index_id);
    let java_version = match (child.java_version, parent.java_version) {
        (Some(c), Some(p)) => {
            if c.major_version >= p.major_version {
                Some(c)
            } else {
                Some(p)
            }
        }
        (Some(c), None) => Some(c),
        (None, Some(p)) => Some(p),
        (None, None) => None,
    };

    ResolvedVersion {
        main_class,
        minecraft_arguments,
        arguments: merged_args,
        libraries: libs,
        asset_index_id,
        jar,
        java_version,
    }
}

fn merge_arguments(
    parent: &Option<VersionArguments>,
    child: &Option<VersionArguments>,
) -> Option<VersionArguments> {
    match (parent, child) {
        (Some(p), Some(c)) => Some(VersionArguments {
            game: merge_arg_list(&p.game, &c.game),
            jvm: merge_arg_list(&p.jvm, &c.jvm),
        }),
        (Some(p), None) => Some(p.clone()),
        (None, Some(c)) => Some(c.clone()),
        (None, None) => None,
    }
}

fn merge_arg_list(
    a: &Option<Vec<VersionArgument>>,
    b: &Option<Vec<VersionArgument>>,
) -> Option<Vec<VersionArgument>> {
    let mut out = Vec::new();
    if let Some(list) = a {
        out.extend(list.clone());
    }
    if let Some(list) = b {
        out.extend(list.clone());
    }
    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

pub(crate) fn should_skip_game_jar(version_id: &str) -> bool {
    mc_minor_from_version_id(version_id) >= 17
}

pub(crate) fn mc_minor_from_version_id(version_id: &str) -> u32 {
    let base = version_id.split('-').next().unwrap_or(version_id);
    let parts: Vec<&str> = base.split('.').collect();
    parts.get(1).and_then(|v| v.parse::<u32>().ok()).unwrap_or(0)
}

pub(crate) fn extract_base_version(version_id: &str) -> String {
    if let Some((base, _)) = version_id.split_once("-forge-") {
        return base.to_string();
    }
    if let Some((base, _)) = version_id.split_once("-neoforge-") {
        return base.to_string();
    }
    if let Some(raw) = version_id.strip_prefix("neoforge-") {
        let numeric = raw.split('-').next().unwrap_or(raw);
        let mut parts = numeric.split('.');
        let minor = parts.next().and_then(|p| p.parse::<u32>().ok()).unwrap_or(0);
        let patch = parts.next().and_then(|p| p.parse::<u32>().ok()).unwrap_or(0);
        if minor > 0 {
            if patch > 0 {
                return format!("1.{}.{}", minor, patch);
            }
            return format!("1.{}", minor);
        }
    }
    if version_id.starts_with("fabric-loader-") {
        let parts: Vec<&str> = version_id.split('-').collect();
        return parts.last().unwrap_or(&version_id).to_string();
    }
    version_id.to_string()
}

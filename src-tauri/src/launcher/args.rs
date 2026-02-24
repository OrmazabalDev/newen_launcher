use crate::models::{GameSettings, MinecraftProfile, Rule, VersionArgument};
use crate::utils::{maven_artifact_path, should_download_lib};
use std::collections::{HashMap, HashSet};
use std::path::Path;

use super::version::ResolvedVersion;

pub(crate) fn build_classpath(
    resolved: &ResolvedVersion,
    base_dir: &Path,
    lib_dir: &Path,
    include_game_jar: bool,
) -> String {
    let mut cp_paths = Vec::new();
    let mut seen = HashSet::new();

    for lib in &resolved.libraries {
        if !should_download_lib(lib) {
            continue;
        }
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                let path = lib_dir.join(&artifact.path).to_string_lossy().to_string();
                if seen.insert(path.clone()) {
                    cp_paths.push(path);
                }
                continue;
            }
        }
        if let Some(path) = maven_artifact_path(&lib.name) {
            let path = lib_dir.join(path).to_string_lossy().to_string();
            if seen.insert(path.clone()) {
                cp_paths.push(path);
            }
        }
    }

    if include_game_jar {
        let jar_id = &resolved.jar;
        let client_jar = base_dir.join("versions").join(jar_id).join(format!("{}.jar", jar_id));
        let client_path = client_jar.to_string_lossy().to_string();
        if seen.insert(client_path.clone()) {
            cp_paths.push(client_path);
        }
    }

    let separator = if cfg!(windows) { ";" } else { ":" };
    cp_paths.join(separator)
}

pub(crate) fn build_arguments(
    resolved: &ResolvedVersion,
    profile: &MinecraftProfile,
    settings: &GameSettings,
    version_id: &str,
    game_dir: &Path,
    assets_dir: &Path,
    natives_dir: &Path,
    lib_dir: &Path,
    classpath: &str,
    separator: &str,
) -> (Vec<String>, Vec<String>) {
    let mut vars = HashMap::new();
    vars.insert("auth_player_name".to_string(), profile.name.clone());
    vars.insert("version_name".to_string(), version_id.to_string());
    vars.insert("game_directory".to_string(), game_dir.to_string_lossy().to_string());
    vars.insert("assets_root".to_string(), assets_dir.to_string_lossy().to_string());
    vars.insert("assets_index_name".to_string(), resolved.asset_index_id.clone());
    vars.insert("auth_uuid".to_string(), profile.id.clone());
    let access_token = profile.access_token.clone().unwrap_or_else(|| "0".to_string());
    let user_type = profile.user_type.clone().unwrap_or_else(|| "mojang".to_string());
    let auth_xuid = profile.xuid.clone().unwrap_or_else(|| "0".to_string());
    vars.insert("auth_access_token".to_string(), access_token);
    vars.insert("clientid".to_string(), "0".to_string());
    vars.insert("auth_xuid".to_string(), auth_xuid);
    vars.insert("user_properties".to_string(), "{}".to_string());
    vars.insert("user_type".to_string(), user_type);
    vars.insert("version_type".to_string(), "release".to_string());
    vars.insert("classpath".to_string(), classpath.to_string());
    vars.insert("natives_directory".to_string(), natives_dir.to_string_lossy().to_string());
    vars.insert("launcher_name".to_string(), "NewenLauncher".to_string());
    vars.insert("launcher_version".to_string(), "1.0".to_string());
    vars.insert("classpath_separator".to_string(), separator.to_string());
    vars.insert("library_directory".to_string(), lib_dir.to_string_lossy().to_string());
    vars.insert("resolution_width".to_string(), settings.resolution.width.to_string());
    vars.insert("resolution_height".to_string(), settings.resolution.height.to_string());

    let mut features = HashMap::new();
    features.insert("is_demo_user".to_string(), false);
    features.insert("has_custom_resolution".to_string(), true);
    features.insert("is_fullscreen".to_string(), settings.fullscreen);
    features.insert("has_quick_plays_support".to_string(), false);

    let mut jvm_args = if let Some(args) = &resolved.arguments {
        build_args_list(args.jvm.as_ref(), &vars, &features)
    } else {
        Vec::new()
    };

    if !settings.java_args.trim().is_empty() {
        for arg in settings.java_args.split_whitespace() {
            if !arg.trim().is_empty() {
                jvm_args.push(arg.to_string());
            }
        }
    }

    let mut min_gb = settings.memory.min_gb.max(1);
    let max_gb = settings.memory.max_gb.max(1);
    if min_gb > max_gb {
        min_gb = max_gb;
    }
    if !jvm_args.iter().any(|a| a.starts_with("-Xmx")) {
        jvm_args.insert(0, format!("-Xmx{}G", max_gb));
    }
    if !jvm_args.iter().any(|a| a.starts_with("-Xms")) {
        jvm_args.insert(0, format!("-Xms{}G", min_gb));
    }
    if !jvm_args.iter().any(|a| a.starts_with("-Djava.library.path=")) {
        jvm_args.push(format!("-Djava.library.path={}", vars["natives_directory"]));
    }
    if !jvm_args.iter().any(|a| a == "-cp" || a == "-classpath") {
        jvm_args.push("-cp".to_string());
        jvm_args.push(vars["classpath"].to_string());
    }

    let mut game_args = if let Some(args) = &resolved.arguments {
        build_args_list(args.game.as_ref(), &vars, &features)
    } else if let Some(raw) = &resolved.minecraft_arguments {
        raw.split_whitespace().filter_map(|s| normalize_arg(substitute_vars(s, &vars))).collect()
    } else {
        Vec::new()
    };

    if settings.fullscreen && !game_args.iter().any(|a| a == "--fullscreen") {
        game_args.push("--fullscreen".to_string());
    }

    (jvm_args, game_args)
}

fn normalize_arg(arg: String) -> Option<String> {
    let trimmed = arg.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut out = trimmed.to_string();
    if out.starts_with("-DFabricMcEmu=") {
        out = out.replace(' ', "");
    } else if out.starts_with("-D") {
        out = out.replace("= ", "=").replace(" =", "=");
    }
    Some(out)
}

fn build_args_list(
    args: Option<&Vec<VersionArgument>>,
    vars: &HashMap<String, String>,
    features: &HashMap<String, bool>,
) -> Vec<String> {
    let mut out = Vec::new();
    let list = match args {
        Some(a) => a,
        None => return out,
    };

    for arg in list {
        match arg {
            VersionArgument::Str(s) => {
                let value = substitute_vars(s, vars);
                if let Some(cleaned) = normalize_arg(value) {
                    out.push(cleaned);
                }
            }
            VersionArgument::Obj { rules, value } => {
                if rules_allow(rules.as_ref(), features) {
                    if let Some(v) = value {
                        for s in value_to_strings(v) {
                            let value = substitute_vars(&s, vars);
                            if let Some(cleaned) = normalize_arg(value) {
                                out.push(cleaned);
                            }
                        }
                    }
                }
            }
            VersionArgument::Any(v) => {
                for s in value_to_strings(v) {
                    let value = substitute_vars(&s, vars);
                    if let Some(cleaned) = normalize_arg(value) {
                        out.push(cleaned);
                    }
                }
            }
        }
    }
    out
}

fn rules_allow(rules: Option<&Vec<Rule>>, features: &HashMap<String, bool>) -> bool {
    let rules = match rules {
        Some(r) => r,
        None => return true,
    };
    let current_os = match std::env::consts::OS {
        "windows" => "windows",
        "macos" => "osx",
        "linux" => "linux",
        _ => "unknown",
    };

    let mut allow = false;
    for rule in rules {
        let mut applies = true;
        if let Some(os_rule) = &rule.os {
            applies = os_rule.name == current_os;
        }
        if let Some(feats) = &rule.features {
            for (k, v) in feats {
                if features.get(k).copied().unwrap_or(false) != *v {
                    applies = false;
                }
            }
        }
        if applies {
            allow = rule.action == "allow";
        }
    }
    allow
}

fn value_to_strings(v: &serde_json::Value) -> Vec<String> {
    match v {
        serde_json::Value::String(s) => vec![s.clone()],
        serde_json::Value::Array(arr) => {
            arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()
        }
        _ => Vec::new(),
    }
}

fn substitute_vars(s: &str, vars: &HashMap<String, String>) -> String {
    let mut out = s.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("${{{}}}", k), v);
    }
    out
}

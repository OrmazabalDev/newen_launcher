use crate::models::GameSettings;
use std::path::PathBuf;
use tokio::fs as tokio_fs;

pub(crate) async fn apply_options_settings(
    game_dir: &PathBuf,
    settings: &GameSettings,
    skin_pack: Option<&str>,
) -> Result<(), String> {
    let options_path = game_dir.join("options.txt");
    let mut lines: Vec<String> = Vec::new();
    if let Ok(raw) = tokio_fs::read_to_string(&options_path).await {
        lines = raw.lines().map(|s| s.to_string()).collect();
    }

    let mut found_fps = false;
    let mut resource_idx: Option<usize> = None;
    let mut incompatible_idx: Option<usize> = None;
    let mut resource_list: Vec<String> = Vec::new();

    for (idx, line) in lines.iter_mut().enumerate() {
        if line.starts_with("maxFps:") {
            *line = format!("maxFps:{}", settings.max_fps);
            found_fps = true;
        }
        if let Some(rest) = line.strip_prefix("particles:") {
            let raw = rest.trim();
            let mapped = match raw {
                "all" => "0",
                "decreased" => "1",
                "minimal" => "2",
                _ => {
                    if raw.parse::<i32>().is_ok() {
                        raw
                    } else {
                        "1"
                    }
                }
            };
            *line = format!("particles:{}", mapped);
        }
        if let Some(rest) = line.strip_prefix("resourcePacks:") {
            resource_idx = Some(idx);
            if let Ok(parsed) = serde_json::from_str::<Vec<String>>(rest) {
                resource_list = parsed;
            }
        }
        if line.starts_with("incompatibleResourcePacks:") {
            incompatible_idx = Some(idx);
        }
    }
    if !found_fps {
        lines.push(format!("maxFps:{}", settings.max_fps));
    }

    let pack_id = "file/NewenOfflineSkin";
    if let Some(_pack) = skin_pack {
        if resource_list.is_empty() {
            resource_list = vec![pack_id.to_string(), "vanilla".to_string()];
        } else {
            resource_list.retain(|p| p != pack_id);
            resource_list.insert(0, pack_id.to_string());
            if !resource_list.iter().any(|p| p == "vanilla") {
                resource_list.push("vanilla".to_string());
            }
        }
    } else {
        resource_list.retain(|p| p != pack_id);
    }

    let serialized = serde_json::to_string(&resource_list).unwrap_or_else(|_| "[]".to_string());
    let line_value = format!("resourcePacks:{}", serialized);
    if let Some(idx) = resource_idx {
        lines[idx] = line_value;
    } else {
        lines.push(line_value);
    }
    if incompatible_idx.is_none() {
        lines.push("incompatibleResourcePacks:[]".to_string());
    }

    let text = lines.join("\n");
    tokio_fs::write(&options_path, text)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

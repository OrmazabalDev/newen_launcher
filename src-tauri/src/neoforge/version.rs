use crate::error::{AppError, AppResult};
use crate::utils::create_client;

fn normalize_version_hint(raw: &str) -> String {
    let token = raw.split([' ', ',', ';']).next().unwrap_or("").trim();
    token.trim_start_matches(|c: char| !c.is_ascii_digit()).to_string()
}

fn parse_mc_version_prefix(mc_version: &str) -> AppResult<String> {
    let mut parts = mc_version.split('.');
    let major = parts
        .next()
        .ok_or_else(|| AppError::Message("Version de Minecraft invalida".to_string()))?;
    let minor = parts
        .next()
        .ok_or_else(|| AppError::Message("Version de Minecraft invalida".to_string()))?;
    let patch = parts.next().unwrap_or("0");
    if major != "1" {
        return Err("Solo se soportan versiones modernas de Minecraft (1.x)".to_string().into());
    }
    Ok(format!("{}.{}.", minor, patch))
}

fn extract_versions_from_xml(xml: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = xml;
    while let Some(start) = rest.find("<version>") {
        let s = &rest[start + "<version>".len()..];
        if let Some(end) = s.find("</version>") {
            out.push(s[..end].trim().to_string());
            rest = &s[end + "</version>".len()..];
        } else {
            break;
        }
    }
    out
}

fn compare_neoforge_version(a: &str, b: &str) -> std::cmp::Ordering {
    let parse_numbers = |s: &str| -> Vec<u32> {
        let mut out = Vec::new();
        let mut current = String::new();
        for ch in s.chars() {
            if ch.is_ascii_digit() {
                current.push(ch);
            } else if !current.is_empty() {
                out.push(current.parse::<u32>().unwrap_or(0));
                current.clear();
            }
        }
        if !current.is_empty() {
            out.push(current.parse::<u32>().unwrap_or(0));
        }
        out
    };

    let stability_rank = |s: &str| -> i32 {
        let lower = s.to_lowercase();
        if lower.contains("alpha") {
            0
        } else if lower.contains("beta") {
            1
        } else if lower.contains("snapshot") {
            -1
        } else {
            2
        }
    };

    let av = parse_numbers(a);
    let bv = parse_numbers(b);
    let max_len = av.len().max(bv.len());
    for i in 0..max_len {
        let a_i = *av.get(i).unwrap_or(&0);
        let b_i = *bv.get(i).unwrap_or(&0);
        if a_i != b_i {
            return a_i.cmp(&b_i);
        }
    }

    let a_rank = stability_rank(a);
    let b_rank = stability_rank(b);
    if a_rank != b_rank {
        return a_rank.cmp(&b_rank);
    }
    a.cmp(b)
}

async fn fetch_neoforge_versions() -> AppResult<Vec<String>> {
    let url = "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml";
    let client = create_client();
    let xml = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?
        .text()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;
    Ok(extract_versions_from_xml(&xml))
}

pub(super) async fn resolve_neoforge_build(
    mc_version: &str,
    build_override: Option<String>,
) -> AppResult<String> {
    let prefix = parse_mc_version_prefix(mc_version)?;
    let mut filtered: Vec<String> =
        fetch_neoforge_versions().await?.into_iter().filter(|v| v.starts_with(&prefix)).collect();

    if filtered.is_empty() {
        return Err(
            format!("No se encontraron builds NeoForge para Minecraft {}", mc_version).into()
        );
    }

    filtered.sort_by(|a, b| compare_neoforge_version(b, a));

    if let Some(raw) = build_override {
        let hint = normalize_version_hint(&raw);
        if !hint.is_empty() {
            if let Some(found) = filtered.iter().find(|v| *v == &hint) {
                return Ok(found.clone());
            }
            if let Some(found) =
                filtered.iter().find(|v| v.starts_with(&format!("{}{}", prefix, hint)))
            {
                return Ok(found.clone());
            }
            if let Some(found) = filtered.iter().find(|v| v.ends_with(&hint)) {
                return Ok(found.clone());
            }
        }
    }

    let stable = filtered
        .iter()
        .find(|v| {
            let lower = v.to_lowercase();
            !lower.contains("alpha") && !lower.contains("beta") && !lower.contains("snapshot")
        })
        .cloned();
    Ok(stable.unwrap_or_else(|| filtered[0].clone()))
}

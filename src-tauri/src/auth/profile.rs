use crate::models::{MCProfileResponse, MinecraftProfile};

pub(crate) fn profile_from_mc(mc_profile: MCProfileResponse) -> MinecraftProfile {
    let skin_url = pick_active_skin(&mc_profile);
    let cape_urls = pick_capes(&mc_profile);
    MinecraftProfile {
        id: mc_profile.id,
        name: mc_profile.name,
        is_offline: false,
        skin_url,
        cape_urls,
        access_token: None,
        xuid: None,
        user_type: Some("msa".to_string()),
    }
}

fn pick_active_skin(profile: &MCProfileResponse) -> Option<String> {
    profile
        .skins
        .iter()
        .find(|s| s.state.as_deref() == Some("ACTIVE"))
        .and_then(|s| s.url.clone())
        .or_else(|| profile.skins.first().and_then(|s| s.url.clone()))
}

fn pick_capes(profile: &MCProfileResponse) -> Vec<String> {
    let mut out: Vec<String> = profile.capes.iter().filter_map(|c| c.url.clone()).collect();
    out.sort();
    out.dedup();
    if let Some(active) = profile
        .capes
        .iter()
        .find(|c| c.state.as_deref() == Some("ACTIVE"))
        .and_then(|c| c.url.clone())
    {
        out.retain(|c| c != &active);
        out.insert(0, active);
    }
    out
}

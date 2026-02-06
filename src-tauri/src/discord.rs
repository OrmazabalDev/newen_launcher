use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use once_cell::sync::Lazy;
use std::sync::Mutex;

const DISCORD_APP_ID: &str = "1469454586531024906";

static DISCORD_CLIENT: Lazy<Mutex<Option<DiscordIpcClient>>> = Lazy::new(|| Mutex::new(None));

fn get_client() -> Option<DiscordIpcClient> {
    DiscordIpcClient::new(DISCORD_APP_ID).ok()
}

fn with_client<F>(mut f: F) -> Result<(), String>
where
    F: FnMut(&mut DiscordIpcClient) -> Result<(), String>,
{
    let mut guard = DISCORD_CLIENT
        .lock()
        .map_err(|_| "Discord mutex lock".to_string())?;
    if guard.is_none() {
        *guard = get_client();
    }
    if let Some(client) = guard.as_mut() {
        f(client)?;
    }
    Ok(())
}

pub fn init() -> Result<(), String> {
    with_client(|client| {
        let _ = client.connect();
        Ok(())
    })
}

pub fn set_activity(state: &str, details: &str, start_timestamp: Option<i64>) -> Result<(), String> {
    with_client(|client| {
        let _ = client.connect();
        let mut activity = activity::Activity::new().details(details).state(state);
        if let Some(ts) = start_timestamp {
            activity = activity.timestamps(activity::Timestamps::new().start(ts));
        }
        let _ = client.set_activity(activity);
        Ok(())
    })
}

pub fn clear_activity() -> Result<(), String> {
    with_client(|client| {
        let _ = client.clear_activity();
        Ok(())
    })
}

pub fn shutdown() -> Result<(), String> {
    let mut guard = DISCORD_CLIENT
        .lock()
        .map_err(|_| "Discord mutex lock".to_string())?;
    if let Some(mut client) = guard.take() {
        let _ = client.close();
    }
    Ok(())
}

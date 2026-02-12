use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use once_cell::sync::Lazy;
use std::sync::Mutex;

const DISCORD_APP_ID: &str = "1469454586531024906";

static DISCORD_CLIENT: Lazy<Mutex<Option<DiscordIpcClient>>> =
    Lazy::new(|| Mutex::new(None));

fn create_and_connect() -> Result<DiscordIpcClient, String> {
    let mut client =
        DiscordIpcClient::new(DISCORD_APP_ID).map_err(|e| e.to_string())?;

    client.connect().map_err(|e| e.to_string())?;

    Ok(client)
}

fn with_client<F>(mut f: F) -> Result<(), String>
where
    F: FnMut(&mut DiscordIpcClient) -> Result<(), String>,
{
    let mut guard = DISCORD_CLIENT
        .lock()
        .map_err(|_| "Discord mutex error".to_string())?;

    if guard.is_none() {
        match create_and_connect() {
            Ok(client) => {
                *guard = Some(client);
            }
            Err(_) => {
                // Si Discord no está abierto, no rompemos la app
                return Ok(());
            }
        }
    }

    if let Some(client) = guard.as_mut() {
        if let Err(_) = f(client) {
            // Si falla algo, reseteamos cliente
            *guard = None;
        }
    }

    Ok(())
}

pub fn init() -> Result<(), String> {
    with_client(|_| Ok(()))
}

pub fn set_activity(
    state: &str,
    details: &str,
    start_timestamp: Option<i64>,
    show_buttons: bool,
) -> Result<(), String> {
    with_client(|client| {
        let mut act = activity::Activity::new()
            .state(state)
            .details(details)
            .assets(
                activity::Assets::new()
                    .large_image("newen_icon") // debe existir en Discord Dev Portal
                    .large_text("Newen Launcher"),
            );

        if let Some(ts) = start_timestamp {
            act = act.timestamps(activity::Timestamps::new().start(ts));
        }

        if show_buttons {
            act = act.buttons(vec![
                activity::Button::new(
                    "Descargar Launcher",
                    "https://ormazabaldev.github.io/newen-web/",
                ),
                activity::Button::new(
                    "Unirse a la Comunidad",
                    "https://discord.gg/TU_INVITE",
                ),
            ]);
        }

        client.set_activity(act).map_err(|e| e.to_string())
    })
}

pub fn clear_activity() -> Result<(), String> {
    with_client(|client| {
        client.clear_activity().map_err(|e| e.to_string())
    })
}

pub fn shutdown() -> Result<(), String> {
    let mut guard = DISCORD_CLIENT
        .lock()
        .map_err(|_| "Discord mutex error".to_string())?;

    if let Some(mut client) = guard.take() {
        let _ = client.close();
    }

    Ok(())
}

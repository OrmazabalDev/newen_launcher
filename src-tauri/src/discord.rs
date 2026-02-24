use crate::error::AppResult;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

use crate::state::AppState;

const DISCORD_APP_ID: &str = "1469454586531024906";

fn create_and_connect() -> AppResult<DiscordIpcClient> {
    let mut client = DiscordIpcClient::new(DISCORD_APP_ID)
        .map_err(|e| crate::error::AppError::Message(e.to_string()))?;

    client.connect().map_err(|e| crate::error::AppError::Message(e.to_string()))?;

    Ok(client)
}

fn with_client<F>(app_state: &AppState, mut f: F) -> AppResult<()>
where
    F: FnMut(&mut DiscordIpcClient) -> AppResult<()>,
{
    let mut guard = app_state
        .discord_client
        .lock()
        .map_err(|_| crate::error::AppError::Message("Discord mutex error".to_string()))?;

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
        if f(client).is_err() {
            // Si falla algo, reseteamos cliente
            *guard = None;
        }
    }

    Ok(())
}

pub fn init(app_state: &AppState) -> AppResult<()> {
    with_client(app_state, |_| Ok(()))
}

pub fn set_activity(
    app_state: &AppState,
    state: &str,
    details: &str,
    start_timestamp: Option<i64>,
    show_buttons: bool,
) -> AppResult<()> {
    with_client(app_state, |client| {
        let mut act = activity::Activity::new().state(state).details(details).assets(
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
                activity::Button::new("Unirse a la Comunidad", "https://discord.gg/TU_INVITE"),
            ]);
        }

        client.set_activity(act).map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        Ok(())
    })
}

pub fn clear_activity(app_state: &AppState) -> AppResult<()> {
    with_client(app_state, |client| {
        client.clear_activity().map_err(|e| crate::error::AppError::Message(e.to_string()))?;
        Ok(())
    })
}

pub fn shutdown(app_state: &AppState) -> AppResult<()> {
    let mut guard = app_state
        .discord_client
        .lock()
        .map_err(|_| crate::error::AppError::Message("Discord mutex error".to_string()))?;

    if let Some(mut client) = guard.take() {
        let _ = client.close();
    }

    Ok(())
}

use crate::error::AppResult;
pub mod auth;
pub mod content;
pub mod diagnostics;
pub mod discord;
pub mod downloads;
pub mod forge;
pub mod instances;
pub mod modrinth;
pub mod skins;
pub mod system;
pub mod versions;
pub mod worlds;

pub use auth::*;
pub use content::*;
pub use diagnostics::*;
pub use discord::*;
pub use downloads::*;
pub use forge::*;
pub use instances::*;
pub use modrinth::*;
pub use skins::*;
pub use system::*;
pub use versions::*;
pub use worlds::*;

pub(crate) fn map_app_result<T>(result: AppResult<T>) -> Result<T, String> {
    result.map_err(|e| e.to_string())
}

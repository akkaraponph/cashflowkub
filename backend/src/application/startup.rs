//! Runtime composition for the application.
use crate::{
    adapters::outbound::postgres,
    config::{AppState, Config},
    seed::{SeedAccounts, ensure_seed_accounts},
};

/// Build the runtime state and apply the explicitly configured local seed.
///
/// This is the composition seam: infrastructure adapters are selected here,
/// before the inbound HTTP adapter receives application state.
pub async fn build_state(config: Config) -> Result<AppState, Box<dyn std::error::Error>> {
    let pool = postgres::connect(&config.database_url).await?;
    if let Some(accounts) = SeedAccounts::from_env()? {
        ensure_seed_accounts(&pool, &accounts).await?;
        eprintln!(
            "Configured seed accounts are ready; their passwords are reset on every backend start."
        );
    }
    Ok(AppState {
        pool,
        service_token: config.service_token,
        encryption_key: config.encryption_key,
    })
}

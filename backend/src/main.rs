use cashflowkub_backend::{
    app::app,
    config::{AppState, Config},
    db,
    seed::{SeedAccounts, ensure_seed_accounts},
};
use std::net::SocketAddr;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env_file = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    if env_file.exists() {
        dotenvy::from_path(env_file)?;
    }
    let config = Config::from_env()?;
    let pool = db::connect(&config.database_url).await?;
    let address: SocketAddr = config.bind_address.parse()?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    if let Some(accounts) = SeedAccounts::from_env()? {
        ensure_seed_accounts(&pool, &accounts).await?;
        eprintln!(
            "Configured seed accounts are ready; their passwords are reset on every backend start."
        );
    }
    let state = AppState {
        pool,
        service_token: config.service_token,
        encryption_key: config.encryption_key,
    };
    axum::serve(listener, app(state))
        .with_graceful_shutdown(shutdown())
        .await?;
    Ok(())
}

async fn shutdown() {
    let _ = tokio::signal::ctrl_c().await;
}

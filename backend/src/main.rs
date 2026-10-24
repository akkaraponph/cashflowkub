use cashflowkub_backend::{
    adapters::inbound::http::app, application::startup::build_state, config::Config,
};
use std::net::SocketAddr;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env_file = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    if env_file.exists() {
        dotenvy::from_path(env_file)?;
    }
    let config = Config::from_env()?;
    let address: SocketAddr = config.bind_address.parse()?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    let state = build_state(config).await?;
    axum::serve(listener, app(state))
        .with_graceful_shutdown(shutdown())
        .await?;
    Ok(())
}

async fn shutdown() {
    let _ = tokio::signal::ctrl_c().await;
}

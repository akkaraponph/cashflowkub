use cashflowkub_backend::{
    app::app,
    config::{AppState, Config},
    db,
};
use std::net::SocketAddr;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::from_env()?;
    let pool = db::connect(&config.database_url).await?;
    let address: SocketAddr = config.bind_address.parse()?;
    let listener = tokio::net::TcpListener::bind(address).await?;
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

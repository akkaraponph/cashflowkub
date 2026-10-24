//! PostgreSQL connection adapter.
//!
//! SQLx pool creation is kept here so application startup does not own the
//! database driver configuration. Feature query implementations are the
//! existing persistence adapter and will be moved here as use cases are
//! separated from their SQL.
use sqlx::{PgPool, postgres::PgPoolOptions};

pub async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
}

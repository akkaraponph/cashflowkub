use axum::{Json, Router, routing::get};
use serde::Serialize;

use crate::config::AppState;

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/internal/health", get(health))
        .with_state(state)
}

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

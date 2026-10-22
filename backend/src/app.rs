use axum::{Json, Router, routing::get};
use serde::Serialize;

use crate::{config::AppState, reference, transactions};

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/internal/health", get(health))
        .merge(transactions::internal_routes())
        .nest("/api/v1", reference::routes())
        .merge(transactions::public_routes())
        .with_state(state)
}

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

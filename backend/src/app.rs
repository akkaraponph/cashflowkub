use axum::{Json, Router, routing::get};
use serde::Serialize;

use crate::{
    analytics, bills, config::AppState, debts, export, plan, reference, tax, transactions,
};

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/internal/health", get(health))
        .merge(transactions::internal_routes())
        .merge(debts::internal_routes())
        .merge(bills::routes())
        .merge(plan::routes())
        .merge(debts::public_routes())
        .merge(tax::routes())
        .merge(analytics::routes())
        .merge(export::routes())
        .nest("/api/v1", reference::routes())
        .merge(transactions::public_routes())
        .with_state(state)
}

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

//! Axum is the HTTP inbound adapter and owns endpoint registration.
//!
//! Feature route groups are composed here. Their legacy handlers currently
//! still contain persistence calls and are a migration target for ports.
use axum::{Json, Router, routing::get};
use serde::Serialize;

use crate::{
    analytics, bills, config::AppState, debts, export, plan, reference, tax, transactions,
};

#[derive(Serialize)]
pub struct Health {
    pub status: &'static str,
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

pub async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

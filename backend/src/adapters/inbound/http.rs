//! Axum is the HTTP inbound adapter and owns endpoint registration.
//!
//! Feature route groups are composed here. Their legacy handlers currently
//! still contain persistence calls and are a migration target for ports.
use axum::{
    Json, Router,
    body::Body,
    http::Request,
    middleware::{self, Next},
    response::Response,
    routing::get,
};
use serde::Serialize;
use std::time::Instant;

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
        .layer(middleware::from_fn(log_request))
        .with_state(state)
}

async fn log_request(request: Request<Body>, next: Next) -> Response {
    let method = request.method().clone();
    // Exclude query parameters: they may contain private filters or values.
    let path = request.uri().path().to_owned();
    let started = Instant::now();
    let response = next.run(request).await;
    eprintln!(
        "[rust-api] {method} {path} -> {} in {}ms",
        response.status().as_u16(),
        started.elapsed().as_millis()
    );
    response
}

pub async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

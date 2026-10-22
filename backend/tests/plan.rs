use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use cashflowkub_backend::{app::app, config::AppState};
use secrecy::SecretString;
use serde_json::{Value, json};
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};
use tower::ServiceExt;
static NEXT: AtomicU64 = AtomicU64::new(1);
const TOKEN: &str = "plan-test-token";
async fn db() -> (PgPool, String) {
    let url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL required");
    let u = url::Url::parse(&url).unwrap();
    assert!(
        matches!(u.host_str(), Some("localhost" | "127.0.0.1" | "::1"))
            && u.path().ends_with("_test")
    );
    let pool = PgPoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await
        .unwrap();
    let id = format!(
        "rust-plan-{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    );
    sqlx::query("INSERT INTO users(id,name,email,privacy_version,privacy_accepted_at) VALUES($1,'plan test',$2,'test',now())").bind(&id).bind(format!("{id}@test.local")).execute(&pool).await.unwrap();
    (pool, id)
}
fn router(pool: PgPool) -> axum::Router {
    app(AppState {
        pool,
        service_token: SecretString::from(TOKEN),
        encryption_key: [7; 32],
    })
}
async fn call(
    pool: &PgPool,
    user: &str,
    method: &str,
    uri: &str,
    body: Value,
) -> (StatusCode, Value) {
    let req = Request::builder()
        .method(method)
        .uri(uri)
        .header("authorization", format!("Bearer {TOKEN}"))
        .header("x-cfk-user-id", user)
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap();
    let r = router(pool.clone()).oneshot(req).await.unwrap();
    let status = r.status();
    let b = axum::body::to_bytes(r.into_body(), usize::MAX)
        .await
        .unwrap();
    (
        status,
        if b.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&b).unwrap()
        },
    )
}
async fn cleanup(pool: &PgPool, user: &str) {
    sqlx::query("DELETE FROM users WHERE id=$1")
        .bind(user)
        .execute(pool)
        .await
        .unwrap();
}
#[tokio::test]
async fn plan_groups_totals_and_invalid_month_match_existing_contract() {
    let (pool, user) = db().await;
    for (ty, name, planned, actual) in [
        ("income", "Salary", 100, 90),
        ("expense", "Rent", 30, 20),
        ("savings", "Save", 20, 10),
    ] {
        let (s, row) = call(
            &pool,
            &user,
            "POST",
            "/api/v1/plan",
            json!({"type":ty,"name":name,"month":"2026-06","planned":planned,"actual":actual}),
        )
        .await;
        assert_eq!(s, StatusCode::CREATED, "{row}");
    }
    let (s, p) = call(
        &pool,
        &user,
        "GET",
        "/api/v1/plan?month=2026-06",
        Value::Null,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(p["summary"]["plannedNet"], 50);
    assert_eq!(p["summary"]["actualNet"], 60);
    assert_eq!(p["summary"]["netVariance"], 10);
    let (s, _) = call(&pool, &user, "GET", "/api/v1/plan?month=June", Value::Null).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    cleanup(&pool, &user).await;
}
#[tokio::test]
async fn plan_and_snapshot_reads_are_tenant_scoped_and_ordered() {
    let (pool, user) = db().await;
    let (other_pool, other) = db().await;
    sqlx::query("INSERT INTO plan_items(type,name,planned,actual,month,sort,user_id) VALUES('expense','A',10,5,'2026-06',0,$1),('expense','B',20,10,'2026-06',0,$1)").bind(&user).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO asset_snapshots(name,grp,prev,curr,month,sort,user_id) VALUES('Cash','bank',10,20,'2026-06',1,$1),('Fund','invest',30,40,'2026-06',2,$1),('Bank','bank',5,7,'2026-06',3,$1)").bind(&user).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO net_worth_histories(month,month_th,value,sort,user_id) VALUES('2026-05','พ.ค. 2026',10,1,$1),('2026-06','มิ.ย. 2026',20,2,$1)").bind(&user).execute(&pool).await.unwrap();
    let (_, p) = call(
        &pool,
        &user,
        "GET",
        "/api/v1/plan?month=2026-06",
        Value::Null,
    )
    .await;
    assert_eq!(p["expense"]["items"][0]["name"], "A");
    assert_eq!(p["expense"]["items"][1]["name"], "B");
    let (_, own) = call(&pool, &user, "GET", "/api/v1/plan", Value::Null).await;
    let (_, foreign) = call(&other_pool, &other, "GET", "/api/v1/plan", Value::Null).await;
    assert_eq!(own["expense"]["items"].as_array().unwrap().len(), 2);
    assert_eq!(foreign["expense"]["items"], json!([]));
    let (_, snap) = call(&pool, &user, "GET", "/api/v1/plan/snapshots", Value::Null).await;
    assert_eq!(snap["groups"][0]["group"], "bank");
    assert_eq!(snap["groups"][0]["prev"], 15);
    assert_eq!(snap["prev"], 45);
    assert_eq!(snap["curr"], 67);
    assert_eq!(snap["history"][1]["month"], "2026-06");
    cleanup(&pool, &user).await;
    cleanup(&other_pool, &other).await;
}

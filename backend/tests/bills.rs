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
const TOKEN: &str = "bills-test-token";
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
        "rust-bill-{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    );
    sqlx::query("INSERT INTO users(id,name,email,privacy_version,privacy_accepted_at) VALUES($1,'bill test',$2,'test',now())").bind(&id).bind(format!("{id}@test.local")).execute(&pool).await.unwrap();
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
fn body() -> Value {
    json!({"name":"Quarterly insurance","amount":3000,"dueDay":31,"everyMonths":3,"startMonth":"2026-06"})
}
#[tokio::test]
async fn recurring_bill_due_day_and_monthly_paid_state_match_existing_contract() {
    let (pool, user) = db().await;
    let (s, b) = call(&pool, &user, "POST", "/api/v1/bills", body()).await;
    assert_eq!(s, StatusCode::CREATED, "{b}");
    assert_eq!(b["dueDate"], "2026-06-30");
    assert_eq!(b["status"], "upcoming");
    let id = b["id"].as_i64().unwrap();
    let (s, rows) = call(
        &pool,
        &user,
        "GET",
        "/api/v1/bills?month=2026-09&status=unpaid",
        Value::Null,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(rows["data"].as_array().unwrap().len(), 1);
    let (_s, off) = call(
        &pool,
        &user,
        "GET",
        "/api/v1/bills?month=2026-07",
        Value::Null,
    )
    .await;
    assert_eq!(off["data"], json!([]));
    let (s, paid) = call(
        &pool,
        &user,
        "PATCH",
        &format!("/api/v1/bills/{id}/pay"),
        json!({"paid":true,"month":"2026-09"}),
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(paid["status"], "paid");
    let (_, june) = call(
        &pool,
        &user,
        "GET",
        "/api/v1/bills?month=2026-06",
        Value::Null,
    )
    .await;
    assert_eq!(june["data"][0]["paid"], false);
    let (_, sept) = call(
        &pool,
        &user,
        "GET",
        "/api/v1/bills?month=2026-09",
        Value::Null,
    )
    .await;
    assert_eq!(sept["data"][0]["paid"], true);
    cleanup(&pool, &user).await;
}
#[tokio::test]
async fn rejects_invalid_month_and_non_occurring_payment() {
    let (pool, user) = db().await;
    let (s, _e) = call(
        &pool,
        &user,
        "GET",
        "/api/v1/bills?month=2026-13",
        Value::Null,
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (_, b) = call(&pool, &user, "POST", "/api/v1/bills", body()).await;
    let id = b["id"].as_i64().unwrap();
    let (s, e) = call(
        &pool,
        &user,
        "PATCH",
        &format!("/api/v1/bills/{id}/pay"),
        json!({"paid":true,"month":"2026-05"}),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    assert_eq!(e["code"], "billNotInMonth");
    cleanup(&pool, &user).await;
}
#[tokio::test]
async fn bill_payment_write_failure_leaves_no_payment() {
    let (pool, user) = db().await;
    let (_, bill) = call(&pool, &user, "POST", "/api/v1/bills", body()).await;
    let id = bill["id"].as_i64().unwrap();
    let suffix = user.replace('-', "_");
    let function = format!("fail_bill_payment_{suffix}");
    let trigger = format!("trigger_bill_payment_{suffix}");
    let sql = format!(
        "CREATE FUNCTION {function}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.bill_id = {id} THEN RAISE EXCEPTION 'injected payment failure'; END IF; RETURN NEW; END $$"
    );
    sqlx::query(&sql).execute(&pool).await.unwrap();
    let sql = format!(
        "CREATE TRIGGER {trigger} BEFORE INSERT ON bill_payments FOR EACH ROW EXECUTE FUNCTION {function}()"
    );
    sqlx::query(&sql).execute(&pool).await.unwrap();
    let (status, _) = call(
        &pool,
        &user,
        "PATCH",
        &format!("/api/v1/bills/{id}/pay"),
        json!({"paid":true}),
    )
    .await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM bill_payments WHERE bill_id=$1")
        .bind(id as i32)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    sqlx::query(&format!("DROP TRIGGER {trigger} ON bill_payments"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(&format!("DROP FUNCTION {function}()"))
        .execute(&pool)
        .await
        .unwrap();
    cleanup(&pool, &user).await;
}

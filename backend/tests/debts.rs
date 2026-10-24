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
const TOKEN: &str = "debts-test-token";
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
        "rust-debt-{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    );
    sqlx::query("INSERT INTO users(id,name,email,privacy_version,privacy_accepted_at) VALUES($1,'debt test',$2,'test',now())").bind(&id).bind(format!("{id}@test.local")).execute(&pool).await.unwrap();
    (pool, id)
}
fn router(pool: PgPool) -> axum::Router {
    app(AppState {
        pool,
        service_token: SecretString::from(TOKEN),
        encryption_key: [9; 32],
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
async fn debt_payment_allocates_fee_then_interest_then_principal_and_syncs_balance() {
    let (pool, user) = db().await;
    let(status,debt)=call(&pool,&user,"POST","/api/v1/debts",json!({"name":"Personal loan","original":10000,"apr":12,"calc":"reducing","monthly":1000,"dueDay":5,"lateFee":100})).await;
    assert_eq!(status, StatusCode::CREATED, "{debt}");
    let id = debt["id"].as_i64().unwrap();
    let (status, result) = call(
        &pool,
        &user,
        "POST",
        &format!("/api/v1/debts/{id}/payments"),
        json!({"amount":1200,"date":"2026-06-18","note":"repayment"}),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{result}");
    assert_eq!(result["payment"]["amount"], 1200);
    assert_eq!(result["payment"]["fee"], 100);
    assert_eq!(result["payment"]["interest"], 100);
    assert_eq!(result["payment"]["principal"], 1000);
    assert_eq!(result["debt"]["paid"], 1000);
    assert_eq!(result["excess"], 0);
    cleanup(&pool, &user).await;
}
#[tokio::test]
async fn debt_list_and_private_detail_are_scoped_to_the_verified_user() {
    let (pool, user) = db().await;
    let (_, debt) = call(
        &pool,
        &user,
        "POST",
        "/api/v1/debts",
        json!({"name":"Only mine","original":5000,"monthly":500}),
    )
    .await;
    let id = debt["id"].as_i64().unwrap();
    let (_, rows) = call(
        &pool,
        &user,
        "GET",
        "/api/v1/debts?status=active",
        Value::Null,
    )
    .await;
    assert_eq!(rows["data"].as_array().unwrap().len(), 1);
    let (status, detail) = call(
        &pool,
        &user,
        "GET",
        &format!("/internal/v1/debts/{id}/detail"),
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{detail}");
    assert_eq!(detail["debt"]["name"], "Only mine");
    assert_eq!(detail["schedule"][0]["month"], 1);
    cleanup(&pool, &user).await;
}
#[tokio::test]
async fn debt_payment_failure_rolls_back_ledger_and_paid_balance() {
    let (pool, user) = db().await;
    let (_, debt) = call(
        &pool,
        &user,
        "POST",
        "/api/v1/debts",
        json!({"name":"Rollback loan","original":5000,"monthly":500}),
    )
    .await;
    let id = debt["id"].as_i64().unwrap();
    let suffix = user.replace('-', "_");
    let function = format!("fail_debt_payment_{suffix}");
    let trigger = format!("trigger_debt_payment_{suffix}");
    sqlx::query(&format!("CREATE FUNCTION {function}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.debt_id={id} THEN RAISE EXCEPTION 'injected payment failure'; END IF; RETURN NEW; END $$")).execute(&pool).await.unwrap();
    sqlx::query(&format!("CREATE TRIGGER {trigger} BEFORE INSERT ON debt_payments FOR EACH ROW EXECUTE FUNCTION {function}()")).execute(&pool).await.unwrap();
    let (status, _) = call(
        &pool,
        &user,
        "POST",
        &format!("/api/v1/debts/{id}/payments"),
        json!({"amount":1000}),
    )
    .await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    let paid: i32 = sqlx::query_scalar("SELECT paid FROM debts WHERE id=$1 AND user_id=$2")
        .bind(id as i32)
        .bind(&user)
        .fetch_one(&pool)
        .await
        .unwrap();
    let count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM debt_payments WHERE debt_id=$1 AND user_id=$2")
            .bind(id as i32)
            .bind(&user)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(paid, 0);
    assert_eq!(count, 0);
    sqlx::query(&format!("DROP TRIGGER {trigger} ON debt_payments"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(&format!("DROP FUNCTION {function}()"))
        .execute(&pool)
        .await
        .unwrap();
    cleanup(&pool, &user).await;
}

#[tokio::test]
async fn preserves_final_installment_planning_and_thai_payoff_year() {
    let (pool, user) = db().await;
    let (status, debt) = call(
        &pool,
        &user,
        "POST",
        "/api/v1/debts",
        json!({"name":"Final payment","original":1000,"openingPaid":900,"monthly":500,"dueDay":31}),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{debt}");
    assert_eq!(debt["installment"], 100);
    assert_eq!(debt["payoffTh"], "ก.ค. 2026");
    let (_, plan) = call(&pool, &user, "GET", "/api/v1/debts/dsr", Value::Null).await;
    assert_eq!(plan["dsr"]["monthlyDebt"], 100);
    let (_, comparison) = call(
        &pool,
        &user,
        "GET",
        "/api/v1/debts/strategy?strategy=custom",
        Value::Null,
    )
    .await;
    assert_eq!(comparison["baseline"]["strategy"], "custom");
    let (invalid, body) = call(&pool, &user, "GET", "/api/v1/debts/abc", Value::Null).await;
    assert_eq!(invalid, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "invalid id: abc");
    cleanup(&pool, &user).await;
}

#[tokio::test]
async fn concurrent_payments_reopen_after_deletion_and_hide_other_users_rows() {
    let (pool, user) = db().await;
    let (_, other) = db().await;
    let (status, debt) = call(
        &pool,
        &user,
        "POST",
        "/api/v1/debts",
        json!({"name":"Scoped loan","original":1000,"monthly":100,"lender":"private lender"}),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{debt}");
    let id = debt["id"].as_i64().unwrap();
    let path = format!("/api/v1/debts/{id}/payments");
    let (one, two) = tokio::join!(
        call(
            &pool,
            &user,
            "POST",
            &path,
            json!({"amount":1000,"note":"private note"})
        ),
        call(&pool, &user, "POST", &path, json!({"amount":1000}))
    );
    assert!(
        (one.0 == StatusCode::CREATED && two.0 == StatusCode::CONFLICT)
            || (two.0 == StatusCode::CREATED && one.0 == StatusCode::CONFLICT)
    );
    let success = if one.0 == StatusCode::CREATED {
        one.1
    } else {
        two.1
    };
    let pid = success["payment"]["id"].as_i64().unwrap();
    let (status, _) = call(
        &pool,
        &other,
        "DELETE",
        &format!("{path}/{pid}"),
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (_, rows) = call(&pool, &other, "GET", "/api/v1/debts", Value::Null).await;
    assert_eq!(rows["data"], json!([]));
    let (status, _) = call(
        &pool,
        &other,
        "GET",
        &format!("/internal/v1/debts/{id}/detail"),
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (_, reopened) = call(
        &pool,
        &user,
        "DELETE",
        &format!("{path}/{pid}"),
        Value::Null,
    )
    .await;
    assert_eq!(reopened["paid"], 0);
    assert_eq!(reopened["done"], false);
    cleanup(&pool, &user).await;
    cleanup(&pool, &other).await;
}

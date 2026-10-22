use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use cashflowkub_backend::{app::app, config::AppState};
use secrecy::SecretString;
use serde_json::{Value, json};
use sqlx::{PgPool, postgres::PgPoolOptions};
use tower::ServiceExt;

const KEY: [u8; 32] = [7; 32];
const TOKEN: &str = "transactions-test-token";
static NEXT_USER: AtomicU64 = AtomicU64::new(1);

async fn database() -> (PgPool, String) {
    let url = std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must point at the disposable *_test database");
    let parsed = url::Url::parse(&url).expect("valid TEST_DATABASE_URL");
    assert!(matches!(
        parsed.host_str(),
        Some("localhost" | "127.0.0.1" | "::1")
    ));
    assert!(parsed.path().ends_with("_test"));
    let pool = PgPoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await
        .unwrap();
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let user = format!(
        "rust-tx-{suffix}-{}",
        NEXT_USER.fetch_add(1, Ordering::Relaxed)
    );
    sqlx::query("INSERT INTO users (id,name,email,privacy_version,privacy_accepted_at) VALUES ($1,'Rust tx test',$2,'test',now())")
        .bind(&user).bind(format!("{user}@test.local")).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO accounts (name,user_id) VALUES ('Wallet',$1),('Bank',$1)")
        .bind(&user)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO categories (key,label,sub,user_id) VALUES ('food','Food','need',$1),('income','Income','',$1)")
        .bind(&user).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO income_categories (name,user_id) VALUES ('Salary',$1)")
        .bind(&user)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO channels (name,user_id) VALUES ('Fund',$1)")
        .bind(&user)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO debts (name,original,user_id) VALUES ('Loan',10000,$1)")
        .bind(&user)
        .execute(&pool)
        .await
        .unwrap();
    (pool, user)
}

fn router(pool: PgPool) -> axum::Router {
    app(AppState {
        pool,
        service_token: SecretString::from(TOKEN.to_owned()),
        encryption_key: KEY,
    })
}

async fn request(
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
    let response = router(pool.clone()).oneshot(req).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap()
    };
    (status, value)
}

async fn cleanup(pool: &PgPool, user: &str) {
    sqlx::query("DELETE FROM users WHERE id=$1")
        .bind(user)
        .execute(pool)
        .await
        .unwrap();
}

fn create_body(activity: &str, item: &str, amount: f64, name: &str) -> Value {
    let cat = if activity == "pay" { "food" } else { "" };
    json!({"name":name,"activity":activity,"item":item,"cat":cat,"acct":" wallet ","amount":amount,"note":"private note","date":"2026-06-18"})
}

#[tokio::test]
async fn supports_all_six_activities_with_signed_amounts_and_verified_references() {
    let (pool, user) = database().await;
    let cases = [
        ("receive", "Salary", 100.0, "income"),
        ("pay", "", -20.25, "food"),
        ("save", "Fund", -30.0, "saving"),
        ("pay_debt", "Loan", -40.0, "debt"),
        ("withdraw", "Fund", 50.0, ""),
        ("transfer", "Bank", 60.0, ""),
    ];
    for (activity, item, amount, category) in cases {
        let (status, row) = request(
            &pool,
            &user,
            "POST",
            "/api/v1/transactions",
            create_body(activity, item, amount, activity),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED, "{activity}: {row}");
        assert_eq!(row["activity"], activity);
        assert_eq!(row["item"], item);
        assert_eq!(row["cat"], category);
        assert_eq!(row["acct"], "Wallet");
        assert_eq!(row["amount"], amount);
    }
    cleanup(&pool, &user).await;
}

#[tokio::test]
async fn keeps_decimal_ciphertext_and_calendar_date_while_listing_pages() {
    let (pool, user) = database().await;
    let (status, created) = request(
        &pool,
        &user,
        "POST",
        "/api/v1/transactions",
        create_body("pay", "", -45.5, "Coffee"),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["amount"], -45.5);
    assert_eq!(created["isoDate"], "2026-06-18");
    assert_eq!(created["group"], "Today");
    assert_eq!(created["name"], "Coffee");
    let id = created["id"].as_i64().unwrap() as i32;
    let raw = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT name,note,date::text,amount::text FROM transactions WHERE user_id=$1 AND id=$2",
    )
    .bind(&user)
    .bind(id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(raw.0.starts_with("enc:v1:"));
    assert!(raw.1.starts_with("enc:v1:"));
    assert_eq!(raw.2, "2026-06-18");
    assert_eq!(raw.3, "-45.50");
    let (status, page) = request(
        &pool,
        &user,
        "GET",
        "/internal/v1/transactions/page?page=9&size=1&from=2026-06-18&type=expense",
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(page["total"], 1);
    assert_eq!(page["page"], 1);
    assert_eq!(page["rows"][0]["id"], id);
    let (status, list) = request(
        &pool,
        &user,
        "GET",
        "/api/v1/transactions?limit=1&offset=0",
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(list["data"][0]["name"], "Coffee");
    cleanup(&pool, &user).await;
}

#[tokio::test]
async fn batch_create_is_atomic_and_batch_delete_skips_other_users() {
    let (pool, user) = database().await;
    let (other_pool, other) = database().await;
    let valid = create_body("pay", "", -1.0, "ok");
    let invalid = create_body("save", "missing", -2.0, "bad");
    let (status, _) = request(
        &pool,
        &user,
        "POST",
        "/api/v1/transactions/batch",
        json!({"items":[valid.clone(),invalid]}),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM transactions WHERE user_id=$1")
        .bind(&user)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    let (_, foreign) = request(
        &other_pool,
        &other,
        "POST",
        "/api/v1/transactions",
        valid.clone(),
    )
    .await;
    let (status, created) = request(&pool, &user, "POST", "/api/v1/transactions", valid).await;
    assert_eq!(status, StatusCode::CREATED);
    let ids = json!({"ids":[created["id"],foreign["id"]]});
    let (status, deleted) =
        request(&pool, &user, "DELETE", "/api/v1/transactions/batch", ids).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(deleted["deleted"], 1);
    let foreign_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM transactions WHERE user_id=$1")
            .bind(&other)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(foreign_count, 1);
    cleanup(&pool, &user).await;
    cleanup(&other_pool, &other).await;
}

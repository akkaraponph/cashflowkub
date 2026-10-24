use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use cashflowkub_backend::{app::app, config::AppState, crypto::encrypt_field};
use secrecy::SecretString;
use serde_json::{Value, json};
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};
use tower::ServiceExt;

static NEXT: AtomicU64 = AtomicU64::new(1);
const TOKEN: &str = "tax-analytics-test-token";
const KEY: [u8; 32] = [11; 32];
async fn pool() -> PgPool {
    let url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL required");
    let parsed = url::Url::parse(&url).unwrap();
    assert!(
        matches!(parsed.host_str(), Some("localhost" | "127.0.0.1" | "::1"))
            && parsed.path().ends_with("_test")
    );
    PgPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .unwrap()
}
async fn user(pool: &PgPool) -> String {
    let id = format!(
        "rust-agg-{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    );
    sqlx::query("INSERT INTO users(id,name,email,privacy_version,privacy_accepted_at) VALUES($1,'aggregate test',$2,'test',now())").bind(&id).bind(format!("{id}@test.local")).execute(pool).await.unwrap();
    id
}
async fn call(
    pool: &PgPool,
    user: &str,
    method: &str,
    uri: &str,
    body: Value,
) -> (StatusCode, Value) {
    let state = AppState {
        pool: pool.clone(),
        service_token: SecretString::from(TOKEN),
        encryption_key: KEY,
    };
    let req = Request::builder()
        .method(method)
        .uri(uri)
        .header("authorization", format!("Bearer {TOKEN}"))
        .header("x-cfk-user-id", user)
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap();
    let response = app(state).oneshot(req).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (
        status,
        if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        },
    )
}
async fn cleanup(pool: &PgPool, ids: &[String]) {
    for id in ids {
        sqlx::query("DELETE FROM users WHERE id=$1")
            .bind(id)
            .execute(pool)
            .await
            .unwrap();
    }
}

#[tokio::test]
async fn tax_fallback_saved_plans_and_aggregate_reads_are_user_scoped() {
    let pool = pool().await;
    let a = user(&pool).await;
    let b = user(&pool).await;
    sqlx::query("INSERT INTO monthly_cashflows(user_id,month,income,expense,sort) VALUES($1,'2026-06',5000,1000,1),($2,'2026-06',90000,0,1)").bind(&a).bind(&b).execute(&pool).await.unwrap();
    let (status, plan) = call(&pool, &a, "GET", "/api/v1/tax?year=2026", Value::Null).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(plan["input"]["salary"], 60_000);
    assert_eq!(plan["assumed"], true);
    let (status,_)=call(&pool,&a,"PUT","/api/v1/tax?year=2025",json!({"salary":600000,"freelance":0,"otherNet":0,"withheld":20000,"spouse":false,"children":0,"children2018Extra":0,"parents":0,"disabledDependents":0,"maternity":0,"socialSecurity":9000,"lifeInsurance":0,"healthInsurance":0,"parentHealthInsurance":0,"pensionInsurance":0,"pvd":0,"gpf":0,"nsf":0,"rmf":0,"ssf":0,"thaiEsg":0,"homeLoanInterest":0,"easyEReceipt":0,"donation":0,"donationDouble":0})).await;
    assert_eq!(status, StatusCode::OK);
    let (_, other_plan) = call(&pool, &b, "GET", "/api/v1/tax?year=2025", Value::Null).await;
    assert_eq!(other_plan["saved"], false);
    sqlx::query(
        "INSERT INTO assets(user_id,name,value) VALUES($1,'Mine',1000),($2,'Theirs',999999)",
    )
    .bind(&a)
    .bind(&b)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO categories(user_id,key,label,th) VALUES($1,'food','Food','อาหาร')")
        .bind(&a)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO budgets(user_id,cat_key,spent,limit_amt) VALUES($1,'food',125,500)")
        .bind(&a)
        .execute(&pool)
        .await
        .unwrap();
    let name = encrypt_field("Secret merchant", &KEY).unwrap();
    let note = encrypt_field("Private note", &KEY).unwrap();
    sqlx::query("INSERT INTO transactions(user_id,name,cat_key,account,amount,date,note) VALUES($1,$2,'food','Cash',-125,'2026-06-18',$3)").bind(&a).bind(name).bind(note).execute(&pool).await.unwrap();
    let (status, dash) = call(&pool, &a, "GET", "/api/v1/dashboard", Value::Null).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(dash["totalAssets"], 1000);
    assert_eq!(dash["spendTotal"], 125);
    let (status, reports) = call(&pool, &a, "GET", "/api/v1/reports", Value::Null).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(reports["topMerchants"][0]["name"], "Secret merchant");
    cleanup(&pool, &[a, b]).await;
}

#[tokio::test]
async fn default_categories_are_retryable_and_export_preserves_the_download_contract() {
    let pool = pool().await;
    let owner = user(&pool).await;
    let name = encrypt_field("Export merchant", &KEY).unwrap();
    let note = encrypt_field("Private note", &KEY).unwrap();
    sqlx::query("INSERT INTO transactions(user_id,name,cat_key,account,amount,date,note) VALUES($1,$2,'food','Cash',-20,'2026-06-18',$3)")
        .bind(&owner).bind(name).bind(note).execute(&pool).await.unwrap();
    let lender = encrypt_field("Private lender", &KEY).unwrap();
    let debt_id:i32=sqlx::query_scalar("INSERT INTO debts(user_id,name,lender,original,monthly) VALUES($1,'Export debt',$2,1000,100) RETURNING id").bind(&owner).bind(lender).fetch_one(&pool).await.unwrap();
    let payment_note = encrypt_field("Private payment note", &KEY).unwrap();
    sqlx::query("INSERT INTO debt_payments(user_id,debt_id,date,amount,principal,interest,fee,note) VALUES($1,$2,'2026-06-18',100,90,10,0,$3)").bind(&owner).bind(debt_id).bind(payment_note).execute(&pool).await.unwrap();
    assert_eq!(
        call(
            &pool,
            &owner,
            "POST",
            "/internal/v1/me/default-data",
            Value::Null
        )
        .await
        .0,
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        call(
            &pool,
            &owner,
            "POST",
            "/internal/v1/me/default-data",
            Value::Null
        )
        .await
        .0,
        StatusCode::NO_CONTENT
    );
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM categories WHERE user_id=$1")
        .bind(&owner)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 9);
    let (status, export) = call(&pool, &owner, "GET", "/api/v1/me/export", Value::Null).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(export["format"], "cashflowkub-export");
    assert_eq!(export["data"].as_object().unwrap().len(), 20);
    let tx = &export["data"]["transactions"][0];
    assert_eq!(tx["name"], "Export merchant");
    assert_eq!(tx["note"], "Private note");
    assert_eq!(tx["cat"], "food");
    assert_eq!(tx["acct"], "Cash");
    assert_eq!(tx["date"], "2026-06-18T00:00:00.000Z");
    assert!(tx.get("userId").is_none());
    assert!(tx.get("user_id").is_none());
    assert_eq!(export["data"]["debts"][0]["lender"], "Private lender");
    assert_eq!(
        export["data"]["debt_payments"][0]["note"],
        "Private payment note"
    );
    assert!(export.get("sessions").is_none());
    assert!(!export.to_string().contains("enc:v1:"));
    cleanup(&pool, &[owner]).await;
}

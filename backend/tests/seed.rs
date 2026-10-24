use cashflowkub_backend::seed::{SeedAccount, SeedAccounts, ensure_seed_accounts};
use rand::random;
use sqlx::{PgPool, postgres::PgPoolOptions};
use url::Url;

async fn test_pool() -> PgPool {
    let url = std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must point at a disposable database");
    let parsed = Url::parse(&url).expect("valid test database URL");
    assert!(matches!(
        parsed.host_str(),
        Some("localhost" | "127.0.0.1" | "::1")
    ));
    assert!(parsed.path().ends_with("_test"));
    PgPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await
        .unwrap()
}

#[tokio::test]
async fn startup_seed_creates_accounts_and_resets_passwords_idempotently() {
    let pool = test_pool().await;
    let suffix = random::<u64>();
    let admin_email = format!("seed-admin-{suffix}@example.test");
    let client_email = format!("seed-client-{suffix}@example.test");
    let initial = SeedAccounts::new(
        SeedAccount::new(&admin_email, "initial-admin-password", "Admin Test").unwrap(),
        SeedAccount::new(&client_email, "initial-client-password", "Client Test").unwrap(),
    )
    .unwrap();

    ensure_seed_accounts(&pool, &initial).await.unwrap();

    let user_id: String = sqlx::query_scalar("SELECT id FROM users WHERE email=$1")
        .bind(&admin_email)
        .fetch_one(&pool)
        .await
        .unwrap();
    let original_hash: String = sqlx::query_scalar(
        "SELECT password FROM auth_accounts WHERE user_id=$1 AND provider_id='credential' AND account_id=$1",
    )
    .bind(&user_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(original_hash.contains(':'));

    sqlx::query(
        "INSERT INTO sessions(id,expires_at,token,user_id) VALUES($1,now()+interval '1 day',$2,$3)",
    )
    .bind(format!("seed-session-{suffix}"))
    .bind(format!("seed-session-token-{suffix}"))
    .bind(&user_id)
    .execute(&pool)
    .await
    .unwrap();

    let restarted = SeedAccounts::new(
        SeedAccount::new(&admin_email, "replacement-admin-password", "Admin Test").unwrap(),
        SeedAccount::new(&client_email, "replacement-client-password", "Client Test").unwrap(),
    )
    .unwrap();
    ensure_seed_accounts(&pool, &restarted).await.unwrap();

    let same_user_id: String = sqlx::query_scalar("SELECT id FROM users WHERE email=$1")
        .bind(&admin_email)
        .fetch_one(&pool)
        .await
        .unwrap();
    let replacement_hash: String = sqlx::query_scalar(
        "SELECT password FROM auth_accounts WHERE user_id=$1 AND provider_id='credential' AND account_id=$1",
    )
    .bind(&user_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let sessions: i64 = sqlx::query_scalar("SELECT count(*) FROM sessions WHERE user_id=$1")
        .bind(&user_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    let default_categories: i64 =
        sqlx::query_scalar("SELECT count(*) FROM categories WHERE user_id=$1")
            .bind(&user_id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(same_user_id, user_id);
    assert_ne!(replacement_hash, original_hash);
    assert_eq!(sessions, 0);
    assert_eq!(default_categories, 9);

    sqlx::query("DELETE FROM users WHERE email IN ($1,$2)")
        .bind(&admin_email)
        .bind(&client_email)
        .execute(&pool)
        .await
        .unwrap();
}

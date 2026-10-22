use cashflowkub_backend::{
    error::ApiError,
    reference::{
        create_resource, delete_resource, get_resource, get_settings, list_resource,
        update_resource, update_settings,
    },
};
use rand::random;
use serde_json::{Value, json};
use sqlx::{PgPool, postgres::PgPoolOptions};

async fn test_pool() -> PgPool {
    let url = std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must point at a disposable database");
    let parsed = url::Url::parse(&url).expect("valid test database URL");
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

async fn with_users<T>(f: impl AsyncFnOnce(&PgPool, &str, &str) -> T) -> T {
    let pool = test_pool().await;
    let suffix = random::<u64>();
    let user_a = format!("rust-reference-a-{suffix}");
    let user_b = format!("rust-reference-b-{suffix}");
    for user_id in [&user_a, &user_b] {
        sqlx::query("INSERT INTO users (id, name, email, privacy_version, privacy_accepted_at) VALUES ($1, $1, $2, 'test', now())")
            .bind(user_id)
            .bind(format!("{user_id}@example.test"))
            .execute(&pool)
            .await
            .unwrap();
    }
    let result = f(&pool, &user_a, &user_b).await;
    sqlx::query("DELETE FROM users WHERE id IN ($1, $2)")
        .bind(&user_a)
        .bind(&user_b)
        .execute(&pool)
        .await
        .unwrap();
    result
}

#[tokio::test]
async fn resource_reads_are_scoped_to_the_authenticated_user() {
    with_users(async |pool, user_a, user_b| {
        let row = create_resource(pool, user_a, "accounts", json!({"name":"A bank"}))
            .await
            .unwrap();
        let id = row["id"].as_i64().unwrap() as i32;

        assert_eq!(
            get_resource(pool, user_b, "accounts", id)
                .await
                .unwrap_err(),
            ApiError::NotFound
        );
        assert_eq!(
            list_resource(pool, user_b, "accounts").await.unwrap(),
            Vec::<Value>::new()
        );
    })
    .await;
}

#[tokio::test]
async fn category_keys_are_unique_per_user_and_create_returns_compatibility_fields() {
    with_users(async |pool, user_a, user_b| {
        let first = create_resource(
            pool,
            user_a,
            "categories",
            json!({"key":"food","label":"Food"}),
        )
        .await
        .unwrap();
        let other_user = create_resource(
            pool,
            user_b,
            "categories",
            json!({"key":"food","label":"Food"}),
        )
        .await
        .unwrap();

        assert_eq!(first["key"], "food");
        assert_eq!(first["userId"], Value::Null);
        assert_eq!(other_user["key"], "food");
        assert!(matches!(
            create_resource(
                pool,
                user_a,
                "categories",
                json!({"key":"food","label":"Duplicate"})
            )
            .await,
            Err(ApiError::Conflict(_, _))
        ));
    })
    .await;
}

#[tokio::test]
async fn account_rename_updates_only_the_owners_transaction_references() {
    with_users(async |pool, user_a, user_b| {
        let account = create_resource(pool, user_a, "accounts", json!({"name":"Old bank"})).await.unwrap();
        let tx_id = random::<i32>().unsigned_abs() as i64;
        sqlx::query("INSERT INTO transactions (id, name, cat_key, account, amount, date, user_id) VALUES ($1, 'Coffee', 'food', 'Old bank', -10, '2026-10-01', $2)")
            .bind(tx_id)
            .bind(user_a)
            .execute(pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO transactions (id, name, cat_key, account, amount, date, user_id) VALUES ($1, 'Coffee', 'food', 'Old bank', -10, '2026-10-01', $2)")
            .bind(tx_id + 1)
            .bind(user_b)
            .execute(pool)
            .await
            .unwrap();

        update_resource(pool, user_a, "accounts", account["id"].as_i64().unwrap() as i32, json!({"name":"New bank"})).await.unwrap();

        let owners = sqlx::query_scalar::<_, String>("SELECT account FROM transactions WHERE id = ANY($1) ORDER BY id")
            .bind(vec![tx_id, tx_id + 1])
            .fetch_all(pool)
            .await
            .unwrap();
        assert_eq!(owners, vec!["New bank", "Old bank"]);
    })
    .await;
}

#[tokio::test]
async fn referenced_accounts_cannot_be_deleted_and_settings_validate_monthly_income() {
    with_users(async |pool, user_a, _user_b| {
        let account = create_resource(pool, user_a, "accounts", json!({"name":"Used bank"})).await.unwrap();
        let id = random::<i32>().unsigned_abs() as i64;
        sqlx::query("INSERT INTO transactions (id, name, cat_key, account, amount, date, user_id) VALUES ($1, 'Coffee', 'food', 'Used bank', -10, '2026-10-01', $2)")
            .bind(id)
            .bind(user_a)
            .execute(pool)
            .await
            .unwrap();
        assert!(matches!(delete_resource(pool, user_a, "accounts", account["id"].as_i64().unwrap() as i32).await, Err(ApiError::Conflict(_, _))));
        assert_eq!(update_settings(pool, user_a, json!({"monthlyIncome":25000})).await.unwrap(), json!({"monthlyIncome":25000}));
        assert_eq!(get_settings(pool, user_a).await.unwrap(), json!({"monthlyIncome":25000}));
        assert!(update_settings(pool, user_a, json!({"monthlyIncome":-1})).await.is_err());
    })
    .await;
}

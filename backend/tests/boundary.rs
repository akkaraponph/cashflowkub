use axum::{
    Router,
    body::Body,
    http::{HeaderMap, HeaderValue, Request, StatusCode},
    routing::get,
};
use cashflowkub_backend::{
    auth::{AuthUser, authenticate_service_call},
    config::AppState,
    crypto::{decrypt_field, encrypt_field},
};
use secrecy::SecretString;
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

const KEY: [u8; 32] = [7; 32];
const TOKEN: &str = "server-only-token";

#[test]
fn service_auth_rejects_missing_or_wrong_token() {
    for authorization in [None, Some("Bearer browser-token")] {
        let mut headers = HeaderMap::new();
        if let Some(value) = authorization {
            headers.insert("authorization", HeaderValue::from_str(value).unwrap());
        }
        headers.insert("x-cfk-user-id", HeaderValue::from_static("user-a"));

        assert!(authenticate_service_call(&headers, TOKEN).is_err());
    }
}

#[test]
fn service_auth_requires_a_verified_user_id_header() {
    let mut headers = HeaderMap::new();
    headers.insert(
        "authorization",
        HeaderValue::from_static("Bearer server-only-token"),
    );

    assert!(authenticate_service_call(&headers, TOKEN).is_err());
}

#[test]
fn service_auth_returns_the_user_id_only_with_the_service_token() {
    let mut headers = HeaderMap::new();
    headers.insert(
        "authorization",
        HeaderValue::from_static("Bearer server-only-token"),
    );
    headers.insert("x-cfk-user-id", HeaderValue::from_static("user-a"));

    assert_eq!(
        authenticate_service_call(&headers, TOKEN).unwrap().id,
        "user-a"
    );
}

#[test]
fn encrypted_field_uses_the_compatible_v1_format_and_round_trips() {
    let encrypted = encrypt_field("private note", &KEY).expect("encryption succeeds");

    assert!(encrypted.starts_with("enc:v1:"));
    assert_eq!(decrypt_field(&encrypted, &KEY).unwrap(), "private note");
}

#[test]
fn legacy_plaintext_and_empty_fields_remain_unchanged() {
    assert_eq!(decrypt_field("old note", &KEY).unwrap(), "old note");
    assert_eq!(encrypt_field("", &KEY).unwrap(), "");
    assert_eq!(decrypt_field("", &KEY).unwrap(), "");
}

#[test]
fn tampered_ciphertext_is_rejected() {
    let encrypted = encrypt_field("private note", &KEY).unwrap();
    let tampered = format!("{encrypted}x");

    assert!(decrypt_field(&tampered, &KEY).is_err());
}

#[test]
fn reads_a_ciphertext_fixture_written_by_the_existing_node_crypto_format() {
    let node_ciphertext = "enc:v1:AwMDAwMDAwMDAwMD:Oi2rDhKjhZgM468WOSNIKQ:RpHOcztcNyATLCookneRY5lZ";

    assert_eq!(
        decrypt_field(node_ciphertext, &KEY).unwrap(),
        "compatibility note"
    );
}

#[test]
fn text_that_already_uses_the_v1_prefix_is_preserved_on_write() {
    let typed = "enc:v1:user-entered-text";

    assert_eq!(encrypt_field(typed, &KEY).unwrap(), typed);
}

#[tokio::test]
async fn auth_extractor_rejects_requests_without_a_valid_service_credential() {
    let state = AppState {
        pool: PgPoolOptions::new()
            .connect_lazy("postgres://postgres:postgres@localhost/cashflowkub_test")
            .unwrap(),
        service_token: SecretString::from(TOKEN.to_owned()),
        encryption_key: KEY,
    };
    let router = Router::new()
        .route(
            "/protected",
            get(|_user: AuthUser| async { StatusCode::OK }),
        )
        .with_state(state);
    let request = Request::builder()
        .uri("/protected")
        .header("x-cfk-user-id", "user-a")
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

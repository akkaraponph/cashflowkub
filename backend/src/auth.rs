use axum::{
    extract::FromRequestParts,
    http::{HeaderMap, StatusCode, request::Parts},
};
use secrecy::ExposeSecret;
use subtle::ConstantTimeEq;

use crate::config::AppState;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AuthUser {
    pub id: String,
}

pub fn authenticate_service_call(
    headers: &HeaderMap,
    expected_token: &str,
) -> Result<AuthUser, StatusCode> {
    let supplied = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;
    let token_matches = supplied.as_bytes().ct_eq(expected_token.as_bytes());
    if !bool::from(token_matches) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let id = headers
        .get("x-cfk-user-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    Ok(AuthUser { id: id.to_owned() })
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = state.service_token.expose_secret();
        authenticate_service_call(&parts.headers, token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn rejects_missing_and_wrong_service_tokens() {
        for authorization in [None, Some("Bearer browser-token")] {
            let mut headers = HeaderMap::new();
            if let Some(value) = authorization {
                headers.insert("authorization", HeaderValue::from_str(value).unwrap());
            }
            headers.insert("x-cfk-user-id", HeaderValue::from_static("user-a"));
            assert_eq!(
                authenticate_service_call(&headers, "server-only-token"),
                Err(StatusCode::UNAUTHORIZED)
            );
        }
    }

    #[test]
    fn requires_a_user_id_with_a_valid_service_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "authorization",
            HeaderValue::from_static("Bearer server-only-token"),
        );
        assert_eq!(
            authenticate_service_call(&headers, "server-only-token"),
            Err(StatusCode::UNAUTHORIZED)
        );
    }

    #[test]
    fn returns_user_id_with_a_valid_service_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "authorization",
            HeaderValue::from_static("Bearer server-only-token"),
        );
        headers.insert("x-cfk-user-id", HeaderValue::from_static("user-a"));
        assert_eq!(
            authenticate_service_call(&headers, "server-only-token"),
            Ok(AuthUser {
                id: "user-a".into()
            })
        );
    }
}

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ApiError {
    #[error("resource not found")]
    NotFound,
    #[error("{0}")]
    BadRequest(String, Option<String>),
    #[error("{0}")]
    Conflict(String, String),
    #[error("{0}")]
    ConflictMessage(String),
    #[error("internal server error")]
    Internal,
}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message, code) = match self {
            Self::NotFound => (
                StatusCode::NOT_FOUND,
                "resource not found".to_owned(),
                Some("notFound".to_owned()),
            ),
            Self::BadRequest(message, code) => (StatusCode::BAD_REQUEST, message, code),
            Self::Conflict(message, code) => (StatusCode::CONFLICT, message, Some(code)),
            Self::ConflictMessage(message) => (StatusCode::CONFLICT, message, None),
            Self::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal server error".to_owned(),
                None,
            ),
        };
        (
            status,
            Json(ErrorBody {
                error: message,
                code,
            }),
        )
            .into_response()
    }
}

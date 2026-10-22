use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("resource not found")]
    NotFound,
    #[error("bad request")]
    BadRequest,
    #[error("resource already exists")]
    Conflict,
    #[error("internal server error")]
    Internal,
}

#[derive(Serialize)]
struct ErrorBody {
    error: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<&'static str>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message, code) = match self {
            Self::NotFound => (
                StatusCode::NOT_FOUND,
                "resource not found",
                Some("notFound"),
            ),
            Self::BadRequest => (StatusCode::BAD_REQUEST, "bad request", None),
            Self::Conflict => (StatusCode::CONFLICT, "resource already exists", None),
            Self::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal server error",
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

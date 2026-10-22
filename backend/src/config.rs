use base64::{Engine, engine::general_purpose::STANDARD};
use secrecy::SecretString;
use thiserror::Error;

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub service_token: SecretString,
    pub encryption_key: [u8; 32],
}

pub struct Config {
    pub database_url: String,
    pub bind_address: String,
    pub service_token: SecretString,
    pub encryption_key: [u8; 32],
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigError {
    #[error("{0} is not set")]
    Missing(&'static str),
    #[error("DATA_ENCRYPTION_KEY must be base64 of exactly 32 bytes")]
    InvalidEncryptionKey,
}

impl Config {
    pub fn from_values(
        database_url: Option<String>,
        service_token: Option<String>,
        encryption_key: Option<&str>,
        bind_address: Option<String>,
    ) -> Result<Self, ConfigError> {
        let database_url = database_url
            .filter(|s| !s.is_empty())
            .ok_or(ConfigError::Missing("DATABASE_URL"))?;
        let service_token = service_token
            .filter(|s| !s.is_empty())
            .ok_or(ConfigError::Missing("BACKEND_SERVICE_TOKEN"))?;
        let key_raw = encryption_key.ok_or(ConfigError::Missing("DATA_ENCRYPTION_KEY"))?;
        let key_bytes = STANDARD
            .decode(key_raw)
            .map_err(|_| ConfigError::InvalidEncryptionKey)?;
        let encryption_key: [u8; 32] = key_bytes
            .try_into()
            .map_err(|_| ConfigError::InvalidEncryptionKey)?;
        Ok(Self {
            database_url,
            bind_address: bind_address.unwrap_or_else(|| "127.0.0.1:8080".to_owned()),
            service_token: SecretString::from(service_token),
            encryption_key,
        })
    }

    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_values(
            std::env::var("DATABASE_URL").ok(),
            std::env::var("BACKEND_SERVICE_TOKEN").ok(),
            std::env::var("DATA_ENCRYPTION_KEY").ok().as_deref(),
            std::env::var("BACKEND_BIND_ADDRESS").ok(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_missing_and_wrong_length_encryption_keys() {
        assert_eq!(
            Config::from_values(
                Some("postgres://localhost/app".into()),
                Some("token".into()),
                Some("a2V5"),
                None,
            )
            .err()
            .unwrap(),
            ConfigError::InvalidEncryptionKey
        );
        assert_eq!(
            Config::from_values(
                Some("postgres://localhost/app".into()),
                Some("token".into()),
                None,
                None,
            )
            .err()
            .unwrap(),
            ConfigError::Missing("DATA_ENCRYPTION_KEY")
        );
    }
}

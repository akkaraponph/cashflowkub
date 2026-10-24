use aes_gcm::aead::{OsRng, rand_core::RngCore};
use scrypt::{Params, scrypt};
use sqlx::{PgPool, Row};
use thiserror::Error;
use unicode_normalization::UnicodeNormalization;
use uuid::Uuid;

const PASSWORD_BYTES: usize = 64;
const PASSWORD_LOG_N: u8 = 14;
const PASSWORD_R: u32 = 16;
const PASSWORD_P: u32 = 1;

pub struct SeedAccount {
    email: String,
    password: String,
    name: String,
}

pub struct SeedAccounts {
    admin: SeedAccount,
    client: SeedAccount,
}

#[derive(Debug, Error)]
pub enum SeedError {
    #[error("invalid seed account configuration: {0}")]
    Configuration(&'static str),
    #[error("could not hash seed password")]
    PasswordHash,
    #[error("seed account database operation failed")]
    Database(#[from] sqlx::Error),
}

impl SeedAccounts {
    pub fn from_env() -> Result<Option<Self>, SeedError> {
        let enabled = std::env::var("SEED_ACCOUNTS_ENABLED").unwrap_or_default();
        match enabled.trim().to_ascii_lowercase().as_str() {
            "" | "false" | "0" | "no" => return Ok(None),
            "true" | "1" | "yes" => {}
            _ => {
                return Err(SeedError::Configuration(
                    "SEED_ACCOUNTS_ENABLED must be true or false",
                ));
            }
        }

        let admin = SeedAccount::new(
            required_env("SEED_ADMIN_EMAIL", "both seeded accounts require an email")?,
            required_env(
                "SEED_ADMIN_PASSWORD",
                "both seeded accounts require a password",
            )?,
            std::env::var("SEED_ADMIN_NAME").unwrap_or_else(|_| "Admin".to_owned()),
        )?;
        let client = SeedAccount::new(
            required_env("SEED_CLIENT_EMAIL", "both seeded accounts require an email")?,
            required_env(
                "SEED_CLIENT_PASSWORD",
                "both seeded accounts require a password",
            )?,
            std::env::var("SEED_CLIENT_NAME").unwrap_or_else(|_| "Client".to_owned()),
        )?;
        Self::new(admin, client).map(Some)
    }

    pub fn new(admin: SeedAccount, client: SeedAccount) -> Result<Self, SeedError> {
        if admin.email == client.email {
            return Err(SeedError::Configuration(
                "SEED_ADMIN_EMAIL and SEED_CLIENT_EMAIL must differ",
            ));
        }
        Ok(Self { admin, client })
    }
}

impl SeedAccount {
    pub fn new(
        email: impl Into<String>,
        password: impl Into<String>,
        name: impl Into<String>,
    ) -> Result<Self, SeedError> {
        let email = email.into().trim().to_ascii_lowercase();
        let password = password.into();
        if !valid_email(&email) {
            return Err(SeedError::Configuration(
                "seed account emails must be valid",
            ));
        }
        let normalized_password: String = password.nfkc().collect();
        let length = normalized_password.chars().count();
        if !(10..=128).contains(&length) {
            return Err(SeedError::Configuration(
                "seed passwords must contain 10 to 128 characters after NFKC normalization",
            ));
        }
        let name = name.into();
        if name.trim().is_empty() {
            return Err(SeedError::Configuration(
                "seed account names must not be empty",
            ));
        }
        Ok(Self {
            email,
            password,
            name,
        })
    }
}

fn required_env(key: &'static str, message: &'static str) -> Result<String, SeedError> {
    std::env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .ok_or(SeedError::Configuration(message))
}

fn valid_email(email: &str) -> bool {
    let mut parts = email.split('@');
    matches!(
        (parts.next(), parts.next(), parts.next()),
        (Some(local), Some(domain), None) if !local.is_empty() && domain.contains('.')
    )
}

pub async fn ensure_seed_accounts(pool: &PgPool, accounts: &SeedAccounts) -> Result<(), SeedError> {
    seed_account(pool, &accounts.admin).await?;
    seed_account(pool, &accounts.client).await?;
    Ok(())
}

async fn seed_account(pool: &PgPool, account: &SeedAccount) -> Result<(), SeedError> {
    let password_hash = hash_password(&account.password)?;
    let mut tx = pool.begin().await?;
    let user_id = sqlx::query_scalar::<_, String>(
        "INSERT INTO users(id,name,email,privacy_version,privacy_accepted_at) VALUES($1,$2,$3,'seeded',now()) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&account.name)
    .bind(&account.email)
    .fetch_one(&mut *tx)
    .await?;

    let credential_id = sqlx::query(
        "SELECT id FROM auth_accounts WHERE user_id=$1 AND provider_id='credential' AND account_id=$1 ORDER BY created_at LIMIT 1 FOR UPDATE",
    )
    .bind(&user_id)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(row) = credential_id {
        let id: String = row.try_get("id")?;
        sqlx::query("UPDATE auth_accounts SET password=$1,updated_at=now() WHERE id=$2")
            .bind(&password_hash)
            .bind(id)
            .execute(&mut *tx)
            .await?;
    } else {
        sqlx::query("INSERT INTO auth_accounts(id,account_id,provider_id,user_id,password) VALUES($1,$2,'credential',$2,$3)")
            .bind(Uuid::new_v4().to_string())
            .bind(&user_id)
            .bind(&password_hash)
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query("DELETE FROM sessions WHERE user_id=$1")
        .bind(&user_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    crate::export::ensure_default_data(pool, &user_id).await?;
    Ok(())
}

fn hash_password(password: &str) -> Result<String, SeedError> {
    let mut salt = [0_u8; 16];
    OsRng.fill_bytes(&mut salt);
    hash_password_with_salt(password, &hex(&salt))
}

fn hash_password_with_salt(password: &str, salt: &str) -> Result<String, SeedError> {
    let params =
        Params::new(PASSWORD_LOG_N, PASSWORD_R, PASSWORD_P).map_err(|_| SeedError::PasswordHash)?;
    let normalized: String = password.nfkc().collect();
    let mut key = [0_u8; PASSWORD_BYTES];
    scrypt(normalized.as_bytes(), salt.as_bytes(), &params, &mut key)
        .map_err(|_| SeedError::PasswordHash)?;
    Ok(format!("{salt}:{}", hex(&key)))
}

fn hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push(HEX[(byte >> 4) as usize] as char);
        encoded.push(HEX[(byte & 0x0f) as usize] as char);
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::hash_password_with_salt;

    #[test]
    fn password_hash_matches_better_auth_scrypt_format() {
        let hash =
            hash_password_with_salt("test-password", "000102030405060708090a0b0c0d0e0f").unwrap();

        assert_eq!(
            hash,
            "000102030405060708090a0b0c0d0e0f:595b555ca965517504fd4404531359b7fc3e814314dbdf60900c0f87e67a0eafff49a4a7befb5631e4705c4ef1d89872c7264869b949f7043bb7a99de4437199"
        );
    }
}

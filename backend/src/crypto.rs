use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit, OsRng, rand_core::RngCore},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use thiserror::Error;

const PREFIX: &str = "enc:v1:";
const NONCE_BYTES: usize = 12;
const TAG_BYTES: usize = 16;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum CryptoError {
    #[error("malformed encrypted value")]
    Malformed,
    #[error("encrypted value authentication failed")]
    Authentication,
}

fn cipher(key: &[u8; 32]) -> Aes256Gcm {
    Aes256Gcm::new(key.into())
}

pub fn encrypt_field(plain: &str, key: &[u8; 32]) -> Result<String, CryptoError> {
    if plain.is_empty() || plain.starts_with(PREFIX) {
        return Ok(plain.to_owned());
    }
    let mut nonce_bytes = [0_u8; NONCE_BYTES];
    OsRng.fill_bytes(&mut nonce_bytes);
    let encrypted = cipher(key)
        .encrypt(Nonce::from_slice(&nonce_bytes), plain.as_bytes())
        .map_err(|_| CryptoError::Authentication)?;
    let split = encrypted
        .len()
        .checked_sub(TAG_BYTES)
        .ok_or(CryptoError::Malformed)?;
    let (ciphertext, tag) = encrypted.split_at(split);
    Ok(format!(
        "{PREFIX}{}:{}:{}",
        URL_SAFE_NO_PAD.encode(nonce_bytes),
        URL_SAFE_NO_PAD.encode(tag),
        URL_SAFE_NO_PAD.encode(ciphertext)
    ))
}

pub fn decrypt_field(value: &str, key: &[u8; 32]) -> Result<String, CryptoError> {
    let Some(encoded) = value.strip_prefix(PREFIX) else {
        return Ok(value.to_owned());
    };
    let mut parts = encoded.split(':');
    let nonce = URL_SAFE_NO_PAD
        .decode(parts.next().ok_or(CryptoError::Malformed)?)
        .map_err(|_| CryptoError::Malformed)?;
    let tag = URL_SAFE_NO_PAD
        .decode(parts.next().ok_or(CryptoError::Malformed)?)
        .map_err(|_| CryptoError::Malformed)?;
    let ciphertext = URL_SAFE_NO_PAD
        .decode(parts.next().ok_or(CryptoError::Malformed)?)
        .map_err(|_| CryptoError::Malformed)?;
    if parts.next().is_some() || nonce.len() != NONCE_BYTES || tag.len() != TAG_BYTES {
        return Err(CryptoError::Malformed);
    }
    let mut payload = ciphertext;
    payload.extend_from_slice(&tag);
    let plaintext = cipher(key)
        .decrypt(Nonce::from_slice(&nonce), payload.as_ref())
        .map_err(|_| CryptoError::Authentication)?;
    String::from_utf8(plaintext).map_err(|_| CryptoError::Authentication)
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: [u8; 32] = [7; 32];

    #[test]
    fn encrypts_with_v1_format_and_round_trips() {
        let encrypted = encrypt_field("private note", &KEY).unwrap();
        assert!(encrypted.starts_with(PREFIX));
        assert_eq!(decrypt_field(&encrypted, &KEY).unwrap(), "private note");
    }

    #[test]
    fn legacy_plaintext_and_empty_values_pass_through() {
        assert_eq!(decrypt_field("old note", &KEY).unwrap(), "old note");
        assert_eq!(encrypt_field("", &KEY).unwrap(), "");
        assert_eq!(decrypt_field("", &KEY).unwrap(), "");
    }

    #[test]
    fn rejects_tampering_and_preserves_user_typed_prefix() {
        let encrypted = encrypt_field("private note", &KEY).unwrap();
        assert!(decrypt_field(&format!("{encrypted}x"), &KEY).is_err());
        let typed = "enc:v1:user-entered-text";
        assert_eq!(encrypt_field(typed, &KEY).unwrap(), typed);
    }
}

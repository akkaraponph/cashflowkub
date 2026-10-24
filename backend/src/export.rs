use crate::{auth::AuthUser, config::AppState, crypto::decrypt_field, error::ApiError};
use axum::{
    Router,
    extract::State,
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde_json::{Value, json};
use sqlx::Row;

const TABLES: &[&str] = &[
    "accounts",
    "categories",
    "transactions",
    "budgets",
    "goals",
    "debts",
    "debt_payments",
    "settings",
    "assets",
    "bills",
    "bill_payments",
    "channels",
    "income_categories",
    "plan_items",
    "asset_snapshots",
    "net_worth_histories",
    "monthly_cashflows",
    "day_spends",
    "setup_goals",
    "setup_goal_channels",
];
fn fail(_: sqlx::Error) -> ApiError {
    ApiError::Internal
}
async fn export(State(s): State<AppState>, u: AuthUser) -> Result<Response, ApiError> {
    let user = sqlx::query(
        "SELECT email,name,privacy_version,privacy_accepted_at,created_at FROM users WHERE id=$1",
    )
    .bind(&u.id)
    .fetch_optional(&s.pool)
    .await
    .map_err(fail)?
    .ok_or(ApiError::NotFound)?;
    let email: String = user.try_get("email").map_err(fail)?;
    let name: String = user.try_get("name").map_err(fail)?;
    let version: String = user.try_get("privacy_version").map_err(fail)?;
    let accepted: chrono::NaiveDateTime = user.try_get("privacy_accepted_at").map_err(fail)?;
    let created: chrono::NaiveDateTime = user.try_get("created_at").map_err(fail)?;
    let mut data = serde_json::Map::new();
    for table in TABLES {
        let q = format!(
            "SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS rows FROM {table} t WHERE user_id=$1"
        );
        let rows: Value = sqlx::query(&q)
            .bind(&u.id)
            .fetch_one(&s.pool)
            .await
            .map_err(fail)?
            .try_get("rows")
            .map_err(fail)?;
        let mut out = Vec::new();
        for mut row in rows.as_array().cloned().unwrap_or_default() {
            if let Some(obj) = row.as_object_mut() {
                obj.remove("user_id");
                let db_keys: Vec<String> = obj.keys().cloned().collect();
                for key in db_keys {
                    if key == "date"
                        && (*table == "transactions" || *table == "debt_payments")
                        && let Some(day) = obj.get(&key).and_then(Value::as_str).map(str::to_owned)
                    {
                        obj.insert(key.clone(), json!(format!("{day}T00:00:00.000Z")));
                    }
                    let public_key = export_key(&key);
                    if public_key != key
                        && let Some(value) = obj.remove(&key)
                    {
                        obj.insert(public_key, value);
                    }
                }
                for field in encrypted(table) {
                    let field = export_key(field);
                    if let Some(v) = obj.get(&field).and_then(Value::as_str) {
                        let clear =
                            decrypt_field(v, &s.encryption_key).map_err(|_| ApiError::Internal)?;
                        obj.insert(field, json!(clear));
                    }
                }
            }
            out.push(row)
        }
        data.insert((*table).into(), json!(out));
    }
    let now = chrono::Utc::now();
    let body = json!({"format":"cashflowkub-export","version":1,"exported_at":now.to_rfc3339_opts(chrono::SecondsFormat::Millis,true),"privacy":{"version":version,"accepted_at":accepted.and_utc().to_rfc3339_opts(chrono::SecondsFormat::Millis,true)},"user":{"email":email,"name":name,"created_at":created.and_utc().to_rfc3339_opts(chrono::SecondsFormat::Millis,true)},"data":data});
    let mut response = (StatusCode::OK, axum::Json(body)).into_response();
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!(
            "attachment; filename=\"cashflowkub-export-{}.json\"",
            now.format("%Y-%m-%d")
        ))
        .unwrap(),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(response)
}
fn encrypted(table: &str) -> &'static [&'static str] {
    match table {
        "transactions" => &["name", "note"],
        "debt_payments" => &["note"],
        "debts" => &["lender"],
        _ => &[],
    }
}
fn export_key(key: &str) -> String {
    match key {
        "cat_key" => "cat".into(),
        "account" => "acct".into(),
        "limit_amt" => "limit".into(),
        "grp" => "group".into(),
        _ => {
            let mut out = String::new();
            let mut upper = false;
            for c in key.chars() {
                if c == '_' {
                    upper = true
                } else if upper {
                    out.extend(c.to_uppercase());
                    upper = false
                } else {
                    out.push(c)
                }
            }
            out
        }
    }
}
type DefaultCategory = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    i32,
);
const DEFAULTS: &[DefaultCategory] = &[
    (
        "food",
        "Food & Dining",
        "อาหาร",
        "Food",
        "utensils",
        "folder",
        "expense",
        1,
    ),
    (
        "transport",
        "Transport",
        "เดินทาง",
        "Transit",
        "car",
        "doc",
        "expense",
        2,
    ),
    (
        "shopping",
        "Shopping",
        "ช้อปปิ้ง",
        "Shop",
        "shopping-bag",
        "image",
        "expense",
        3,
    ),
    (
        "bills",
        "Bills",
        "บิล",
        "Bills",
        "receipt",
        "pdf",
        "expense",
        4,
    ),
    (
        "fun",
        "Entertainment",
        "บันเทิง",
        "Fun",
        "clapperboard",
        "video",
        "expense",
        5,
    ),
    (
        "health",
        "Health",
        "สุขภาพ",
        "Health",
        "heart-pulse",
        "xls",
        "expense",
        6,
    ),
    (
        "income",
        "Income",
        "รายรับ",
        "Income",
        "arrow-down-left",
        "xls",
        "income",
        7,
    ),
    (
        "saving",
        "Savings & Investing",
        "เงินสะสม / การลงทุน",
        "Saving",
        "piggy-bank",
        "xls",
        "expense",
        8,
    ),
    (
        "debt",
        "Debt payment",
        "ชำระหนี้สิน",
        "Debt",
        "hand-coins",
        "pdf",
        "expense",
        9,
    ),
];
async fn default_data(
    State(s): State<AppState>,
    u: AuthUser,
) -> Result<impl IntoResponse, ApiError> {
    ensure_default_data(&s.pool, &u.id).await.map_err(fail)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn ensure_default_data(pool: &sqlx::PgPool, user_id: &str) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    for (key, label, th, short, icon, tint, kind, sort) in DEFAULTS {
        let sub = match *key {
            "food" | "transport" | "bills" | "health" => "need",
            "shopping" | "fun" => "want",
            "saving" => "saving",
            "debt" => "debt",
            _ => "",
        };
        sqlx::query("INSERT INTO categories(user_id,key,label,th,short,icon,tint,type,sub,sort) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(user_id,key) DO NOTHING")
            .bind(user_id)
            .bind(key)
            .bind(label)
            .bind(th)
            .bind(short)
            .bind(icon)
            .bind(tint)
            .bind(kind)
            .bind(sub)
            .bind(sort)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await
}
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/me/export", get(export))
        .route("/internal/v1/me/default-data", post(default_data))
}

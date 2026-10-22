use std::str::FromStr;

use axum::{
    Json, Router,
    body::Bytes,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get as axum_get, post},
};
use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{
    PgPool, Postgres, QueryBuilder, Row, postgres::PgRow, types::chrono::NaiveDate as SqlDate,
};

use crate::{
    auth::AuthUser,
    config::AppState,
    crypto::{decrypt_field, encrypt_field},
    error::ApiError,
};

const ACTIVITIES: &[&str] = &["receive", "pay", "save", "pay_debt", "withdraw", "transfer"];
const TODAY: SqlDate = match NaiveDate::from_ymd_opt(2026, 6, 18) {
    Some(date) => date,
    None => unreachable!(),
};

#[derive(Clone, Debug)]
struct Tx {
    id: i32,
    name: String,
    cat: String,
    acct: String,
    amount: Decimal,
    date: SqlDate,
    note: String,
    interest: Decimal,
    fee: Decimal,
    goal: String,
    activity: String,
    item: String,
}

#[derive(Default, Deserialize)]
struct Filters {
    #[serde(rename = "type")]
    kind: Option<String>,
    activity: Option<String>,
    category: Option<String>,
    account: Option<String>,
    from: Option<String>,
    to: Option<String>,
}

#[derive(Clone)]
struct Input {
    name: Option<String>,
    cat: Option<String>,
    acct: Option<String>,
    amount: Option<Decimal>,
    note: Option<String>,
    interest: Option<Decimal>,
    fee: Option<Decimal>,
    goal: Option<String>,
    activity: Option<String>,
    item: Option<String>,
    date: Option<SqlDate>,
}

impl Tx {
    fn view(self, key: &[u8; 32]) -> Result<Value, ApiError> {
        let name = decrypt_field(&self.name, key).map_err(|_| ApiError::Internal)?;
        let note = decrypt_field(&self.note, key).map_err(|_| ApiError::Internal)?;
        let amount = self.amount.to_f64().ok_or(ApiError::Internal)?;
        let date = self.date.format("%b %-d, %Y").to_string();
        let group = if self.date == TODAY {
            "Today".to_owned()
        } else if self.date == TODAY.pred_opt().ok_or(ApiError::Internal)? {
            "Yesterday".to_owned()
        } else {
            self.date.format("%b %-d").to_string()
        };
        Ok(json!({
            "id": self.id, "name": name, "cat": self.cat, "acct": self.acct,
            "amount": amount, "note": note,
            "interest": self.interest.to_f64().ok_or(ApiError::Internal)?,
            "fee": self.fee.to_f64().ok_or(ApiError::Internal)?,
            "goal": self.goal, "activity": self.activity, "item": self.item,
            "isoDate": self.date.format("%Y-%m-%d").to_string(), "date": date, "group": group,
        }))
    }
}

fn read_tx(row: PgRow) -> Result<Tx, ApiError> {
    Ok(Tx {
        id: row.try_get("id").map_err(db_error)?,
        name: row.try_get("name").map_err(db_error)?,
        cat: row.try_get("cat_key").map_err(db_error)?,
        acct: row.try_get("account").map_err(db_error)?,
        amount: row.try_get("amount").map_err(db_error)?,
        date: row.try_get("date").map_err(db_error)?,
        note: row.try_get("note").map_err(db_error)?,
        interest: row.try_get("interest").map_err(db_error)?,
        fee: row.try_get("fee").map_err(db_error)?,
        goal: row.try_get("goal").map_err(db_error)?,
        activity: row.try_get("activity").map_err(db_error)?,
        item: row.try_get("item").map_err(db_error)?,
    })
}

const SELECT_TX: &str = "SELECT id,name,cat_key,account,amount,date,note,interest,fee,goal,activity,item FROM transactions";

fn db_error(_: sqlx::Error) -> ApiError {
    ApiError::Internal
}
fn validation(message: impl Into<String>, code: Option<&str>) -> ApiError {
    ApiError::BadRequest(message.into(), code.map(str::to_owned))
}

fn parse_date(raw: &str) -> Option<SqlDate> {
    let value = raw.trim();
    if let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        return Some(date);
    }
    if let Ok(date) = NaiveDate::parse_from_str(value, "%b %e, %Y") {
        return Some(date);
    }
    if let Ok(timestamp) = DateTime::parse_from_rfc3339(value) {
        return Some(timestamp.with_timezone(&Utc).date_naive());
    }
    None
}

fn decimal(
    value: Option<&Value>,
    field: &str,
    required: bool,
    minimum: Option<Decimal>,
    nonzero: bool,
) -> Result<Option<Decimal>, ApiError> {
    let Some(value) = value else {
        return if required {
            Err(validation(
                format!("{field}: Expected number"),
                Some("validation"),
            ))
        } else {
            Ok(None)
        };
    };
    let number = value
        .as_number()
        .ok_or_else(|| validation(format!("{field}: Expected number"), Some("validation")))?;
    let parsed = Decimal::from_str(&number.to_string())
        .map_err(|_| validation(format!("{field}: Expected number"), Some("validation")))?;
    if parsed.abs() >= Decimal::from(1_000_000_000_000_i64) || parsed.scale() > 2 {
        return Err(validation(
            format!("{field}: at most 2 decimal places"),
            Some("validation"),
        ));
    }
    if minimum.is_some_and(|min| parsed < min) || (nonzero && parsed.is_zero()) {
        let message = if nonzero {
            "amount must not be zero"
        } else {
            "number must be non-negative"
        };
        return Err(validation(message, Some("validation")));
    }
    Ok(Some(parsed))
}

fn input(body: Value, partial: bool) -> Result<Input, ApiError> {
    let object = body
        .as_object()
        .ok_or_else(|| validation("request body must be an object", None))?;
    let string = |key: &str| -> Result<Option<String>, ApiError> {
        match object.get(key) {
            None => Ok(None),
            Some(Value::String(value)) => Ok(Some(value.clone())),
            Some(_) => Err(validation(
                format!("{key}: Expected string"),
                Some("validation"),
            )),
        }
    };
    let name = string("name")?.map(|s| s.trim().to_owned());
    let cat = string("cat")?;
    let acct = string("acct")?;
    let note = string("note")?;
    let goal = string("goal")?;
    let item = string("item")?.map(|s| s.trim().to_owned());
    let activity = string("activity")?;
    let date = match string("date")? {
        Some(raw) => {
            Some(parse_date(&raw).ok_or_else(|| validation(format!("invalid date: {raw}"), None))?)
        }
        None => None,
    };
    if name.as_ref().is_some_and(String::is_empty) || (!partial && name.is_none()) {
        return Err(validation(
            "name: String must contain at least 1 character(s)",
            Some("validation"),
        ));
    }
    if acct.as_ref().is_some_and(String::is_empty) || (!partial && acct.is_none()) {
        return Err(validation(
            "acct: String must contain at least 1 character(s)",
            Some("validation"),
        ));
    }
    if activity
        .as_ref()
        .is_some_and(|a| !ACTIVITIES.contains(&a.as_str()))
    {
        return Err(validation(
            "activity: Invalid enum value",
            Some("validation"),
        ));
    }
    let amount = decimal(object.get("amount"), "amount", !partial, None, true)?;
    let interest = decimal(
        object.get("interest"),
        "interest",
        false,
        Some(Decimal::ZERO),
        false,
    )?;
    let fee = decimal(object.get("fee"), "fee", false, Some(Decimal::ZERO), false)?;
    Ok(Input {
        name,
        cat,
        acct,
        amount,
        note,
        interest,
        fee,
        goal,
        activity,
        item,
        date,
    })
}

async fn ref_name(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    table: &str,
    user: &str,
    raw: &str,
) -> Result<Option<String>, ApiError> {
    let query = format!(
        "SELECT name FROM {table} WHERE user_id=$1 AND lower(btrim(name))=lower(btrim($2)) LIMIT 1"
    );
    sqlx::query_scalar(&query)
        .bind(user)
        .bind(raw)
        .fetch_optional(&mut **tx)
        .await
        .map_err(db_error)
}

async fn resolve(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    user: &str,
    incoming: Input,
    current: Option<&Tx>,
) -> Result<Tx, ApiError> {
    let cat = incoming
        .cat
        .clone()
        .or_else(|| current.map(|t| t.cat.clone()))
        .unwrap_or_default();
    let amount = incoming
        .amount
        .or_else(|| current.map(|t| t.amount))
        .unwrap_or(Decimal::ZERO);
    let mut activity = incoming
        .activity
        .clone()
        .or_else(|| current.map(|t| t.activity.clone()));
    if activity.is_none() {
        if cat.is_empty() {
            return Err(validation("cat or activity required", Some("validation")));
        }
        let sub: Option<String> =
            sqlx::query_scalar("SELECT sub FROM categories WHERE user_id=$1 AND key=$2")
                .bind(user)
                .bind(&cat)
                .fetch_optional(&mut **tx)
                .await
                .map_err(db_error)?;
        activity = Some(if amount > Decimal::ZERO {
            "receive".into()
        } else if sub.as_deref() == Some("saving") {
            "save".into()
        } else if sub.as_deref() == Some("debt") {
            "pay_debt".into()
        } else {
            "pay".into()
        });
    }
    let activity = activity.unwrap_or_else(|| "pay".into());
    let fixed_cat = match activity.as_str() {
        "receive" => Some("income"),
        "save" => Some("saving"),
        "pay_debt" => Some("debt"),
        "withdraw" | "transfer" => Some(""),
        _ => None,
    };
    let cat = fixed_cat.map(str::to_owned).unwrap_or(cat);
    let acct = incoming
        .acct
        .clone()
        .or_else(|| current.map(|t| t.acct.clone()))
        .unwrap_or_default();
    let item = incoming
        .item
        .clone()
        .or_else(|| current.map(|t| t.item.clone()))
        .unwrap_or_default();
    let interest = incoming
        .interest
        .or_else(|| current.map(|t| t.interest))
        .unwrap_or(Decimal::ZERO);
    let fee = incoming
        .fee
        .or_else(|| current.map(|t| t.fee))
        .unwrap_or(Decimal::ZERO);
    let goal = incoming
        .goal
        .clone()
        .or_else(|| current.map(|t| t.goal.clone()))
        .unwrap_or_default();
    let cat_sub = if fixed_cat.is_none() {
        sqlx::query_scalar::<_, String>("SELECT sub FROM categories WHERE user_id=$1 AND key=$2")
            .bind(user)
            .bind(&cat)
            .fetch_optional(&mut **tx)
            .await
            .map_err(db_error)?
    } else {
        None
    };
    let is_inflow = matches!(activity.as_str(), "receive" | "withdraw" | "transfer");
    let rule = if (is_inflow && amount <= Decimal::ZERO) || (!is_inflow && amount >= Decimal::ZERO)
    {
        Some("amountSign")
    } else if fixed_cat.is_none()
        && cat_sub
            .as_deref()
            .is_none_or(|s| s == "saving" || s == "debt")
    {
        Some("catNotAllowed")
    } else if activity == "pay" && !item.trim().is_empty() {
        Some("itemNotAllowed")
    } else if matches!(
        activity.as_str(),
        "save" | "pay_debt" | "withdraw" | "transfer"
    ) && item.trim().is_empty()
        && (current.is_some() && (incoming.activity.is_some() || incoming.item.is_some())
            || current.is_none() && incoming.activity.is_some())
    {
        Some("itemRequired")
    } else if (interest > Decimal::ZERO || fee > Decimal::ZERO) && activity != "pay_debt" {
        Some("interestOnlyOnDebt")
    } else if !goal.trim().is_empty() && activity != "save" {
        Some("goalOnlyOnSave")
    } else if activity == "transfer" && acct.trim().eq_ignore_ascii_case(item.trim()) {
        Some("transferToSelf")
    } else {
        None
    };
    if let Some(code) = rule {
        return Err(validation(
            format!("activity is invalid: {code}"),
            Some("activityMismatch"),
        ));
    }

    let touched_account = current.is_none() || incoming.acct.is_some();
    let touched_item = current.is_none() || incoming.activity.is_some() || incoming.item.is_some();
    let mut stored_acct = acct.clone();
    if touched_account {
        stored_acct = ref_name(tx, "accounts", user, &acct)
            .await?
            .ok_or_else(|| validation("unknown account", Some("unknownAccount")))?;
    }
    let table = match activity.as_str() {
        "receive" => Some("income_categories"),
        "save" | "withdraw" => Some("channels"),
        "pay_debt" => Some("debts"),
        "transfer" => Some("accounts"),
        _ => None,
    };
    let mut stored_item = item.clone();
    if touched_item
        && !item.trim().is_empty()
        && let Some(table) = table
    {
        stored_item = ref_name(tx, table, user, &item)
            .await?
            .ok_or_else(|| validation("unknown item", Some("unknownItem")))?;
    }
    let name = incoming
        .name
        .clone()
        .or_else(|| current.map(|t| t.name.clone()))
        .unwrap_or_default();
    let note = incoming
        .note
        .clone()
        .or_else(|| current.map(|t| t.note.clone()))
        .unwrap_or_default();
    let date = incoming
        .date
        .or_else(|| current.map(|t| t.date))
        .unwrap_or(TODAY);
    Ok(Tx {
        id: current.map(|t| t.id).unwrap_or_default(),
        name,
        cat,
        acct: stored_acct,
        amount,
        date,
        note,
        interest,
        fee,
        goal,
        activity,
        item: stored_item,
    })
}

async fn insert_tx(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    user: &str,
    row: &Tx,
    key: &[u8; 32],
) -> Result<Tx, ApiError> {
    let name = encrypt_field(&row.name, key).map_err(|_| ApiError::Internal)?;
    let note = encrypt_field(&row.note, key).map_err(|_| ApiError::Internal)?;
    let row = sqlx::query("
        INSERT INTO transactions (user_id,name,cat_key,account,amount,date,note,interest,fee,goal,activity,item)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id,name,cat_key,account,amount,date,note,interest,fee,goal,activity,item")
        .bind(user).bind(name).bind(&row.cat).bind(&row.acct).bind(row.amount).bind(row.date).bind(note).bind(row.interest).bind(row.fee).bind(&row.goal).bind(&row.activity).bind(&row.item)
        .fetch_one(&mut **tx).await.map_err(db_error)?;
    read_tx(row)
}

async fn update_tx(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    user: &str,
    row: &Tx,
    key: &[u8; 32],
) -> Result<Tx, ApiError> {
    let name = encrypt_field(&row.name, key).map_err(|_| ApiError::Internal)?;
    let note = encrypt_field(&row.note, key).map_err(|_| ApiError::Internal)?;
    let result=sqlx::query("
        UPDATE transactions SET name=$3,cat_key=$4,account=$5,amount=$6,date=$7,note=$8,interest=$9,fee=$10,goal=$11,activity=$12,item=$13
        WHERE user_id=$1 AND id=$2 RETURNING id,name,cat_key,account,amount,date,note,interest,fee,goal,activity,item")
        .bind(user).bind(row.id).bind(name).bind(&row.cat).bind(&row.acct).bind(row.amount).bind(row.date).bind(note).bind(row.interest).bind(row.fee).bind(&row.goal).bind(&row.activity).bind(&row.item)
        .fetch_optional(&mut **tx).await.map_err(db_error)?.ok_or(ApiError::NotFound)?;
    read_tx(result)
}

fn filter_query(
    query: &mut QueryBuilder<'_, Postgres>,
    user: &str,
    filters: &Filters,
) -> Result<(), ApiError> {
    query.push(" WHERE user_id=").push_bind(user.to_owned());
    if let Some(activity) = filters.activity.as_deref()
        && ACTIVITIES.contains(&activity)
    {
        query.push(" AND activity=").push_bind(activity.to_owned());
    } else if let Some(kind) = filters.kind.as_deref() {
        if kind == "income" {
            query.push(" AND activity='receive'");
        } else if kind == "expense" {
            query.push(" AND activity IN ('pay','save','pay_debt')");
        }
    }
    if let Some(cat) = filters.category.as_deref().filter(|s| !s.is_empty()) {
        query.push(" AND cat_key=").push_bind(cat.to_owned());
    }
    if let Some(acct) = filters.account.as_deref().filter(|s| !s.is_empty()) {
        query.push(" AND account=").push_bind(acct.to_owned());
    }
    if let Some(raw) = filters.from.as_deref().filter(|s| !s.is_empty()) {
        let date =
            parse_date(raw).ok_or_else(|| validation(format!("invalid from date: {raw}"), None))?;
        query.push(" AND date >= ").push_bind(date);
    }
    if let Some(raw) = filters.to.as_deref().filter(|s| !s.is_empty()) {
        let date =
            parse_date(raw).ok_or_else(|| validation(format!("invalid to date: {raw}"), None))?;
        query.push(" AND date <= ").push_bind(date);
    }
    Ok(())
}

async fn list(
    pool: &PgPool,
    user: &str,
    key: &[u8; 32],
    filters: &Filters,
    limit: Option<i64>,
    offset: i64,
) -> Result<Vec<Value>, ApiError> {
    let mut query = QueryBuilder::<Postgres>::new(SELECT_TX);
    filter_query(&mut query, user, filters)?;
    query.push(" ORDER BY date DESC,id DESC");
    if let Some(limit) = limit {
        query.push(" LIMIT ").push_bind(limit);
    }
    if offset > 0 {
        query.push(" OFFSET ").push_bind(offset);
    }
    query
        .build()
        .fetch_all(pool)
        .await
        .map_err(db_error)?
        .into_iter()
        .map(|r| read_tx(r)?.view(key))
        .collect()
}

async fn get(pool: &PgPool, user: &str, id: i32, key: &[u8; 32]) -> Result<Value, ApiError> {
    let query = format!("{SELECT_TX} WHERE user_id=$1 AND id=$2");
    let row = sqlx::query(&query)
        .bind(user)
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(db_error)?
        .ok_or(ApiError::NotFound)?;
    read_tx(row)?.view(key)
}

async fn create(pool: &PgPool, user: &str, key: &[u8; 32], body: Value) -> Result<Value, ApiError> {
    let parsed = input(body, false)?;
    let mut tx = pool.begin().await.map_err(db_error)?;
    let resolved = resolve(&mut tx, user, parsed, None).await?;
    let row = insert_tx(&mut tx, user, &resolved, key).await?;
    tx.commit().await.map_err(db_error)?;
    row.view(key)
}

async fn create_many(
    pool: &PgPool,
    user: &str,
    key: &[u8; 32],
    body: Value,
) -> Result<Vec<Value>, ApiError> {
    let object = body
        .as_object()
        .ok_or_else(|| validation("request body must be an object", None))?;
    let values = object
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| validation("items: Expected array", Some("validation")))?;
    if values.is_empty() || values.len() > 500 {
        return Err(validation(
            "items: Must contain between 1 and 500 items",
            Some("validation"),
        ));
    }
    let parsed = values
        .iter()
        .cloned()
        .map(|v| input(v, false))
        .collect::<Result<Vec<_>, _>>()?;
    let mut tx = pool.begin().await.map_err(db_error)?;
    sqlx::query("SET LOCAL statement_timeout='60s'")
        .execute(&mut *tx)
        .await
        .map_err(db_error)?;
    let mut rows = Vec::with_capacity(parsed.len());
    for input in parsed {
        let resolved = resolve(&mut tx, user, input, None).await?;
        rows.push(insert_tx(&mut tx, user, &resolved, key).await?);
    }
    tx.commit().await.map_err(db_error)?;
    rows.into_iter().map(|r| r.view(key)).collect()
}

async fn update(
    pool: &PgPool,
    user: &str,
    id: i32,
    key: &[u8; 32],
    body: Value,
) -> Result<Value, ApiError> {
    let parsed = input(body, true)?;
    let mut tx = pool.begin().await.map_err(db_error)?;
    let query = format!("{SELECT_TX} WHERE user_id=$1 AND id=$2 FOR UPDATE");
    let found = sqlx::query(&query)
        .bind(user)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_error)?
        .ok_or(ApiError::NotFound)?;
    let current = read_tx(found)?;
    let resolved = resolve(&mut tx, user, parsed, Some(&current)).await?;
    let row = update_tx(&mut tx, user, &resolved, key).await?;
    tx.commit().await.map_err(db_error)?;
    row.view(key)
}

async fn delete(pool: &PgPool, user: &str, id: i32) -> Result<(), ApiError> {
    let result = sqlx::query("DELETE FROM transactions WHERE user_id=$1 AND id=$2")
        .bind(user)
        .bind(id)
        .execute(pool)
        .await
        .map_err(db_error)?;
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(())
}

async fn delete_many(pool: &PgPool, user: &str, body: Value) -> Result<Value, ApiError> {
    let ids = body
        .get("ids")
        .and_then(Value::as_array)
        .ok_or_else(|| validation("ids: Expected array", Some("validation")))?;
    if ids.is_empty() || ids.len() > 500 {
        return Err(validation(
            "ids: Must contain between 1 and 500 items",
            Some("validation"),
        ));
    }
    let ids = ids
        .iter()
        .map(|v| {
            v.as_i64()
                .filter(|x| *x > 0 && *x <= i32::MAX as i64)
                .map(|x| x as i32)
                .ok_or_else(|| validation("ids: Expected positive integer", Some("validation")))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let result = sqlx::query("DELETE FROM transactions WHERE user_id=$1 AND id=ANY($2)")
        .bind(user)
        .bind(&ids)
        .execute(pool)
        .await
        .map_err(db_error)?;
    Ok(json!({"deleted":result.rows_affected()}))
}

fn parse_id(raw: &str) -> Result<i32, ApiError> {
    if raw.is_empty() || raw.len() > 9 || !raw.bytes().all(|b| b.is_ascii_digit()) {
        return Err(validation(format!("invalid id: {raw}"), None));
    }
    raw.parse()
        .map_err(|_| validation(format!("invalid id: {raw}"), None))
}
fn parse_json(body: Bytes) -> Result<Value, ApiError> {
    if body.is_empty() {
        return Err(validation("request body is required", None));
    }
    serde_json::from_slice(&body).map_err(|_| validation("request body is not valid JSON", None))
}
fn list_options(raw: &HashMap<String, String>) -> (Filters, Option<i64>, i64) {
    let filters = Filters {
        kind: raw.get("type").cloned(),
        activity: raw.get("activity").cloned(),
        category: raw.get("category").cloned(),
        account: raw.get("account").cloned(),
        from: raw.get("from").cloned(),
        to: raw.get("to").cloned(),
    };
    let limit = raw
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .filter(|v| *v > 0)
        .map(|v| v.min(500));
    let offset = raw
        .get("offset")
        .and_then(|v| v.parse::<i64>().ok())
        .filter(|v| *v >= 0 && *v <= 1_000_000)
        .unwrap_or(0);
    (filters, limit, offset)
}

use std::collections::HashMap;

async fn list_handler(
    State(state): State<AppState>,
    user: AuthUser,
    Query(raw): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let (filters, limit, offset) = list_options(&raw);
    Ok(Json(
        json!({"data":list(&state.pool,&user.id,&state.encryption_key,&filters,limit,offset).await?}),
    ))
}
async fn create_handler(
    State(state): State<AppState>,
    user: AuthUser,
    body: Bytes,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    Ok((
        StatusCode::CREATED,
        Json(
            create(
                &state.pool,
                &user.id,
                &state.encryption_key,
                parse_json(body)?,
            )
            .await?,
        ),
    ))
}
async fn get_handler(
    State(state): State<AppState>,
    user: AuthUser,
    Path(raw): Path<String>,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        get(
            &state.pool,
            &user.id,
            parse_id(&raw)?,
            &state.encryption_key,
        )
        .await?,
    ))
}
async fn update_handler(
    State(state): State<AppState>,
    user: AuthUser,
    Path(raw): Path<String>,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        update(
            &state.pool,
            &user.id,
            parse_id(&raw)?,
            &state.encryption_key,
            parse_json(body)?,
        )
        .await?,
    ))
}
async fn delete_handler(
    State(state): State<AppState>,
    user: AuthUser,
    Path(raw): Path<String>,
) -> Result<StatusCode, ApiError> {
    delete(&state.pool, &user.id, parse_id(&raw)?).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn batch_create_handler(
    State(state): State<AppState>,
    user: AuthUser,
    body: Bytes,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    Ok((
        StatusCode::CREATED,
        Json(
            json!({"data":create_many(&state.pool,&user.id,&state.encryption_key,parse_json(body)?).await?}),
        ),
    ))
}
async fn batch_delete_handler(
    State(state): State<AppState>,
    user: AuthUser,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        delete_many(&state.pool, &user.id, parse_json(body)?).await?,
    ))
}

async fn page_handler(
    State(state): State<AppState>,
    user: AuthUser,
    Query(raw): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let (filters, _, _) = list_options(&raw);
    let page = raw
        .get("page")
        .and_then(|v| v.parse::<i64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(1);
    let size = raw
        .get("size")
        .and_then(|v| v.parse::<i64>().ok())
        .filter(|v| matches!(*v, 50 | 100 | 200 | 500))
        .unwrap_or(200);
    let mut count = QueryBuilder::<Postgres>::new("SELECT count(*) FROM transactions");
    filter_query(&mut count, &user.id, &filters)?;
    let total: i64 = count
        .build_query_scalar()
        .fetch_one(&state.pool)
        .await
        .map_err(db_error)?;
    let current = page.min(((total + size - 1) / size).max(1));
    let rows = list(
        &state.pool,
        &user.id,
        &state.encryption_key,
        &filters,
        Some(size),
        (current - 1) * size,
    )
    .await?;
    Ok(Json(json!({"rows":rows,"total":total,"page":current})))
}

pub fn public_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/transactions",
            axum_get(list_handler).post(create_handler),
        )
        .route(
            "/api/v1/transactions/{id}",
            axum_get(get_handler)
                .put(update_handler)
                .patch(update_handler)
                .delete(delete_handler),
        )
        .route(
            "/api/v1/transactions/batch",
            post(batch_create_handler).delete(batch_delete_handler),
        )
}
pub fn internal_routes() -> Router<AppState> {
    Router::new().route("/internal/v1/transactions/page", axum_get(page_handler))
}

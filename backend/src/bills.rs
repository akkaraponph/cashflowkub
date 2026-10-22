use std::collections::HashMap;

use axum::{
    Json, Router,
    body::Bytes,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
};
use chrono::{Datelike, NaiveDate};
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool, Row, postgres::PgRow};

use crate::{auth::AuthUser, config::AppState, error::ApiError};

const CURRENT_MONTH: &str = "2026-06";
const TODAY: (i32, u32, u32) = (2026, 6, 18);

#[derive(Clone, Debug)]
struct Bill {
    id: i32,
    name: String,
    th: String,
    icon: String,
    tint: String,
    amount: i32,
    due_day: i32,
    freq: String,
    cat: String,
    kind: String,
    start_month: String,
    end_month: String,
    every_months: i32,
    sort: i32,
    paid: bool,
}

fn error(message: impl Into<String>, code: Option<&str>) -> ApiError {
    ApiError::BadRequest(message.into(), code.map(str::to_owned))
}
fn month_valid(value: &str) -> bool {
    let b = value.as_bytes();
    b.len() == 7
        && b[0..4].iter().all(u8::is_ascii_digit)
        && b[4] == b'-'
        && matches!(
            value.get(5..),
            Some("01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12")
        )
}
fn month_or_current(value: Option<&str>) -> Result<String, ApiError> {
    match value {
        None => Ok(CURRENT_MONTH.to_owned()),
        Some(v) if month_valid(v) => Ok(v.to_owned()),
        Some(_) => Err(error("invalid month", Some("validation"))),
    }
}
fn month_index(value: &str) -> i64 {
    let year = value[0..4].parse::<i64>().unwrap_or(0);
    let month = value[5..7].parse::<i64>().unwrap_or(1);
    year * 12 + month - 1
}
fn occurs(b: &Bill, month: &str) -> bool {
    if month < b.start_month.as_str() || (!b.end_month.is_empty() && month > b.end_month.as_str()) {
        return false;
    }
    if b.freq == "once" {
        return month == b.start_month;
    }
    (month_index(month) - month_index(&b.start_month)) % i64::from(b.every_months) == 0
}
fn days_in_month(month: &str) -> u32 {
    let year = month[0..4].parse::<i32>().unwrap_or(2026);
    let m = month[5..7].parse::<u32>().unwrap_or(1);
    let (ny, nm) = if m == 12 {
        (year + 1, 1)
    } else {
        (year, m + 1)
    };
    NaiveDate::from_ymd_opt(ny, nm, 1)
        .and_then(|d| d.pred_opt())
        .map(|d| d.day())
        .unwrap_or(30)
}
fn view(b: &Bill, month: &str, paid: bool) -> Value {
    let day = b.due_day.min(days_in_month(month) as i32).max(1) as u32;
    let due = NaiveDate::from_ymd_opt(
        month[0..4].parse().unwrap_or(2026),
        month[5..7].parse().unwrap_or(6),
        day,
    )
    .unwrap();
    let today = NaiveDate::from_ymd_opt(TODAY.0, TODAY.1, TODAY.2).unwrap();
    let days_diff = (due - today).num_days();
    let status = if paid {
        "paid"
    } else if days_diff < 0 {
        "overdue"
    } else if days_diff == 0 {
        "dueToday"
    } else if days_diff <= 5 {
        "dueSoon"
    } else {
        "upcoming"
    };
    json!({"id":b.id,"name":b.name,"th":b.th,"icon":b.icon,"tint":b.tint,"amount":b.amount,"dueDay":b.due_day,"freq":b.freq,"cat":b.cat,"kind":b.kind,"startMonth":b.start_month,"endMonth":b.end_month,"everyMonths":b.every_months,"sort":b.sort,"paid":paid,"month":month,"dueDate":due.format("%Y-%m-%d").to_string(),"status":status,"daysDiff":days_diff})
}
fn read_bill(row: PgRow) -> Result<Bill, ApiError> {
    Ok(Bill {
        id: row.try_get("id").map_err(|_| ApiError::Internal)?,
        name: row.try_get("name").map_err(|_| ApiError::Internal)?,
        th: row.try_get("th").map_err(|_| ApiError::Internal)?,
        icon: row.try_get("icon").map_err(|_| ApiError::Internal)?,
        tint: row.try_get("tint").map_err(|_| ApiError::Internal)?,
        amount: row.try_get("amount").map_err(|_| ApiError::Internal)?,
        due_day: row.try_get("due_day").map_err(|_| ApiError::Internal)?,
        freq: row.try_get("freq").map_err(|_| ApiError::Internal)?,
        cat: row.try_get("cat_key").map_err(|_| ApiError::Internal)?,
        kind: row.try_get("kind").map_err(|_| ApiError::Internal)?,
        start_month: row.try_get("start_month").map_err(|_| ApiError::Internal)?,
        end_month: row.try_get("end_month").map_err(|_| ApiError::Internal)?,
        every_months: row
            .try_get("every_months")
            .map_err(|_| ApiError::Internal)?,
        sort: row.try_get("sort").map_err(|_| ApiError::Internal)?,
        paid: row.try_get("paid_month").map_err(|_| ApiError::Internal)?,
    })
}
const SELECT_BILL: &str = "SELECT b.id,b.name,b.th,b.icon,b.tint,b.amount,b.due_day,b.freq,b.cat_key,b.kind,b.start_month,b.end_month,b.every_months,b.sort,EXISTS(SELECT 1 FROM bill_payments p WHERE p.bill_id=b.id AND p.user_id=b.user_id AND p.month=$2) paid_month FROM bills b";
fn db_error(_: sqlx::Error) -> ApiError {
    ApiError::Internal
}

#[derive(Default)]
struct Fields {
    name: Option<String>,
    th: Option<String>,
    icon: Option<String>,
    tint: Option<String>,
    amount: Option<i32>,
    due_day: Option<i32>,
    freq: Option<String>,
    cat: Option<String>,
    kind: Option<String>,
    start_month: Option<String>,
    end_month: Option<String>,
    every_months: Option<i32>,
    sort: Option<i32>,
}
fn fields(body: Value, partial: bool) -> Result<Fields, ApiError> {
    let o = body
        .as_object()
        .ok_or_else(|| error("request body must be an object", None))?;
    let string = |key: &str| -> Result<Option<String>, ApiError> {
        match o.get(key) {
            None => Ok(None),
            Some(Value::String(s)) => Ok(Some(s.clone())),
            Some(_) => Err(error(format!("{key}: Expected string"), Some("validation"))),
        }
    };
    let integer = |key: &str| -> Result<Option<i32>, ApiError> {
        match o.get(key) {
            None => Ok(None),
            Some(v) => v
                .as_i64()
                .and_then(|n| i32::try_from(n).ok())
                .map(Some)
                .ok_or_else(|| error(format!("{key}: Expected integer"), Some("validation"))),
        }
    };
    let mut f = Fields {
        name: string("name")?.map(|s| s.trim().to_owned()),
        th: string("th")?,
        icon: string("icon")?,
        tint: string("tint")?,
        amount: integer("amount")?,
        due_day: integer("dueDay")?,
        freq: string("freq")?,
        cat: string("cat")?,
        kind: string("kind")?,
        start_month: string("startMonth")?,
        end_month: string("endMonth")?,
        every_months: integer("everyMonths")?,
        sort: integer("sort")?,
    };
    if f.name.as_ref().is_some_and(String::is_empty) {
        return Err(error(
            "name: String must contain at least 1 character(s)",
            Some("validation"),
        ));
    }
    if !partial && (f.name.is_none() || f.amount.is_none() || f.due_day.is_none()) {
        return Err(error(
            "name, amount, and dueDay are required",
            Some("validation"),
        ));
    }
    if f.amount.is_some_and(|n| n < 0) {
        return Err(error("amount must be non-negative", Some("validation")));
    }
    if f.due_day.is_some_and(|n| !(1..=31).contains(&n)) {
        return Err(error("dueDay must be between 1 and 31", Some("validation")));
    }
    if f.freq
        .as_deref()
        .is_some_and(|v| v != "monthly" && v != "once")
    {
        return Err(error("freq: Invalid enum value", Some("validation")));
    }
    if f.kind
        .as_deref()
        .is_some_and(|v| v != "bill" && v != "subscription")
    {
        return Err(error("kind: Invalid enum value", Some("validation")));
    }
    if f.every_months.is_some_and(|n| !(1..=12).contains(&n)) {
        return Err(error(
            "everyMonths must be between 1 and 12",
            Some("validation"),
        ));
    }
    for month in [f.start_month.as_deref(), f.end_month.as_deref()]
        .into_iter()
        .flatten()
    {
        if !month.is_empty() && !month_valid(month) {
            return Err(error("must be a month like 2026-06", Some("validation")));
        }
    }
    if !partial {
        f.start_month
            .get_or_insert_with(|| CURRENT_MONTH.to_owned());
    }
    Ok(f)
}
fn merge(current: &Bill, f: Fields) -> Result<Fields, ApiError> {
    let f = Fields {
        name: f.name.or_else(|| Some(current.name.clone())),
        th: f.th.or_else(|| Some(current.th.clone())),
        icon: f.icon.or_else(|| Some(current.icon.clone())),
        tint: f.tint.or_else(|| Some(current.tint.clone())),
        amount: f.amount.or(Some(current.amount)),
        due_day: f.due_day.or(Some(current.due_day)),
        freq: f.freq.or_else(|| Some(current.freq.clone())),
        cat: f.cat.or_else(|| Some(current.cat.clone())),
        kind: f.kind.or_else(|| Some(current.kind.clone())),
        start_month: f.start_month.or_else(|| Some(current.start_month.clone())),
        end_month: f.end_month.or_else(|| Some(current.end_month.clone())),
        every_months: f.every_months.or(Some(current.every_months)),
        sort: f.sort.or(Some(current.sort)),
    };
    let a = f.start_month.as_deref().unwrap_or(CURRENT_MONTH);
    let z = f.end_month.as_deref().unwrap_or("");
    if !z.is_empty() && z < a {
        return Err(error(
            "endMonth must not be before startMonth",
            Some("validation"),
        ));
    }
    Ok(f)
}
fn read_body(body: Bytes, optional: bool) -> Result<Value, ApiError> {
    if body.is_empty() {
        if optional {
            return Ok(json!({}));
        }
        return Err(error("request body is required", None));
    }
    serde_json::from_slice(&body).map_err(|_| error("request body is not valid JSON", None))
}
async fn list_bills(
    pool: &PgPool,
    user: &str,
    month: &str,
    kind: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<Value>, ApiError> {
    let rows = sqlx::query(&format!(
        "{SELECT_BILL} WHERE b.user_id=$1 ORDER BY b.due_day,b.sort,b.id"
    ))
    .bind(user)
    .bind(month)
    .fetch_all(pool)
    .await
    .map_err(db_error)?;
    let mut out = Vec::new();
    for row in rows {
        let b = read_bill(row)?;
        if !occurs(&b, month)
            || kind.is_some_and(|k| (k == "bill" || k == "subscription") && b.kind != k)
        {
            continue;
        }
        if status == Some("paid") && !b.paid || status == Some("unpaid") && b.paid {
            continue;
        }
        out.push(view(&b, month, b.paid));
    }
    Ok(out)
}
async fn get_bill(
    tx: &mut PgConnection,
    user: &str,
    id: i32,
    month: &str,
) -> Result<Bill, ApiError> {
    let query = format!("{SELECT_BILL} WHERE b.user_id=$1 AND b.id=$3 FOR UPDATE OF b");
    let row = sqlx::query(&query)
        .bind(user)
        .bind(month)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_error)?
        .ok_or(ApiError::NotFound)?;
    read_bill(row)
}
async fn create_bill(pool: &PgPool, user: &str, body: Value) -> Result<Value, ApiError> {
    let f = fields(body, false)?;
    let start = f.start_month.unwrap_or_else(|| CURRENT_MONTH.into());
    let end = f.end_month.unwrap_or_default();
    if !end.is_empty() && end < start {
        return Err(error(
            "endMonth must not be before startMonth",
            Some("validation"),
        ));
    }
    let row=sqlx::query("INSERT INTO bills(user_id,name,th,icon,tint,amount,due_day,freq,cat_key,kind,start_month,end_month,every_months,sort) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,name,th,icon,tint,amount,due_day,freq,cat_key,kind,start_month,end_month,every_months,sort,false paid_month") .bind(user).bind(f.name.unwrap()).bind(f.th.unwrap_or_default()).bind(f.icon.unwrap_or_else(||"receipt".into())).bind(f.tint.unwrap_or_else(||"pdf".into())).bind(f.amount.unwrap()).bind(f.due_day.unwrap()).bind(f.freq.unwrap_or_else(||"monthly".into())).bind(f.cat.unwrap_or_else(||"bills".into())).bind(f.kind.unwrap_or_else(||"bill".into())).bind(start).bind(end).bind(f.every_months.unwrap_or(1)).bind(f.sort.unwrap_or(0)).fetch_one(pool).await.map_err(db_error)?;
    let b = read_bill(row)?;
    Ok(view(&b, CURRENT_MONTH, false))
}
async fn update_bill(pool: &PgPool, user: &str, id: i32, body: Value) -> Result<Value, ApiError> {
    let partial = fields(body, true)?;
    let mut tx = pool.begin().await.map_err(db_error)?;
    let current = get_bill(&mut tx, user, id, CURRENT_MONTH).await?;
    let f = merge(&current, partial)?;
    let row=sqlx::query("UPDATE bills SET name=$3,th=$4,icon=$5,tint=$6,amount=$7,due_day=$8,freq=$9,cat_key=$10,kind=$11,start_month=$12,end_month=$13,every_months=$14,sort=$15 WHERE user_id=$1 AND id=$2 RETURNING id,name,th,icon,tint,amount,due_day,freq,cat_key,kind,start_month,end_month,every_months,sort,false paid_month").bind(user).bind(id).bind(f.name.unwrap()).bind(f.th.unwrap_or_default()).bind(f.icon.unwrap_or_default()).bind(f.tint.unwrap_or_default()).bind(f.amount.unwrap()).bind(f.due_day.unwrap()).bind(f.freq.unwrap()).bind(f.cat.unwrap()).bind(f.kind.unwrap()).bind(f.start_month.unwrap()).bind(f.end_month.unwrap()).bind(f.every_months.unwrap()).bind(f.sort.unwrap()).fetch_one(&mut *tx).await.map_err(db_error)?;
    let mut b = read_bill(row)?;
    let paid: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM bill_payments WHERE bill_id=$1 AND month=$2 AND user_id=$3)",
    )
    .bind(id)
    .bind(CURRENT_MONTH)
    .bind(user)
    .fetch_one(&mut *tx)
    .await
    .map_err(db_error)?;
    b.paid = paid;
    tx.commit().await.map_err(db_error)?;
    Ok(view(&b, CURRENT_MONTH, paid))
}
async fn delete_bill(pool: &PgPool, user: &str, id: i32) -> Result<(), ApiError> {
    let r = sqlx::query("DELETE FROM bills WHERE user_id=$1 AND id=$2")
        .bind(user)
        .bind(id)
        .execute(pool)
        .await
        .map_err(db_error)?;
    if r.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(())
}
async fn toggle_paid(pool: &PgPool, user: &str, id: i32, body: Value) -> Result<Value, ApiError> {
    let o = body
        .as_object()
        .ok_or_else(|| error("request body must be an object", None))?;
    let paid = match o.get("paid") {
        None => None,
        Some(Value::Bool(v)) => Some(*v),
        Some(_) => return Err(error("paid: Expected boolean", Some("validation"))),
    };
    let month = match o.get("month") {
        None => CURRENT_MONTH.to_owned(),
        Some(Value::String(m)) if month_valid(m) => m.clone(),
        Some(Value::String(_)) => return Err(error("invalid month", Some("validation"))),
        Some(_) => return Err(error("month: Expected string", Some("validation"))),
    };
    let mut tx = pool.begin().await.map_err(db_error)?;
    let bill = get_bill(&mut tx, user, id, &month).await?;
    if !occurs(&bill, &month) {
        return Err(ApiError::BadRequest(
            "bill does not occur in that month".into(),
            Some("billNotInMonth".into()),
        ));
    }
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM bill_payments WHERE user_id=$1 AND bill_id=$2 AND month=$3)",
    )
    .bind(user)
    .bind(id)
    .bind(&month)
    .fetch_one(&mut *tx)
    .await
    .map_err(db_error)?;
    let desired = paid.unwrap_or(!exists);
    if desired && !exists {
        sqlx::query("INSERT INTO bill_payments(user_id,bill_id,month) VALUES($1,$2,$3)")
            .bind(user)
            .bind(id)
            .bind(&month)
            .execute(&mut *tx)
            .await
            .map_err(db_error)?;
    } else if !desired && exists {
        sqlx::query("DELETE FROM bill_payments WHERE user_id=$1 AND bill_id=$2 AND month=$3")
            .bind(user)
            .bind(id)
            .bind(&month)
            .execute(&mut *tx)
            .await
            .map_err(db_error)?;
    }
    tx.commit().await.map_err(db_error)?;
    Ok(view(&bill, &month, desired))
}
async fn bills_get(
    State(s): State<AppState>,
    u: AuthUser,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let month = month_or_current(q.get("month").map(String::as_str))?;
    let kind = q.get("kind").map(String::as_str);
    let status = q
        .get("status")
        .filter(|s| s.as_str() == "paid" || s.as_str() == "unpaid")
        .map(String::as_str);
    Ok(Json(
        json!({"data":list_bills(&s.pool,&u.id,&month,kind,status).await?}),
    ))
}
async fn bills_post(
    State(s): State<AppState>,
    u: AuthUser,
    b: Bytes,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    Ok((
        StatusCode::CREATED,
        Json(create_bill(&s.pool, &u.id, read_body(b, false)?).await?),
    ))
}
async fn summary(
    State(s): State<AppState>,
    u: AuthUser,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let month = month_or_current(q.get("month").map(String::as_str))?;
    let bills = list_bills(&s.pool, &u.id, &month, None, None).await?;
    let days = sqlx::query(
        "SELECT id,day,amount,month FROM day_spends WHERE user_id=$1 AND month=$2 ORDER BY day",
    )
    .bind(&u.id)
    .bind(&month)
    .fetch_all(&s.pool)
    .await
    .map_err(db_error)?;
    let mut total = 0_i64;
    let mut paid = 0_i64;
    let mut subs = 0_i64;
    let mut subs_total = 0_i64;
    let mut next = None;
    for b in &bills {
        let amount = b["amount"].as_i64().unwrap_or(0);
        total += amount;
        if b["kind"] == "subscription" {
            subs += 1;
            subs_total += amount
        }
        if b["paid"] == true {
            paid += amount
        } else if next.is_none() {
            next = Some(b.clone())
        }
    }
    let day_spend=days.into_iter().map(|r|json!({"id":r.get::<i32,_>("id"),"day":r.get::<i32,_>("day"),"amount":r.get::<i32,_>("amount"),"month":r.get::<String,_>("month")})).collect::<Vec<_>>();
    Ok(Json(
        json!({"total":total,"paid":paid,"remaining":total-paid,"count":bills.len(),"month":month,"today":TODAY.2,"nextBill":next,"daySpend":day_spend,"subscriptionsCount":subs,"subscriptionsTotal":subs_total}),
    ))
}
async fn bill_update(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
    b: Bytes,
) -> Result<Json<Value>, ApiError> {
    let id = parse_id(&raw)?;
    Ok(Json(
        update_bill(&s.pool, &u.id, id, read_body(b, false)?).await?,
    ))
}
async fn bill_delete(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
) -> Result<StatusCode, ApiError> {
    delete_bill(&s.pool, &u.id, parse_id(&raw)?).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn bill_pay(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
    b: Bytes,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        toggle_paid(&s.pool, &u.id, parse_id(&raw)?, read_body(b, true)?).await?,
    ))
}
fn parse_id(raw: &str) -> Result<i32, ApiError> {
    if raw.is_empty() || raw.len() > 9 || !raw.bytes().all(|b| b.is_ascii_digit()) {
        return Err(error(format!("invalid id: {raw}"), None));
    }
    raw.parse()
        .map_err(|_| error(format!("invalid id: {raw}"), None))
}
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/bills", get(bills_get).post(bills_post))
        .route("/api/v1/bills/summary", get(summary))
        .route(
            "/api/v1/bills/{id}",
            axum::routing::put(bill_update)
                .patch(bill_update)
                .delete(bill_delete),
        )
        .route("/api/v1/bills/{id}/pay", axum::routing::patch(bill_pay))
}

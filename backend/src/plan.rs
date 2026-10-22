use crate::{auth::AuthUser, config::AppState, error::ApiError};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
};
use serde_json::{Value, json};
use sqlx::{PgPool, Row, postgres::PgRow};
use std::collections::HashMap;

fn bad(message: impl Into<String>) -> ApiError {
    ApiError::BadRequest(message.into(), None)
}
fn valid_month(m: &str) -> bool {
    let b = m.as_bytes();
    b.len() == 7
        && b[0..4].iter().all(u8::is_ascii_digit)
        && b[4] == b'-'
        && matches!(
            m.get(5..),
            Some("01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12")
        )
}
fn db_error(_: sqlx::Error) -> ApiError {
    ApiError::Internal
}
#[derive(Clone)]
struct Item {
    id: i32,
    kind: String,
    name: String,
    th: String,
    icon: String,
    tint: String,
    cat: String,
    sub: String,
    planned: i32,
    actual: i32,
    month: String,
    sort: i32,
}
fn read_item(r: PgRow) -> Result<Item, ApiError> {
    Ok(Item {
        id: r.try_get("id").map_err(db_error)?,
        kind: r.try_get("type").map_err(db_error)?,
        name: r.try_get("name").map_err(db_error)?,
        th: r.try_get("th").map_err(db_error)?,
        icon: r.try_get("icon").map_err(db_error)?,
        tint: r.try_get("tint").map_err(db_error)?,
        cat: r.try_get("cat_key").map_err(db_error)?,
        sub: r.try_get("sub").map_err(db_error)?,
        planned: r.try_get("planned").map_err(db_error)?,
        actual: r.try_get("actual").map_err(db_error)?,
        month: r.try_get("month").map_err(db_error)?,
        sort: r.try_get("sort").map_err(db_error)?,
    })
}
impl Item {
    fn json(&self) -> Value {
        json!({"id":self.id,"type":self.kind,"name":self.name,"th":self.th,"icon":self.icon,"tint":self.tint,"cat":self.cat,"sub":self.sub,"planned":self.planned,"actual":self.actual,"month":self.month,"sort":self.sort})
    }
}
const SELECT: &str =
    "SELECT id,type,name,th,icon,tint,cat_key,sub,planned,actual,month,sort FROM plan_items";
fn group(kind: &str, items: &[Item]) -> Value {
    let rows: Vec<_> = items.iter().filter(|i| i.kind == kind).collect();
    let planned: i64 = rows.iter().map(|i| i.planned as i64).sum();
    let actual: i64 = rows.iter().map(|i| i.actual as i64).sum();
    json!({"type":kind,"items":rows.iter().map(|i|i.json()).collect::<Vec<_>>(),"totalPlanned":planned,"totalActual":actual,"variance":actual-planned})
}
fn ratio(actual: i64, planned: i64) -> f64 {
    if planned == 0 {
        0.0
    } else {
        actual as f64 / planned as f64 * 100.0
    }
}
fn build(items: &[Item]) -> Value {
    let income = group("income", items);
    let expense = group("expense", items);
    let savings = group("savings", items);
    let ip = income["totalPlanned"].as_i64().unwrap_or(0);
    let ia = income["totalActual"].as_i64().unwrap_or(0);
    let ep = expense["totalPlanned"].as_i64().unwrap_or(0);
    let ea = expense["totalActual"].as_i64().unwrap_or(0);
    let sp = savings["totalPlanned"].as_i64().unwrap_or(0);
    let sa = savings["totalActual"].as_i64().unwrap_or(0);
    let planned_net = ip - ep - sp;
    let actual_net = ia - ea - sa;
    json!({"income":income,"expense":expense,"savings":savings,"summary":{"plannedNet":planned_net,"actualNet":actual_net,"netVariance":actual_net-planned_net,"incomeRatio":ratio(ia,ip),"expenseUsage":ratio(ea,ep),"savingsRatio":ratio(sa,sp)}})
}
async fn get_plan(pool: &PgPool, user: &str, month: Option<&str>) -> Result<Value, ApiError> {
    if month.is_some_and(|m| !valid_month(m)) {
        return Err(bad(format!(
            "invalid month: {} (expected YYYY-MM)",
            month.unwrap_or_default()
        )));
    }
    let mut q = format!("{SELECT} WHERE user_id=$1");
    if month.is_some() {
        q.push_str(" AND month=$2")
    }
    q.push_str(" ORDER BY sort,id");
    let mut query = sqlx::query(&q).bind(user);
    if let Some(m) = month {
        query = query.bind(m)
    }
    let rows = query.fetch_all(pool).await.map_err(db_error)?;
    let items = rows
        .into_iter()
        .map(read_item)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(build(&items))
}
#[derive(Default)]
struct Fields {
    kind: Option<String>,
    name: Option<String>,
    th: Option<String>,
    icon: Option<String>,
    tint: Option<String>,
    cat: Option<String>,
    sub: Option<String>,
    planned: Option<i32>,
    actual: Option<i32>,
    month: Option<String>,
    sort: Option<i32>,
}
fn parse(body: Value, partial: bool) -> Result<Fields, ApiError> {
    let o = body
        .as_object()
        .ok_or_else(|| bad("request body must be an object"))?;
    let text = |k: &str| -> Result<Option<String>, ApiError> {
        match o.get(k) {
            None => Ok(None),
            Some(Value::String(s)) => Ok(Some(s.clone())),
            Some(_) => Err(bad(format!("{k}: Expected string"))),
        }
    };
    let int = |k: &str, nonneg: bool| -> Result<Option<i32>, ApiError> {
        match o.get(k) {
            None => Ok(None),
            Some(v) => {
                let n = v
                    .as_i64()
                    .and_then(|n| i32::try_from(n).ok())
                    .ok_or_else(|| bad(format!("{k}: Expected integer")))?;
                if nonneg && n < 0 {
                    return Err(bad(format!("{k}: Expected non-negative integer")));
                }
                Ok(Some(n))
            }
        }
    };
    let f = Fields {
        kind: text("type")?,
        name: text("name")?.map(|s| s.trim().to_owned()),
        th: text("th")?,
        icon: text("icon")?,
        tint: text("tint")?,
        cat: text("cat")?,
        sub: text("sub")?,
        planned: int("planned", true)?,
        actual: int("actual", true)?,
        month: text("month")?,
        sort: int("sort", false)?,
    };
    if f.kind
        .as_deref()
        .is_some_and(|v| !matches!(v, "income" | "expense" | "savings"))
    {
        return Err(bad("type: Invalid enum value"));
    }
    if f.name.as_ref().is_some_and(String::is_empty) {
        return Err(bad("name: String must contain at least 1 character(s)"));
    }
    if f.month.as_deref().is_some_and(|m| !valid_month(m)) {
        return Err(bad("month must be YYYY-MM"));
    }
    if !partial && (f.kind.is_none() || f.name.is_none() || f.month.is_none()) {
        return Err(bad("type, name, and month are required"));
    }
    Ok(f)
}
fn read_body(b: Bytes) -> Result<Value, ApiError> {
    if b.is_empty() {
        return Err(bad("request body is required"));
    }
    serde_json::from_slice(&b).map_err(|_| bad("request body is not valid JSON"))
}
fn merge(i: &Item, f: Fields) -> Item {
    Item {
        id: i.id,
        kind: f.kind.unwrap_or_else(|| i.kind.clone()),
        name: f.name.unwrap_or_else(|| i.name.clone()),
        th: f.th.unwrap_or_else(|| i.th.clone()),
        icon: f.icon.unwrap_or_else(|| i.icon.clone()),
        tint: f.tint.unwrap_or_else(|| i.tint.clone()),
        cat: f.cat.unwrap_or_else(|| i.cat.clone()),
        sub: f.sub.unwrap_or_else(|| i.sub.clone()),
        planned: f.planned.unwrap_or(i.planned),
        actual: f.actual.unwrap_or(i.actual),
        month: f.month.unwrap_or_else(|| i.month.clone()),
        sort: f.sort.unwrap_or(i.sort),
    }
}
async fn create(pool: &PgPool, user: &str, body: Value) -> Result<Value, ApiError> {
    let mut f = parse(body, false)?;
    let mut tx = pool.begin().await.map_err(db_error)?;
    if f.sort.is_none() {
        let max: Option<i32> = sqlx::query_scalar(
            "SELECT max(sort) FROM plan_items WHERE user_id=$1 AND month=$2 AND type=$3",
        )
        .bind(user)
        .bind(f.month.as_deref().unwrap())
        .bind(f.kind.as_deref().unwrap())
        .fetch_one(&mut *tx)
        .await
        .map_err(db_error)?;
        f.sort = Some(max.unwrap_or(0) + 1)
    }
    let row=sqlx::query("INSERT INTO plan_items(user_id,type,name,th,icon,tint,cat_key,sub,planned,actual,month,sort) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,type,name,th,icon,tint,cat_key,sub,planned,actual,month,sort").bind(user).bind(f.kind.unwrap()).bind(f.name.unwrap()).bind(f.th.unwrap_or_default()).bind(f.icon.unwrap_or_default()).bind(f.tint.unwrap_or_default()).bind(f.cat.unwrap_or_default()).bind(f.sub.unwrap_or_default()).bind(f.planned.unwrap_or(0)).bind(f.actual.unwrap_or(0)).bind(f.month.unwrap()).bind(f.sort.unwrap()).fetch_one(&mut *tx).await.map_err(db_error)?;
    let item = read_item(row)?;
    tx.commit().await.map_err(db_error)?;
    Ok(item.json())
}
async fn update(pool: &PgPool, user: &str, id: i32, body: Value) -> Result<Value, ApiError> {
    let f = parse(body, true)?;
    let mut tx = pool.begin().await.map_err(db_error)?;
    let row = sqlx::query(&format!("{SELECT} WHERE user_id=$1 AND id=$2 FOR UPDATE"))
        .bind(user)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_error)?
        .ok_or(ApiError::NotFound)?;
    let updated = merge(&read_item(row)?, f);
    let row=sqlx::query("UPDATE plan_items SET type=$3,name=$4,th=$5,icon=$6,tint=$7,cat_key=$8,sub=$9,planned=$10,actual=$11,month=$12,sort=$13 WHERE user_id=$1 AND id=$2 RETURNING id,type,name,th,icon,tint,cat_key,sub,planned,actual,month,sort").bind(user).bind(id).bind(updated.kind).bind(updated.name).bind(updated.th).bind(updated.icon).bind(updated.tint).bind(updated.cat).bind(updated.sub).bind(updated.planned).bind(updated.actual).bind(updated.month).bind(updated.sort).fetch_one(&mut *tx).await.map_err(db_error)?;
    let item = read_item(row)?;
    tx.commit().await.map_err(db_error)?;
    Ok(item.json())
}
async fn delete(pool: &PgPool, user: &str, id: i32) -> Result<(), ApiError> {
    let r = sqlx::query("DELETE FROM plan_items WHERE user_id=$1 AND id=$2")
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
async fn snapshots(pool: &PgPool, user: &str) -> Result<Value, ApiError> {
    let snaps=sqlx::query("SELECT id,name,th,grp,icon,tint,prev,curr,month,sort FROM asset_snapshots WHERE user_id=$1 ORDER BY sort,id").bind(user).fetch_all(pool).await.map_err(db_error)?;
    let history=sqlx::query("SELECT id,month,month_th,value,sort FROM net_worth_histories WHERE user_id=$1 ORDER BY sort,id").bind(user).fetch_all(pool).await.map_err(db_error)?;
    let mut groups: Vec<Value> = Vec::new();
    for r in snaps {
        let item = json!({"id":r.get::<i32,_>("id"),"name":r.get::<String,_>("name"),"th":r.get::<String,_>("th"),"group":r.get::<String,_>("grp"),"icon":r.get::<String,_>("icon"),"tint":r.get::<String,_>("tint"),"prev":r.get::<i32,_>("prev"),"curr":r.get::<i32,_>("curr"),"month":r.get::<String,_>("month"),"sort":r.get::<i32,_>("sort")});
        let g = item["group"].as_str().unwrap_or("");
        if let Some(existing) = groups.iter_mut().find(|v| v["group"] == g) {
            existing["prev"] =
                json!(existing["prev"].as_i64().unwrap_or(0) + item["prev"].as_i64().unwrap_or(0));
            existing["curr"] =
                json!(existing["curr"].as_i64().unwrap_or(0) + item["curr"].as_i64().unwrap_or(0));
            existing["items"].as_array_mut().unwrap().push(item)
        } else {
            groups.push(json!({"group":g,"items":[item],"prev":item["prev"],"curr":item["curr"]}))
        }
    }
    let prev: i64 = groups.iter().map(|g| g["prev"].as_i64().unwrap_or(0)).sum();
    let curr: i64 = groups.iter().map(|g| g["curr"].as_i64().unwrap_or(0)).sum();
    let hist:Vec<Value>=history.into_iter().map(|r|json!({"id":r.get::<i32,_>("id"),"month":r.get::<String,_>("month"),"monthTh":r.get::<String,_>("month_th"),"value":r.get::<i32,_>("value"),"sort":r.get::<i32,_>("sort")})).collect();
    Ok(
        json!({"groups":groups,"prev":prev,"curr":curr,"delta":curr-prev,"history":hist,"labels":{"prev":"May 2026","curr":"Jun 2026","prevTh":"พ.ค. 2026","currTh":"มิ.ย. 2026","lastUpdate":"May 31, 2026"}}),
    )
}
fn id(raw: &str) -> Result<i32, ApiError> {
    if raw.is_empty() || raw.len() > 9 || !raw.bytes().all(|b| b.is_ascii_digit()) {
        return Err(bad(format!("invalid id: {raw}")));
    }
    raw.parse().map_err(|_| bad(format!("invalid id: {raw}")))
}
async fn get_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        get_plan(&s.pool, &u.id, q.get("month").map(String::as_str)).await?,
    ))
}
async fn post_handler(
    State(s): State<AppState>,
    u: AuthUser,
    b: Bytes,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    Ok((
        StatusCode::CREATED,
        Json(create(&s.pool, &u.id, read_body(b)?).await?),
    ))
}
async fn update_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
    b: Bytes,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        update(&s.pool, &u.id, id(&raw)?, read_body(b)?).await?,
    ))
}
async fn delete_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
) -> Result<StatusCode, ApiError> {
    delete(&s.pool, &u.id, id(&raw)?).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn snaps_handler(State(s): State<AppState>, u: AuthUser) -> Result<Json<Value>, ApiError> {
    Ok(Json(snapshots(&s.pool, &u.id).await?))
}
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/plan", get(get_handler).post(post_handler))
        .route("/api/v1/plan/snapshots", get(snaps_handler))
        .route(
            "/api/v1/plan/{id}",
            axum::routing::put(update_handler)
                .patch(update_handler)
                .delete(delete_handler),
        )
}

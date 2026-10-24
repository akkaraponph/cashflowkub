use crate::{
    auth::AuthUser, bills, config::AppState, crypto::decrypt_field, debts, error::ApiError,
};
use axum::{Json, Router, extract::State, routing::get};
use serde_json::{Map, Value, json};
use sqlx::{PgPool, Row, postgres::PgRow};
use std::collections::HashMap;

const MONTH: &str = "2026-06";
fn api_err(_: sqlx::Error) -> ApiError {
    ApiError::Internal
}
fn camel(s: &str) -> String {
    let mut o = String::new();
    let mut upper = false;
    for c in s.chars() {
        if c == '_' {
            upper = true
        } else if upper {
            o.extend(c.to_uppercase());
            upper = false
        } else {
            o.push(c)
        }
    }
    o
}
fn api_row(v: Value) -> Value {
    let Some(obj) = v.as_object() else { return v };
    let mut out = Map::new();
    for (k, v) in obj {
        if k == "user_id" {
            continue;
        }
        let key = match k.as_str() {
            "cat_key" => "cat".into(),
            "limit_amt" => "limit".into(),
            "grp" => "group".into(),
            _ => camel(k),
        };
        out.insert(key, v.clone());
    }
    Value::Object(out)
}
async fn rows(pool: &PgPool, user: &str, table: &str, order: &str) -> Result<Vec<Value>, ApiError> {
    let q = format!("SELECT to_jsonb(t) AS row FROM {table} t WHERE user_id=$1 ORDER BY {order}");
    sqlx::query(&q)
        .bind(user)
        .fetch_all(pool)
        .await
        .map_err(api_err)?
        .into_iter()
        .map(|r| r.try_get::<Value, _>("row").map(api_row).map_err(api_err))
        .collect()
}
async fn expense_rows(pool: &PgPool, user: &str) -> Result<Vec<PgRow>, ApiError> {
    sqlx::query("SELECT id,name,cat_key,account,amount,note,interest,fee,goal,activity,item,date FROM transactions WHERE user_id=$1 AND amount<0 ORDER BY date DESC,id DESC")
        .bind(user).fetch_all(pool).await.map_err(api_err)
}
async fn debt_views(s: &AppState, u: &str, active: bool) -> Result<Vec<Value>, ApiError> {
    debts::all_views(&s.pool, u, &s.encryption_key, active).await
}
async fn handler_dashboard(
    State(s): State<AppState>,
    u: AuthUser,
) -> Result<Json<Value>, ApiError> {
    let (assets, debts, budgets, cats, flow, bills, goals, hist) = tokio::try_join!(
        rows(&s.pool, &u.id, "assets", "value DESC"),
        debt_views(&s, &u.id, true),
        rows(&s.pool, &u.id, "budgets", "spent DESC"),
        rows(&s.pool, &u.id, "categories", "sort ASC"),
        rows(&s.pool, &u.id, "monthly_cashflows", "sort ASC"),
        bills::all_views(&s.pool, &u.id, MONTH, Some("unpaid")),
        rows(&s.pool, &u.id, "goals", "sort ASC"),
        rows(&s.pool, &u.id, "net_worth_histories", "sort ASC")
    )?;
    let total_assets: i64 = assets
        .iter()
        .map(|x| x["value"].as_i64().unwrap_or(0))
        .sum();
    let total_liab: i64 = debts
        .iter()
        .map(|x| x["remaining"].as_i64().unwrap_or(0))
        .sum();
    let (mut original, mut paid, mut remaining) = (0i64, 0i64, 0i64);
    let mut focus: Option<Value> = None;
    for d in &debts {
        let o = d["original"].as_i64().unwrap_or(0);
        let p = d["paid"].as_i64().unwrap_or(0);
        original += o;
        paid += p;
        remaining += o - p;
        if focus
            .as_ref()
            .is_none_or(|f| d["apr"].as_f64().unwrap_or(0.0) > f["apr"].as_f64().unwrap_or(0.0))
        {
            focus = Some(d.clone())
        }
    }
    let lookup: HashMap<String, &Value> = cats
        .iter()
        .filter_map(|c| Some((c["key"].as_str()?.into(), c)))
        .collect();
    let spend_total: i64 = budgets
        .iter()
        .map(|b| b["spent"].as_i64().unwrap_or(0))
        .sum();
    let spending:Vec<Value>=budgets.iter().map(|b|{let c=lookup.get(b["cat"].as_str().unwrap_or(""));let spent=b["spent"].as_i64().unwrap_or(0);json!({"cat":b["cat"],"label":c.map(|x|&x["label"]).unwrap_or(&Value::Null),"th":c.map(|x|&x["th"]).unwrap_or(&Value::Null),"tint":c.map(|x|&x["tint"]).unwrap_or(&Value::Null),"icon":c.map(|x|&x["icon"]).unwrap_or(&Value::Null),"spent":spent,"pct":if spend_total>0{spent as f64/spend_total as f64*100.0}else{0.0}})}).collect();
    let last = flow.last();
    let income = last.and_then(|x| x["income"].as_i64()).unwrap_or(0);
    let expense = last.and_then(|x| x["expense"].as_i64()).unwrap_or(0);
    let net_worth_hist = hist;
    let next_bill = bills.first().cloned();
    Ok(Json(
        json!({"netWorth":total_assets-total_liab,"totalAssets":total_assets,"totalLiab":total_liab,"month":{"income":income,"expense":expense,"net":income-expense},"cashflow":flow,"spending":spending,"spendTotal":spend_total,"debt":{"original":original,"paid":paid,"remaining":remaining,"progress":if original>0{paid as f64/original as f64}else{0.0},"focus":focus},"nextBill":next_bill,"goals":goals,"netWorthHist":net_worth_hist}),
    ))
}
async fn handler_networth(State(s): State<AppState>, u: AuthUser) -> Result<Json<Value>, ApiError> {
    let (assets, liabilities, history) = tokio::try_join!(
        rows(&s.pool, &u.id, "assets", "value DESC"),
        debt_views(&s, &u.id, true),
        rows(&s.pool, &u.id, "net_worth_histories", "sort ASC")
    )?;
    let total_assets: i64 = assets
        .iter()
        .map(|x| x["value"].as_i64().unwrap_or(0))
        .sum();
    let total_liab: i64 = liabilities
        .iter()
        .map(|x| x["remaining"].as_i64().unwrap_or(0))
        .sum();
    let mut liab = liabilities;
    liab.sort_by_key(|x| std::cmp::Reverse(x["remaining"].as_i64().unwrap_or(0)));
    Ok(Json(
        json!({"netWorth":total_assets-total_liab,"totalAssets":total_assets,"totalLiab":total_liab,"assets":assets,"liabilities":liab,"history":history}),
    ))
}
async fn handler_reports(State(s): State<AppState>, u: AuthUser) -> Result<Json<Value>, ApiError> {
    let (budgets, cats, txs, monthly) = tokio::try_join!(
        rows(&s.pool, &u.id, "budgets", "spent DESC"),
        rows(&s.pool, &u.id, "categories", "sort ASC"),
        expense_rows(&s.pool, &u.id),
        rows(&s.pool, &u.id, "monthly_cashflows", "sort ASC")
    )?;
    let lookup: HashMap<String, &Value> = cats
        .iter()
        .filter_map(|c| Some((c["key"].as_str()?.into(), c)))
        .collect();
    let total: i64 = budgets
        .iter()
        .map(|x| x["spent"].as_i64().unwrap_or(0))
        .sum();
    let breakdown:Vec<Value>=budgets.iter().map(|b|{let c=lookup.get(b["cat"].as_str().unwrap_or(""));let spent=b["spent"].as_i64().unwrap_or(0);json!({"cat":b["cat"],"label":c.map(|x|x["label"].clone()).unwrap_or(json!("")),"th":c.map(|x|x["th"].clone()).unwrap_or(json!("")),"tint":c.map(|x|x["tint"].clone()).unwrap_or(json!("")),"icon":c.map(|x|x["icon"].clone()).unwrap_or(json!("")),"spent":spent,"pct":if total>0{spent as f64/total as f64*100.0}else{0.0}})}).collect();
    let mut merchant_positions: HashMap<String, usize> = HashMap::new();
    let mut merchants: Vec<(String, String, f64)> = Vec::new();
    for r in txs {
        let name = decrypt_field(
            &r.try_get::<String, _>("name").map_err(api_err)?,
            &s.encryption_key,
        )
        .map_err(|_| ApiError::Internal)?;
        let cat: String = r.try_get("cat_key").map_err(api_err)?;
        let amt: f64 = r
            .try_get::<rust_decimal::Decimal, _>("amount")
            .map_err(api_err)?
            .to_string()
            .parse()
            .unwrap_or(0.0);
        if let Some(index) = merchant_positions.get(&name).copied() {
            merchants[index].1 = cat;
            merchants[index].2 += -amt;
        } else {
            merchant_positions.insert(name.clone(), merchants.len());
            merchants.push((name, cat, -amt));
        }
    }
    merchants.sort_by(|a, b| b.2.total_cmp(&a.2));
    let top: Vec<Value> = merchants
        .into_iter()
        .take(6)
        .map(|(name, cat, total)| json!({"name":name,"cat":cat,"total":total}))
        .collect();
    Ok(Json(
        json!({"breakdown":breakdown,"spendTotal":total,"topMerchants":top,"monthly":monthly}),
    ))
}
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/dashboard", get(handler_dashboard))
        .route("/api/v1/networth", get(handler_networth))
        .route("/api/v1/reports", get(handler_reports))
}

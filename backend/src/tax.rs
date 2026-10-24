use crate::{auth::AuthUser, config::AppState, error::ApiError};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{Query, State},
    routing::get,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::Row;

const RULES_YEAR: i32 = 2025;
#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Input {
    salary: i64,
    freelance: i64,
    other_net: i64,
    withheld: i64,
    spouse: bool,
    children: i32,
    children2018_extra: i32,
    parents: i32,
    disabled_dependents: i32,
    maternity: i64,
    social_security: i64,
    life_insurance: i64,
    health_insurance: i64,
    parent_health_insurance: i64,
    pension_insurance: i64,
    pvd: i64,
    gpf: i64,
    nsf: i64,
    rmf: i64,
    ssf: i64,
    thai_esg: i64,
    home_loan_interest: i64,
    easy_e_receipt: i64,
    donation: i64,
    donation_double: i64,
}
fn add(lines: &mut Vec<(String, i64, i64)>, key: &str, claimed: i64, allowed: i64) {
    lines.push((key.into(), claimed, allowed));
}
fn bad() -> ApiError {
    ApiError::BadRequest("invalid tax input".into(), Some("validation".into()))
}
fn validate(i: &Input) -> Result<(), ApiError> {
    let money = [
        i.salary,
        i.freelance,
        i.other_net,
        i.withheld,
        i.maternity,
        i.social_security,
        i.life_insurance,
        i.health_insurance,
        i.parent_health_insurance,
        i.pension_insurance,
        i.pvd,
        i.gpf,
        i.nsf,
        i.rmf,
        i.ssf,
        i.thai_esg,
        i.home_loan_interest,
        i.easy_e_receipt,
        i.donation,
        i.donation_double,
    ];
    if money.iter().any(|x| !(0..=1_000_000_000).contains(x))
        || !(0..=20).contains(&i.children)
        || !(0..=20).contains(&i.children2018_extra)
        || i.children2018_extra > (i.children - 1).max(0)
        || !(0..=4).contains(&i.parents)
        || !(0..=10).contains(&i.disabled_dependents)
    {
        return Err(bad());
    }
    Ok(())
}
#[derive(Deserialize)]
struct Year {
    year: Option<String>,
}
fn year(q: &Year) -> Result<i32, ApiError> {
    let Some(s) = q.year.as_deref().filter(|s| !s.is_empty()) else {
        return Ok(2026);
    };
    let y = s.parse::<i32>().map_err(|_| bad())?;
    if !(2000..=2100).contains(&y) {
        return Err(bad());
    }
    Ok(y)
}
fn calculate(i: &Input, year: i32, saved: bool) -> Value {
    let income = i.salary + i.freelance + i.other_net;
    let expense = (((i.salary + i.freelance) as f64 * 0.5).round() as i64).min(100_000);
    let mut lines: Vec<(String, i64, i64)> = Vec::new();
    add(&mut lines, "personal", 60_000, 60_000);
    add(
        &mut lines,
        "spouse",
        if i.spouse { 60_000 } else { 0 },
        if i.spouse { 60_000 } else { 0 },
    );
    let extra = i.children2018_extra.min((i.children - 1).max(0));
    let child = i.children as i64 * 30_000 + extra as i64 * 30_000;
    add(&mut lines, "children", child, child);
    add(
        &mut lines,
        "parents",
        i.parents as i64 * 30_000,
        i.parents.min(4) as i64 * 30_000,
    );
    add(
        &mut lines,
        "disabled",
        i.disabled_dependents as i64 * 60_000,
        i.disabled_dependents as i64 * 60_000,
    );
    let cap = |v: i64, m: i64| v.max(0).min(m.max(0));
    add(
        &mut lines,
        "maternity",
        i.maternity,
        cap(i.maternity, 60_000),
    );
    add(
        &mut lines,
        "socialSecurity",
        i.social_security,
        cap(i.social_security, 9_000),
    );
    let life = cap(i.life_insurance, 100_000);
    add(&mut lines, "lifeInsurance", i.life_insurance, life);
    add(
        &mut lines,
        "healthInsurance",
        i.health_insurance,
        cap(i.health_insurance, 25_000.min(100_000 - life)),
    );
    add(
        &mut lines,
        "parentHealthInsurance",
        i.parent_health_insurance,
        cap(i.parent_health_insurance, 15_000),
    );
    let mut room = 500_000i64;
    let retire = [
        (
            "pvd",
            i.pvd,
            ((i.salary as f64 * 0.15).floor() as i64).min(500_000),
        ),
        (
            "gpf",
            i.gpf,
            ((i.salary as f64 * 0.15).floor() as i64).min(500_000),
        ),
        ("nsf", i.nsf, 30_000),
        (
            "pensionInsurance",
            i.pension_insurance,
            ((income as f64 * 0.15).floor() as i64).min(200_000),
        ),
        (
            "rmf",
            i.rmf,
            ((income as f64 * 0.30).floor() as i64).min(500_000),
        ),
        (
            "ssf",
            i.ssf,
            ((income as f64 * 0.30).floor() as i64).min(200_000),
        ),
    ];
    for (k, c, m) in retire {
        let a = cap(c, m).min(room);
        room -= a;
        add(&mut lines, k, c, a)
    }
    let esg = ((income as f64 * 0.30).floor() as i64).min(300_000);
    add(&mut lines, "thaiEsg", i.thai_esg, cap(i.thai_esg, esg));
    add(
        &mut lines,
        "homeLoanInterest",
        i.home_loan_interest,
        cap(i.home_loan_interest, 100_000),
    );
    let er = if year == RULES_YEAR {
        i.easy_e_receipt
    } else {
        0
    };
    add(
        &mut lines,
        "easyEReceipt",
        i.easy_e_receipt,
        cap(er, if year == RULES_YEAR { 50_000 } else { 0 }),
    );
    let used: i64 = lines.iter().map(|x| x.2).sum();
    let dcap = (((income - expense - used).max(0) as f64) * 0.1).floor() as i64;
    let double = (i.donation_double * 2).min(dcap);
    lines.push(("donationDouble".into(), i.donation_double * 2, double));
    lines.push((
        "donation".into(),
        i.donation,
        (i.donation.max(0)).min(dcap - double),
    ));
    let order = [
        "personal",
        "spouse",
        "children",
        "parents",
        "disabled",
        "maternity",
        "socialSecurity",
        "lifeInsurance",
        "healthInsurance",
        "parentHealthInsurance",
        "pensionInsurance",
        "pvd",
        "gpf",
        "nsf",
        "rmf",
        "ssf",
        "thaiEsg",
        "homeLoanInterest",
        "easyEReceipt",
        "donationDouble",
        "donation",
    ];
    let deductions: Vec<Value> = order
        .iter()
        .filter_map(|key| lines.iter().find(|x| x.0 == *key))
        .filter(|x| x.0 == "personal" || x.1 > 0 || x.2 > 0)
        .map(|x| json!({"key":x.0,"claimed":x.1,"allowed":x.2,"capped":x.2<x.1}))
        .collect();
    let total: i64 = deductions
        .iter()
        .map(|x| x["allowed"].as_i64().unwrap_or(0))
        .sum();
    let net = (income - expense - total).max(0);
    let bands = [
        (150_000i64, 0.0),
        (300_000, 0.05),
        (500_000, 0.10),
        (750_000, 0.15),
        (1_000_000, 0.20),
        (2_000_000, 0.25),
        (5_000_000, 0.30),
        (i64::MAX, 0.35),
    ];
    let (mut lower, mut tax, mut marginal) = (0i64, 0i64, 0.0);
    let mut out = Vec::new();
    for (up, rate) in bands {
        let amount = (net.min(up) - lower).max(0);
        if amount > 0 {
            let due = (amount as f64 * rate).round() as i64;
            tax += due;
            marginal = rate;
            out.push(json!({"rate":rate,"taxable":amount,"tax":due}));
        }
        lower = up;
        if net <= up {
            break;
        }
    }
    let unused = room.max(0);
    let allowed = |key: &str| lines.iter().find(|x| x.0 == key).map(|x| x.2).unwrap_or(0);
    json!({"year":year,"rulesYear":RULES_YEAR,"assumed":year!=RULES_YEAR,"saved":saved,"input":i,"result":{"income":income,"expense":expense,"deductions":deductions,"totalDeductions":total,"netIncome":net,"bands":out,"tax":tax,"marginalRate":marginal,"effectiveRate":if income>0{tax as f64/income as f64}else{0.0},"withheld":i.withheld,"balance":tax-i.withheld,"room":{"rmf":unused.min((500_000-allowed("rmf")).max(0)),"ssf":unused.min((200_000-allowed("ssf")).max(0)),"thaiEsg":(esg-lines.iter().find(|x|x.0=="thaiEsg").map(|x|x.2).unwrap_or(0)).max(0)}}})
}
async fn handler(
    State(s): State<AppState>,
    u: AuthUser,
    Query(q): Query<Year>,
    body: Option<Bytes>,
) -> Result<Json<Value>, ApiError> {
    let y = year(&q)?;
    let key = format!("tax:{y}");
    let mut input = None;
    if let Some(b) = body {
        let parsed: Input = serde_json::from_slice(&b).map_err(|_| bad())?;
        validate(&parsed)?;
        let value = serde_json::to_string(&parsed).map_err(|_| ApiError::Internal)?;
        sqlx::query("INSERT INTO settings(user_id,key,value) VALUES($1,$2,$3) ON CONFLICT(user_id,key) DO UPDATE SET value=EXCLUDED.value").bind(&u.id).bind(&key).bind(value).execute(&s.pool).await.map_err(|_|ApiError::Internal)?;
        input = Some(parsed);
    }
    if input.is_none() {
        let row = sqlx::query("SELECT value FROM settings WHERE user_id=$1 AND key=$2")
            .bind(&u.id)
            .bind(&key)
            .fetch_optional(&s.pool)
            .await
            .map_err(|_| ApiError::Internal)?;
        if let Some(r) = row {
            let v: String = r.try_get("value").map_err(|_| ApiError::Internal)?;
            input = serde_json::from_str::<Input>(&v)
                .ok()
                .filter(|i| validate(i).is_ok());
        }
    }
    let saved = input.is_some();
    let i = match input {
        Some(i) => i,
        None => {
            let r =
                sqlx::query("SELECT value FROM settings WHERE user_id=$1 AND key='monthlyIncome'")
                    .bind(&u.id)
                    .fetch_optional(&s.pool)
                    .await
                    .map_err(|_| ApiError::Internal)?;
            let monthly = if let Some(value) = r.and_then(|x| x.try_get::<String, _>("value").ok())
            {
                value.parse::<i64>().unwrap_or(0)
            } else {
                sqlx::query_scalar::<_, i32>("SELECT income FROM monthly_cashflows WHERE user_id=$1 ORDER BY sort DESC LIMIT 1")
                    .bind(&u.id).fetch_optional(&s.pool).await.map_err(|_|ApiError::Internal)?.unwrap_or(0) as i64
            };
            Input {
                salary: monthly * 12,
                ..Input::default()
            }
        }
    };
    Ok(Json(calculate(&i, y, saved)))
}
pub fn routes() -> Router<AppState> {
    Router::new().route("/api/v1/tax", get(get_tax).put(put_tax))
}
async fn get_tax(s: State<AppState>, u: AuthUser, q: Query<Year>) -> Result<Json<Value>, ApiError> {
    handler(s, u, q, None).await
}
async fn put_tax(
    s: State<AppState>,
    u: AuthUser,
    q: Query<Year>,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    handler(s, u, q, Some(body)).await
}

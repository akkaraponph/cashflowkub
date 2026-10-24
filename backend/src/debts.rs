use crate::{
    auth::AuthUser,
    config::AppState,
    crypto::{decrypt_field, encrypt_field},
    error::ApiError,
};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
};
use chrono::{Datelike, Duration, NaiveDate};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Row, Transaction, types::chrono::NaiveDate as SqlDate};
use std::collections::HashMap;

const TODAY: SqlDate = match NaiveDate::from_ymd_opt(2026, 6, 18) {
    Some(d) => d,
    None => unreachable!(),
};
const MAX_MONTHS: usize = 600;
const KINDS: &[&str] = &["paylater", "cashloan", "bankloan", "creditcard", "personal"];
#[derive(Clone, Debug)]
struct Debt {
    id: i32,
    name: String,
    th: String,
    icon: String,
    tint: String,
    kind: String,
    lender: String,
    original: i32,
    opening_paid: i32,
    paid: i32,
    apr: f64,
    calc: String,
    monthly: i32,
    fixed_payment: i32,
    term_months: i32,
    due_day: i32,
    grace_days: i32,
    late_fee: i32,
    penalty_apr: f64,
    done: bool,
    revolving: bool,
    sort: i32,
}
#[derive(Clone, Debug)]
struct Payment {
    id: i32,
    debt_id: i32,
    date: SqlDate,
    amount: i32,
    principal: i32,
    interest: i32,
    fee: i32,
    note: String,
}
const SELECT: &str = "SELECT id,name,th,icon,tint,kind,lender,original,opening_paid,paid,apr,calc,monthly,fixed_payment,term_months,due_day,grace_days,late_fee,penalty_apr,done,revolving,sort FROM debts";
const PAYMENT_SELECT: &str =
    "SELECT id,debt_id,date,amount,principal,interest,fee,note FROM debt_payments";
fn db(e: sqlx::Error) -> ApiError {
    eprintln!("debt database error: {e}");
    ApiError::Internal
}
fn bad(message: impl Into<String>, code: Option<&str>) -> ApiError {
    ApiError::BadRequest(message.into(), code.map(str::to_owned))
}
fn debt(r: sqlx::postgres::PgRow, key: &[u8; 32]) -> Result<Debt, ApiError> {
    Ok(Debt {
        id: r.try_get("id").map_err(db)?,
        name: r.try_get("name").map_err(db)?,
        th: r.try_get("th").map_err(db)?,
        icon: r.try_get("icon").map_err(db)?,
        tint: r.try_get("tint").map_err(db)?,
        kind: r.try_get("kind").map_err(db)?,
        lender: decrypt_field(&r.try_get::<String, _>("lender").map_err(db)?, key)
            .map_err(|_| ApiError::Internal)?,
        original: r.try_get("original").map_err(db)?,
        opening_paid: r.try_get("opening_paid").map_err(db)?,
        paid: r.try_get("paid").map_err(db)?,
        apr: r.try_get("apr").map_err(db)?,
        calc: r.try_get("calc").map_err(db)?,
        monthly: r.try_get("monthly").map_err(db)?,
        fixed_payment: r.try_get("fixed_payment").map_err(db)?,
        term_months: r.try_get("term_months").map_err(db)?,
        due_day: r.try_get("due_day").map_err(db)?,
        grace_days: r.try_get("grace_days").map_err(db)?,
        late_fee: r.try_get("late_fee").map_err(db)?,
        penalty_apr: r.try_get("penalty_apr").map_err(db)?,
        done: r.try_get("done").map_err(db)?,
        revolving: r.try_get("revolving").map_err(db)?,
        sort: r.try_get("sort").map_err(db)?,
    })
}
fn payment(r: sqlx::postgres::PgRow, key: &[u8; 32]) -> Result<Payment, ApiError> {
    Ok(Payment {
        id: r.try_get("id").map_err(db)?,
        debt_id: r.try_get("debt_id").map_err(db)?,
        date: r.try_get("date").map_err(db)?,
        amount: r.try_get("amount").map_err(db)?,
        principal: r.try_get("principal").map_err(db)?,
        interest: r.try_get("interest").map_err(db)?,
        fee: r.try_get("fee").map_err(db)?,
        note: decrypt_field(&r.try_get::<String, _>("note").map_err(db)?, key)
            .map_err(|_| ApiError::Internal)?,
    })
}
async fn load(
    pool: &PgPool,
    user: &str,
    id: i32,
    key: &[u8; 32],
) -> Result<(Debt, Vec<Payment>), ApiError> {
    let mut conn = pool.acquire().await.map_err(db)?;
    load_conn(&mut conn, user, id, key).await
}
async fn load_conn(
    conn: &mut sqlx::PgConnection,
    user: &str,
    id: i32,
    key: &[u8; 32],
) -> Result<(Debt, Vec<Payment>), ApiError> {
    let r = sqlx::query(&format!("{SELECT} WHERE user_id=$1 AND id=$2"))
        .bind(user)
        .bind(id)
        .fetch_optional(&mut *conn)
        .await
        .map_err(db)?
        .ok_or(ApiError::NotFound)?;
    let d = debt(r, key)?;
    let rs = sqlx::query(&format!(
        "{PAYMENT_SELECT} WHERE user_id=$1 AND debt_id=$2 ORDER BY date,id"
    ))
    .bind(user)
    .bind(id)
    .fetch_all(&mut *conn)
    .await
    .map_err(db)?;
    Ok((
        d,
        rs.into_iter()
            .map(|r| payment(r, key))
            .collect::<Result<_, _>>()?,
    ))
}
fn remain(d: &Debt) -> i32 {
    (d.original - d.paid).max(0)
}
fn interest(d: &Debt, balance: i32) -> i32 {
    if balance <= 0 {
        return 0;
    }
    let base = if d.calc == "reducing" {
        balance
    } else {
        d.original
    };
    let v = base as f64 * d.apr / 1200.0;
    if d.calc == "fixed" {
        (v + 1e-6).floor() as i32
    } else {
        v.round() as i32
    }
}
fn installment(d: &Debt) -> i32 {
    if d.fixed_payment > 0 {
        return d.fixed_payment;
    }
    if d.term_months > 0 {
        let n = d.term_months as f64;
        let r = d.apr / 1200.0;
        if d.calc != "reducing" {
            return (d.original as f64 / n).ceil() as i32 + interest(d, d.original);
        }
        if r == 0.0 {
            return (d.original as f64 / n).ceil() as i32;
        }
        return ((d.original as f64 * r) / (1.0 - (1.0 + r).powf(-n))).round() as i32;
    }
    d.monthly
}
fn amount_due(d: &Debt) -> i32 {
    installment(d).min(remain(d) + interest(d, remain(d)))
}
fn next_month(y: i32, m: u32, delta: i32) -> (i32, u32) {
    let z = y * 12 + (m as i32 - 1) + delta;
    (z.div_euclid(12), z.rem_euclid(12) as u32 + 1)
}
fn due_date(y: i32, m: u32, day: i32) -> SqlDate {
    let (y, m) = next_month(y, m, 0);
    let first = NaiveDate::from_ymd_opt(y, m, 1).unwrap();
    let last = next_month(y, m, 1);
    let end = NaiveDate::from_ymd_opt(last.0, last.1, 1).unwrap() - Duration::days(1);
    NaiveDate::from_ymd_opt(y, m, day.min(end.day() as i32) as u32).unwrap_or(first)
}
fn due(d: &Debt, ps: &[Payment], now: SqlDate) -> Value {
    let this = due_date(now.year(), now.month(), d.due_day);
    let prev = due_date(
        next_month(now.year(), now.month(), -1).0,
        next_month(now.year(), now.month(), -1).1,
        d.due_day,
    );
    let next = due_date(
        next_month(now.year(), now.month(), 1).0,
        next_month(now.year(), now.month(), 1).1,
        d.due_day,
    );
    let cycle = prev + Duration::days(1);
    let paid: i32 = ps
        .iter()
        .filter(|p| p.date >= cycle)
        .map(|p| p.amount)
        .sum();
    let amount = amount_due(d);
    let days = (this - now).num_days() as i32;
    let (state, due_date, days_until, days_late, late_fee) = if d.done || remain(d) <= 0 {
        ("closed", this, 0, 0, 0)
    } else if paid >= amount {
        ("paid", next, (next - now).num_days() as i32, 0, 0)
    } else if now <= this {
        (
            if days == 0 {
                "dueToday"
            } else if days <= 5 {
                "dueSoon"
            } else {
                "upcoming"
            },
            this,
            days,
            0,
            0,
        )
    } else {
        let late = -days;
        let unpaid = amount - paid;
        let fee = if late > d.grace_days {
            d.late_fee
                + ((unpaid as f64 * d.penalty_apr / 100.0 / 365.0 * late as f64).round() as i32)
        } else {
            0
        };
        ("overdue", this, days, late, fee)
    };
    json!({"state":state,"dueDate":due_date.format("%Y-%m-%d").to_string(),"daysUntil":days_until,"daysLate":days_late,"cycleStart":cycle.format("%Y-%m-%d").to_string(),"amountDue":if state=="closed"{0}else{amount},"paidThisCycle":paid,"lateFee":late_fee})
}
fn schedule(d: &Debt) -> (Vec<Value>, i32, bool) {
    let mut bal = remain(d);
    let mut rows = Vec::new();
    let mut total = 0;
    if bal > 0 && installment(d) <= 0 {
        return (rows, total, true);
    }
    for m in 1..=MAX_MONTHS {
        if bal <= 0 {
            break;
        }
        let i = interest(d, bal);
        let principal = (installment(d) - i).min(bal);
        if principal <= 0 {
            return (Vec::new(), 0, true);
        }
        bal -= principal;
        total += i;
        rows.push(json!({"month":m,"payment":principal+i,"principal":principal,"interest":i,"balance":bal}));
    }
    if bal > 0 {
        (Vec::new(), 0, true)
    } else {
        (rows, total, false)
    }
}
fn label(months: usize, th: bool) -> String {
    let (y, m) = next_month(TODAY.year(), TODAY.month(), months as i32);
    let en = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let thai = [
        "ม.ค.",
        "ก.พ.",
        "มี.ค.",
        "เม.ย.",
        "พ.ค.",
        "มิ.ย.",
        "ก.ค.",
        "ส.ค.",
        "ก.ย.",
        "ต.ค.",
        "พ.ย.",
        "ธ.ค.",
    ];
    format!(
        "{} {}",
        if th {
            thai[m as usize - 1]
        } else {
            en[m as usize - 1]
        },
        y
    )
}
fn view(d: &Debt, ps: &[Payment], now: SqlDate) -> Value {
    let (rows, total, never) = schedule(d);
    let closed = d.done || d.paid >= d.original;
    let due = due(d, ps, now);
    json!({"id":d.id,"name":d.name,"th":d.th,"icon":d.icon,"tint":d.tint,"kind":d.kind,"lender":d.lender,"original":d.original,"openingPaid":d.opening_paid,"paid":d.paid,"apr":d.apr,"calc":d.calc,"monthly":d.monthly,"fixedPayment":d.fixed_payment,"termMonths":d.term_months,"dueDay":d.due_day,"graceDays":d.grace_days,"lateFee":d.late_fee,"penaltyApr":d.penalty_apr,"done":d.done,"revolving":d.revolving,"sort":d.sort,"remaining":remain(d),"progress":if d.original>0{d.paid as f64/d.original as f64}else{0.0},"installment":if closed{0}else{amount_due(d)},"monthsLeft":rows.len(),"payoff":if closed{"".to_owned()}else if never{"—".to_owned()}else{label(rows.len(),false)},"payoffTh":if closed{"".to_owned()}else if never{"—".to_owned()}else{label(rows.len(),true)},"totalInterestLeft":total,"neverPaysOff":never,"due":due})
}
fn schedule_view(d: &Debt, ps: &[Payment], now: SqlDate) -> Value {
    let v = view(d, ps, now);
    let (rows, total, never) = schedule(d);
    json!({"debt":v,"schedule":rows,"totalInterest":total,"months":rows.len(),"neverPaysOff":never})
}
fn payment_view(p: &Payment) -> Value {
    json!({"id":p.id,"debtId":p.debt_id,"date":p.date.format("%Y-%m-%d").to_string(),"amount":p.amount,"principal":p.principal,"interest":p.interest,"fee":p.fee,"note":p.note})
}
fn parse_date(s: &str) -> Option<SqlDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .ok()
        .or_else(|| {
            chrono::DateTime::parse_from_rfc3339(s)
                .ok()
                .map(|d| d.with_timezone(&chrono::Utc).date_naive())
        })
        .or_else(|| {
            ["%b %-d, %Y", "%B %-d, %Y"]
                .iter()
                .find_map(|f| NaiveDate::parse_from_str(s, f).ok())
        })
}
fn rows_to_debts(rs: Vec<sqlx::postgres::PgRow>, key: &[u8; 32]) -> Result<Vec<Debt>, ApiError> {
    rs.into_iter().map(|r| debt(r, key)).collect()
}
async fn load_payments(
    pool: &PgPool,
    user: &str,
    id: i32,
    key: &[u8; 32],
) -> Result<Vec<Payment>, ApiError> {
    sqlx::query(&format!(
        "{PAYMENT_SELECT} WHERE user_id=$1 AND debt_id=$2 ORDER BY date,id"
    ))
    .bind(user)
    .bind(id)
    .fetch_all(pool)
    .await
    .map_err(db)?
    .into_iter()
    .map(|r| payment(r, key))
    .collect()
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Fields {
    name: Option<String>,
    th: Option<String>,
    icon: Option<String>,
    tint: Option<String>,
    kind: Option<String>,
    lender: Option<String>,
    original: Option<i32>,
    opening_paid: Option<i32>,
    apr: Option<f64>,
    calc: Option<String>,
    monthly: Option<i32>,
    fixed_payment: Option<i32>,
    term_months: Option<i32>,
    due_day: Option<i32>,
    grace_days: Option<i32>,
    late_fee: Option<i32>,
    penalty_apr: Option<f64>,
    revolving: Option<bool>,
    sort: Option<i32>,
}
fn fields(body: Bytes, partial: bool) -> Result<Fields, ApiError> {
    let f: Fields = serde_json::from_slice(&body)
        .map_err(|_| bad("request body must be an object", Some("validation")))?;
    if !partial
        && (f.name.as_deref().unwrap_or("").trim().is_empty() || f.original.is_none_or(|x| x <= 0))
    {
        return Err(bad(
            "name and positive original are required",
            Some("validation"),
        ));
    }
    if f.name.as_ref().is_some_and(|x| x.trim().is_empty())
        || f.original.is_some_and(|x| x <= 0)
        || f.opening_paid.is_some_and(|x| x < 0)
        || f.monthly.is_some_and(|x| x < 0)
        || f.fixed_payment.is_some_and(|x| x < 0)
        || f.late_fee.is_some_and(|x| x < 0)
        || f.term_months.is_some_and(|x| !(0..=600).contains(&x))
        || f.due_day.is_some_and(|x| !(1..=31).contains(&x))
        || f.grace_days.is_some_and(|x| !(0..=60).contains(&x))
        || f.apr
            .is_some_and(|x| !x.is_finite() || !(0.0..=200.0).contains(&x))
        || f.penalty_apr
            .is_some_and(|x| !x.is_finite() || !(0.0..=200.0).contains(&x))
        || f.kind
            .as_ref()
            .is_some_and(|x| !KINDS.contains(&x.as_str()))
        || f.calc
            .as_ref()
            .is_some_and(|x| !["flat", "reducing", "fixed"].contains(&x.as_str()))
    {
        return Err(bad("invalid debt fields", Some("validation")));
    }
    Ok(f)
}
fn fixed_apr(original: i32, payment: i32, term: i32) -> f64 {
    (((payment as f64 * term as f64 - original as f64) / original as f64 / term as f64) * 1200.0)
        .max(0.0)
}
async fn list(
    pool: &PgPool,
    user: &str,
    status: Option<&str>,
    key: &[u8; 32],
) -> Result<Vec<Value>, ApiError> {
    let filter = match status {
        Some("active") => " AND done=false",
        Some("paid") => " AND done=true",
        _ => "",
    };
    let rs = sqlx::query(&format!(
        "{SELECT} WHERE user_id=$1{filter} ORDER BY done,sort,id"
    ))
    .bind(user)
    .fetch_all(pool)
    .await
    .map_err(db)?;
    let mut out = Vec::new();
    for r in rs {
        let d = debt(r, key)?;
        let ps = load_payments(pool, user, d.id, key).await?;
        out.push(view(&d, &ps, TODAY));
    }
    Ok(out)
}
pub(crate) async fn all_views(
    pool: &PgPool,
    user: &str,
    key: &[u8; 32],
    active: bool,
) -> Result<Vec<Value>, ApiError> {
    list(pool, user, if active { Some("active") } else { None }, key).await
}
async fn one(pool: &PgPool, user: &str, id: i32, key: &[u8; 32]) -> Result<Value, ApiError> {
    let (d, ps) = load(pool, user, id, key).await?;
    Ok(view(&d, &ps, TODAY))
}
async fn create(pool: &PgPool, user: &str, key: &[u8; 32], body: Bytes) -> Result<Value, ApiError> {
    let f = fields(body, false)?;
    let mut tx = pool.begin().await.map_err(db)?;
    name_lock(&mut tx, user).await?;
    name_free(&mut tx, user, f.name.as_deref().unwrap_or("").trim(), None).await?;
    let original = f.original.unwrap();
    let opening = f.opening_paid.unwrap_or(0);
    if opening > original {
        return Err(bad(
            "openingPaid cannot exceed original",
            Some("openingPaidExceeds"),
        ));
    }
    let calc = f.calc.unwrap_or_else(|| "reducing".into());
    let term = f.term_months.unwrap_or(0);
    let fixed = f.fixed_payment.unwrap_or(0);
    let apr = if calc == "fixed" {
        if fixed <= 0 || term <= 0 {
            return Err(bad(
                "a fixed instalment needs fixedPayment and termMonths",
                Some("fixedTermsRequired"),
            ));
        }
        if i64::from(fixed) * i64::from(term) < i64::from(original) {
            return Err(bad(
                "fixedPayment x termMonths cannot be less than original",
                Some("fixedTotalBelowOriginal"),
            ));
        }
        fixed_apr(original, fixed, term)
    } else {
        f.apr.unwrap_or(0.0)
    };
    let lender =
        encrypt_field(f.lender.as_deref().unwrap_or(""), key).map_err(|_| ApiError::Internal)?;
    let r=sqlx::query("INSERT INTO debts(name,th,icon,tint,kind,lender,original,opening_paid,paid,apr,calc,monthly,fixed_payment,term_months,due_day,grace_days,late_fee,penalty_apr,done,revolving,sort,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id").bind(f.name.unwrap().trim()).bind(f.th.unwrap_or_default()).bind(f.icon.unwrap_or_else(||"credit-card".into())).bind(f.tint.unwrap_or_else(||"pdf".into())).bind(f.kind.unwrap_or_else(||"personal".into())).bind(lender).bind(original).bind(opening).bind(apr).bind(calc).bind(f.monthly.unwrap_or(0)).bind(fixed).bind(term).bind(f.due_day.unwrap_or(1)).bind(f.grace_days.unwrap_or(0)).bind(f.late_fee.unwrap_or(0)).bind(f.penalty_apr.unwrap_or(0.0)).bind(opening>=original).bind(f.revolving.unwrap_or(false)).bind(f.sort.unwrap_or(0)).bind(user).fetch_one(&mut *tx).await.map_err(db)?;
    let (saved, ps) = load_conn(&mut tx, user, r.get("id"), key).await?;
    tx.commit().await.map_err(db)?;
    Ok(view(&saved, &ps, TODAY))
}
async fn lock(tx: &mut Transaction<'_, Postgres>, user: &str, id: i32) -> Result<(), ApiError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM debts WHERE user_id=$1 AND id=$2 FOR UPDATE)",
    )
    .bind(user)
    .bind(id)
    .fetch_one(&mut **tx)
    .await
    .map_err(db)?;
    if !exists {
        return Err(ApiError::NotFound);
    }
    Ok(())
}
async fn update(
    pool: &PgPool,
    user: &str,
    id: i32,
    key: &[u8; 32],
    body: Bytes,
) -> Result<Value, ApiError> {
    let f = fields(body, true)?;
    let mut tx = pool.begin().await.map_err(db)?;
    name_lock(&mut tx, user).await?;
    lock(&mut tx, user, id).await?;
    let (d, _) = load_conn(&mut tx, user, id, key).await?;
    let orig = f.original.unwrap_or(d.original);
    let opening = f.opening_paid.unwrap_or(d.opening_paid);
    if opening > orig {
        return Err(bad(
            "openingPaid cannot exceed original",
            Some("openingPaidExceeds"),
        ));
    }
    let principal: i32 = sqlx::query_scalar(
        "SELECT COALESCE(sum(principal),0)::int FROM debt_payments WHERE user_id=$1 AND debt_id=$2",
    )
    .bind(user)
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(db)?;
    if orig < opening + principal {
        return Err(bad(
            "original cannot be below principal already repaid",
            Some("originalBelowRepaid"),
        ));
    }
    let calc = f.calc.as_deref().unwrap_or(&d.calc);
    let fixed = f.fixed_payment.unwrap_or(d.fixed_payment);
    let term = f.term_months.unwrap_or(d.term_months);
    let apr = if calc == "fixed" {
        if fixed <= 0 || term <= 0 {
            return Err(bad(
                "a fixed instalment needs fixedPayment and termMonths",
                Some("fixedTermsRequired"),
            ));
        }
        if i64::from(fixed) * i64::from(term) < i64::from(orig) {
            return Err(bad(
                "fixedPayment x termMonths cannot be less than original",
                Some("fixedTotalBelowOriginal"),
            ));
        }
        Some(fixed_apr(orig, fixed, term))
    } else {
        f.apr
    };
    if let Some(name) = &f.name
        && name.trim() != d.name
    {
        name_free(&mut tx, user, name.trim(), Some(id)).await?;
        sqlx::query(
            "UPDATE transactions SET item=$3 WHERE user_id=$1 AND activity='pay_debt' AND item=$2",
        )
        .bind(user)
        .bind(&d.name)
        .bind(name.trim())
        .execute(&mut *tx)
        .await
        .map_err(db)?;
    }
    let lender = match f.lender {
        Some(x) => Some(encrypt_field(&x, key).map_err(|_| ApiError::Internal)?),
        None => None,
    };
    sqlx::query("UPDATE debts SET name=COALESCE($3,name),th=COALESCE($4,th),icon=COALESCE($5,icon),tint=COALESCE($6,tint),kind=COALESCE($7,kind),lender=COALESCE($8,lender),original=$9,opening_paid=$10,paid=$11,apr=COALESCE($12,apr),calc=COALESCE($13,calc),monthly=COALESCE($14,monthly),fixed_payment=$15,term_months=$16,due_day=COALESCE($17,due_day),grace_days=COALESCE($18,grace_days),late_fee=COALESCE($19,late_fee),penalty_apr=COALESCE($20,penalty_apr),revolving=COALESCE($21,revolving),sort=COALESCE($22,sort),done=($11>= $9) WHERE user_id=$1 AND id=$2").bind(user).bind(id).bind(f.name.map(|x|x.trim().to_owned())).bind(f.th).bind(f.icon).bind(f.tint).bind(f.kind).bind(lender).bind(orig).bind(opening).bind((opening+principal).min(orig)).bind(apr).bind(f.calc).bind(f.monthly).bind(f.fixed_payment.unwrap_or(d.fixed_payment)).bind(f.term_months.unwrap_or(d.term_months)).bind(f.due_day).bind(f.grace_days).bind(f.late_fee).bind(f.penalty_apr).bind(f.revolving).bind(f.sort).execute(&mut *tx).await.map_err(db)?;
    let (saved, ps) = load_conn(&mut tx, user, id, key).await?;
    tx.commit().await.map_err(db)?;
    Ok(view(&saved, &ps, TODAY))
}
async fn delete(pool: &PgPool, user: &str, id: i32) -> Result<(), ApiError> {
    let r=sqlx::query("DELETE FROM debts d WHERE user_id=$1 AND id=$2 AND NOT EXISTS(SELECT 1 FROM transactions t WHERE t.user_id=$1 AND t.activity='pay_debt' AND t.item=d.name)").bind(user).bind(id).execute(pool).await.map_err(db)?;
    if r.rows_affected() == 0 {
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM debts WHERE user_id=$1 AND id=$2)")
                .bind(user)
                .bind(id)
                .fetch_one(pool)
                .await
                .map_err(db)?;
        if !exists {
            return Err(ApiError::NotFound);
        }
        return Err(ApiError::Conflict(
            "debt is used by transactions".into(),
            "debtInUse".into(),
        ));
    }
    Ok(())
}
async fn pay(
    pool: &PgPool,
    user: &str,
    id: i32,
    key: &[u8; 32],
    body: Bytes,
) -> Result<Value, ApiError> {
    let v: Value = serde_json::from_slice(&body)
        .map_err(|_| bad("request body must be an object", Some("validation")))?;
    let amount = v
        .get("amount")
        .and_then(Value::as_i64)
        .filter(|x| *x > 0 && *x <= i32::MAX as i64)
        .ok_or_else(|| bad("amount must be a positive integer", Some("validation")))?
        as i32;
    let date = match v.get("date") {
        None => TODAY,
        Some(Value::String(s)) => {
            parse_date(s).ok_or_else(|| bad(format!("invalid date: {s}"), Some("invalidDate")))?
        }
        _ => return Err(bad("invalid date", Some("invalidDate"))),
    };
    let note = match v.get("note") {
        None => "",
        Some(Value::String(s)) => s,
        _ => return Err(bad("note: Expected string", Some("validation"))),
    };
    if note.chars().count() > 200 {
        return Err(bad(
            "note must be at most 200 characters",
            Some("validation"),
        ));
    }
    let note = encrypt_field(note, key).map_err(|_| ApiError::Internal)?;
    let mut tx = pool.begin().await.map_err(db)?;
    lock(&mut tx, user, id).await?;
    let (d, ps) = load_conn(&mut tx, user, id, key).await?;
    if d.done {
        return Err(ApiError::ConflictMessage(
            "this debt is already paid off".into(),
        ));
    }
    let status = due(&d, &ps, date);
    let cycle = NaiveDate::parse_from_str(status["cycleStart"].as_str().unwrap_or(""), "%Y-%m-%d")
        .map_err(|_| ApiError::Internal)?;
    let fees: i32 = ps.iter().filter(|p| p.date >= cycle).map(|p| p.fee).sum();
    let ints: i32 = ps
        .iter()
        .filter(|p| p.date >= cycle)
        .map(|p| p.interest)
        .sum();
    let fee_due = (status["lateFee"].as_i64().unwrap_or(0) as i32 - fees).max(0);
    let int_due = (interest(&d, remain(&d)) - ints).max(0);
    let fee = amount.min(fee_due);
    let int = (amount - fee).min(int_due);
    let principal = (amount - fee - int).min(remain(&d));
    let excess = amount - fee - int - principal;
    let applied = fee + int + principal;
    let r=sqlx::query("INSERT INTO debt_payments(debt_id,date,amount,principal,interest,fee,note,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,debt_id,date,amount,principal,interest,fee,note").bind(id).bind(date).bind(applied).bind(principal).bind(int).bind(fee).bind(note).bind(user).fetch_one(&mut *tx).await.map_err(db)?;
    let p = payment(r, key)?;
    let sum: i32 = sqlx::query_scalar(
        "SELECT COALESCE(sum(principal),0)::int FROM debt_payments WHERE user_id=$1 AND debt_id=$2",
    )
    .bind(user)
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(db)?;
    let paid = d.opening_paid.saturating_add(sum).min(d.original);
    sqlx::query("UPDATE debts SET paid=$3,done=($3>=original) WHERE user_id=$1 AND id=$2")
        .bind(user)
        .bind(id)
        .bind(paid)
        .execute(&mut *tx)
        .await
        .map_err(db)?;
    let (saved, ps) = load_conn(&mut tx, user, id, key).await?;
    let saved = view(&saved, &ps, TODAY);
    tx.commit().await.map_err(db)?;
    Ok(json!({"payment":payment_view(&p),"debt":saved,"excess":excess}))
}
async fn delete_payment(
    pool: &PgPool,
    user: &str,
    id: i32,
    pid: i32,
    key: &[u8; 32],
) -> Result<Value, ApiError> {
    let mut tx = pool.begin().await.map_err(db)?;
    lock(&mut tx, user, id).await?;
    let r = sqlx::query("DELETE FROM debt_payments WHERE user_id=$1 AND debt_id=$2 AND id=$3")
        .bind(user)
        .bind(id)
        .bind(pid)
        .execute(&mut *tx)
        .await
        .map_err(db)?;
    if r.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    let sum: i32 = sqlx::query_scalar(
        "SELECT COALESCE(sum(principal),0)::int FROM debt_payments WHERE user_id=$1 AND debt_id=$2",
    )
    .bind(user)
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(db)?;
    let orig: i32 = sqlx::query_scalar("SELECT original FROM debts WHERE user_id=$1 AND id=$2")
        .bind(user)
        .bind(id)
        .fetch_one(&mut *tx)
        .await
        .map_err(db)?;
    let opening: i32 =
        sqlx::query_scalar("SELECT opening_paid FROM debts WHERE user_id=$1 AND id=$2")
            .bind(user)
            .bind(id)
            .fetch_one(&mut *tx)
            .await
            .map_err(db)?;
    let paid = (opening + sum).min(orig);
    sqlx::query("UPDATE debts SET paid=$3,done=($3>=original) WHERE user_id=$1 AND id=$2")
        .bind(user)
        .bind(id)
        .bind(paid)
        .execute(&mut *tx)
        .await
        .map_err(db)?;
    tx.commit().await.map_err(db)?;
    one(pool, user, id, key).await
}
async fn detail(pool: &PgPool, user: &str, id: i32, key: &[u8; 32]) -> Result<Value, ApiError> {
    let (d, ps) = load(pool, user, id, key).await?;
    let mut out = schedule_view(&d, &ps, TODAY);
    out["payments"] = Value::Array(ps.iter().rev().map(payment_view).collect());
    Ok(out)
}

fn active_debts(debts: &[Debt]) -> Vec<&Debt> {
    debts.iter().filter(|d| !d.done && remain(d) > 0).collect()
}
fn sim_order(ds: &[&Debt], strategy: &str) -> Vec<i32> {
    let mut v = ds.to_vec();
    match strategy {
        "snowball" => v.sort_by(|a, b| {
            remain(a)
                .cmp(&remain(b))
                .then_with(|| b.apr.total_cmp(&a.apr))
                .then(a.sort.cmp(&b.sort))
        }),
        "custom" => v.sort_by_key(|d| d.sort),
        _ => v.sort_by(|a, b| {
            b.apr
                .total_cmp(&a.apr)
                .then(remain(a).cmp(&remain(b)))
                .then(a.sort.cmp(&b.sort))
        }),
    }
    v.into_iter().map(|d| d.id).collect()
}
fn simulate(ds: &[&Debt], strategy: &str, extra: i32, rollover: bool) -> Value {
    let order = sim_order(ds, strategy);
    let map: HashMap<i32, &Debt> = ds.iter().map(|d| (d.id, *d)).collect();
    let mut bal: HashMap<i32, f64> = ds
        .iter()
        .filter(|d| remain(d) > 0)
        .map(|d| (d.id, remain(d) as f64))
        .collect();
    let budget = ds
        .iter()
        .filter(|d| remain(d) > 0)
        .map(|d| amount_due(d))
        .sum::<i32>()
        + extra;
    let mut payoff = serde_json::Map::new();
    let mut total = 0.0;
    let mut month = 0;
    loop {
        let ids: Vec<i32> = order
            .iter()
            .copied()
            .filter(|id| bal.get(id).copied().unwrap_or(0.0) > 0.0)
            .collect();
        if ids.is_empty() {
            break;
        }
        if month >= MAX_MONTHS {
            return json!({"strategy":strategy,"extra":extra,"months":MAX_MONTHS,"totalInterest":total,"neverPaysOff":true,"order":order,"payoffMonth":payoff});
        }
        month += 1;
        for id in &ids {
            let d = map[id];
            let raw = (if d.calc == "reducing" {
                bal[id]
            } else {
                f64::from(d.original)
            }) * d.apr
                / 1200.0;
            let i = if d.calc == "fixed" {
                (raw + 1e-6).floor()
            } else {
                raw.round()
            };
            total += i;
            *bal.get_mut(id).unwrap() += i;
        }
        let mut pool = if rollover {
            budget as f64
        } else {
            ids.iter().map(|id| amount_due(map[id]) as f64).sum::<f64>() + extra as f64
        };
        for id in &ids {
            let pay = (amount_due(map[id]) as f64).min(bal[id]).min(pool);
            *bal.get_mut(id).unwrap() -= pay;
            pool -= pay;
        }
        if !rollover {
            pool = extra as f64;
        }
        for id in &ids {
            if pool <= 0.0 {
                break;
            }
            let pay = pool.min(bal[id]);
            *bal.get_mut(id).unwrap() -= pay;
            pool -= pay;
        }
        for id in &ids {
            if bal[id] <= 0.0 {
                payoff.insert(id.to_string(), json!(month));
            }
        }
    }
    json!({"strategy":strategy,"extra":extra,"months":month,"totalInterest":total,"neverPaysOff":false,"order":order,"payoffMonth":payoff})
}
fn planning_params(q: &HashMap<String, String>) -> Result<(String, i32, f64), ApiError> {
    let strategy = match q.get("strategy").map(String::as_str) {
        Some("snowball") => "snowball",
        Some("custom") => "custom",
        _ => "avalanche",
    }
    .to_string();
    let extra = match q.get("extra") {
        None => 0,
        Some(s) if s.is_empty() => 0,
        Some(s) => s
            .parse::<i32>()
            .ok()
            .filter(|x| *x >= 0 && *x <= 10_000_000)
            .ok_or_else(|| bad(format!("invalid extra: {s}"), None))?,
    };
    let target = match q.get("target") {
        None => 0.4,
        Some(s) if s.is_empty() => 0.4,
        Some(s) => s
            .parse::<f64>()
            .ok()
            .filter(|x| x.is_finite() && *x > 0.0 && *x <= 1.0)
            .ok_or_else(|| {
                bad(
                    format!("invalid target: {s} (expected 0 < target <= 1)"),
                    None,
                )
            })?,
    };
    Ok((strategy, extra, target))
}
async fn list_raw(pool: &PgPool, user: &str, key: &[u8; 32]) -> Result<Vec<Debt>, ApiError> {
    let rs = sqlx::query(&format!("{SELECT} WHERE user_id=$1 ORDER BY done,sort,id"))
        .bind(user)
        .fetch_all(pool)
        .await
        .map_err(db)?;
    rows_to_debts(rs, key)
}
async fn monthly_income(pool: &PgPool, user: &str) -> Result<i32, ApiError> {
    let raw: Option<String> =
        sqlx::query_scalar("SELECT value FROM settings WHERE user_id=$1 AND key='monthlyIncome'")
            .bind(user)
            .fetch_optional(pool)
            .await
            .map_err(db)?;
    if let Some(v) = raw {
        return Ok(v.parse::<i32>().unwrap_or(0));
    }
    Ok(sqlx::query_scalar(
        "SELECT income FROM monthly_cashflows WHERE user_id=$1 ORDER BY sort DESC LIMIT 1",
    )
    .bind(user)
    .fetch_optional(pool)
    .await
    .map_err(db)?
    .unwrap_or(0))
}
async fn planning(
    pool: &PgPool,
    user: &str,
    key: &[u8; 32],
    q: &HashMap<String, String>,
    dsr: bool,
) -> Result<Value, ApiError> {
    let (strategy, extra, target) = planning_params(q)?;
    let debts = list_raw(pool, user, key).await?;
    let active = active_debts(&debts);
    if !dsr {
        let baseline = simulate(&active, &strategy, 0, false);
        let plan = simulate(&active, &strategy, extra, true);
        let saved = baseline["totalInterest"].as_f64().unwrap_or(0.0)
            - plan["totalInterest"].as_f64().unwrap_or(0.0);
        let months =
            baseline["months"].as_i64().unwrap_or(0) - plan["months"].as_i64().unwrap_or(0);
        return Ok(
            json!({"baseline":baseline,"plan":plan,"interestSaved":saved,"monthsSaved":months}),
        );
    }
    let income = monthly_income(pool, user).await?;
    let monthly = active.iter().map(|d| amount_due(d)).sum::<i32>();
    let ratio = if income > 0 {
        Some(monthly as f64 / income as f64)
    } else {
        None
    };
    let band = ratio.map(|r| {
        if r <= 0.3 {
            "healthy"
        } else if r <= 0.4 {
            "manageable"
        } else if r <= 0.6 {
            "high"
        } else {
            "critical"
        }
    });
    let mut actions = Vec::<Value>::new();
    if active.is_empty() {
        actions.push(json!({"key":"debtFree"}));
        return Ok(
            json!({"dsr":{"income":income,"monthlyDebt":monthly,"ratio":ratio,"band":band},"targetDsr":target,"monthlyCut":0,"incomeNeeded":0,"quickWins":[],"refinance":[],"actions":actions}),
        );
    }
    if ratio.is_none() {
        actions.push(json!({"key":"setIncome"}));
    }
    for d in &active {
        let ps = load_payments(pool, user, d.id, key).await?;
        let status = due(d, &ps, TODAY);
        if status["state"] == "overdue" {
            let amt = (status["amountDue"].as_i64().unwrap_or(0)
                - status["paidThisCycle"].as_i64().unwrap_or(0))
            .max(0)
                + status["lateFee"].as_i64().unwrap_or(0);
            actions.push(json!({"key":"payOverdue","debtId":d.id,"amount":amt}));
        }
    }
    let cut = ratio
        .filter(|r| *r > target)
        .map(|_| ((monthly as f64 - target * income as f64 - 1e-9).ceil() as i32).max(0))
        .unwrap_or(0);
    if cut > 0 {
        actions.push(json!({"key":"cutDsr","amount":cut}));
    }
    let mut wins: Vec<&Debt> = active
        .iter()
        .copied()
        .filter(|d| amount_due(d) > 0)
        .collect();
    wins.sort_by(|a, b| {
        (amount_due(b) as f64 / remain(b) as f64)
            .total_cmp(&(amount_due(a) as f64 / remain(a) as f64))
    });
    wins.truncate(3);
    let mut freed = 0;
    let quick:Vec<Value>=wins.iter().map(|d|{freed+=amount_due(d);json!({"id":d.id,"remaining":remain(d),"installment":amount_due(d),"dsrAfter":if income>0{json!((monthly-freed) as f64/income as f64)}else{Value::Null}})}).collect();
    if let Some(d) = wins.first()
        && ratio.is_none_or(|r| r > 0.3)
    {
        actions.push(json!({"key":"quickWin","debtId":d.id,"amount":remain(d)}));
    }
    let mut by_apr = active.clone();
    by_apr.sort_by(|a, b| b.apr.total_cmp(&a.apr).then(remain(a).cmp(&remain(b))));
    if let Some(d) = by_apr.iter().find(|d| d.apr > 0.0) {
        actions.push(json!({"key":"focusHighestRate","debtId":d.id}));
    }
    let refinance: Vec<i32> = active
        .iter()
        .filter(|d| d.apr >= 25.0 && remain(d) >= 10_000)
        .map(|d| d.id)
        .collect();
    for id in &refinance {
        actions.push(json!({"key":"refinance","debtId":id}));
    }
    if ratio.is_some_and(|r| r > 0.4) {
        actions.push(json!({"key":"noNewDebt"}));
    }
    let need = ((monthly as f64 / target - 1e-9).ceil() as i32).max(0);
    Ok(
        json!({"dsr":{"income":income,"monthlyDebt":monthly,"ratio":ratio,"band":band},"targetDsr":target,"monthlyCut":cut,"incomeNeeded":need,"quickWins":quick,"refinance":refinance,"actions":actions}),
    )
}
async fn list_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        json!({"data":list(&s.pool,&u.id,q.get("status").map(String::as_str),&s.encryption_key).await?}),
    ))
}
async fn create_handler(
    State(s): State<AppState>,
    u: AuthUser,
    b: Bytes,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    Ok((
        StatusCode::CREATED,
        Json(create(&s.pool, &u.id, &s.encryption_key, b).await?),
    ))
}
async fn item_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let id = parse_id(&raw)?;
    Ok(Json(one(&s.pool, &u.id, id, &s.encryption_key).await?))
}
async fn update_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
    b: Bytes,
) -> Result<Json<Value>, ApiError> {
    let id = parse_id(&raw)?;
    Ok(Json(
        update(&s.pool, &u.id, id, &s.encryption_key, b).await?,
    ))
}
async fn delete_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
) -> Result<StatusCode, ApiError> {
    let id = parse_id(&raw)?;
    delete(&s.pool, &u.id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn schedule_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let id = parse_id(&raw)?;
    let (d, ps) = load(&s.pool, &u.id, id, &s.encryption_key).await?;
    Ok(Json(schedule_view(&d, &ps, TODAY)))
}
async fn payments_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let id = parse_id(&raw)?;
    let _ = load(&s.pool, &u.id, id, &s.encryption_key).await?;
    let ps = load_payments(&s.pool, &u.id, id, &s.encryption_key).await?;
    Ok(Json(
        json!({"data":ps.iter().rev().map(payment_view).collect::<Vec<_>>()}),
    ))
}
async fn create_payment_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
    b: Bytes,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let id = parse_id(&raw)?;
    Ok((
        StatusCode::CREATED,
        Json(pay(&s.pool, &u.id, id, &s.encryption_key, b).await?),
    ))
}
async fn remove_payment_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Path((raw, raw_payment)): Path<(String, String)>,
) -> Result<Json<Value>, ApiError> {
    let id = parse_id(&raw)?;
    Ok(Json(
        delete_payment(
            &s.pool,
            &u.id,
            id,
            parse_id(&raw_payment)?,
            &s.encryption_key,
        )
        .await?,
    ))
}
async fn strategy_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        planning(&s.pool, &u.id, &s.encryption_key, &q, false).await?,
    ))
}
async fn dsr_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        planning(&s.pool, &u.id, &s.encryption_key, &q, true).await?,
    ))
}
async fn detail_handler(
    State(s): State<AppState>,
    u: AuthUser,
    Path(raw): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let id = parse_id(&raw)?;
    Ok(Json(detail(&s.pool, &u.id, id, &s.encryption_key).await?))
}
async fn names_handler(State(s): State<AppState>, u: AuthUser) -> Result<Json<Value>, ApiError> {
    let rows = sqlx::query("SELECT name,done FROM debts WHERE user_id=$1 ORDER BY sort,id")
        .bind(&u.id)
        .fetch_all(&s.pool)
        .await
        .map_err(db)?;
    let values = rows
        .into_iter()
        .map(|r| json!({"name": r.get::<String, _>("name"), "done": r.get::<bool, _>("done")}))
        .collect();
    Ok(Json(Value::Array(values)))
}
pub fn public_routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/setup", get(setup_handler))
        .route("/api/v1/debts", get(list_handler).post(create_handler))
        .route("/api/v1/debts/strategy", get(strategy_handler))
        .route("/api/v1/debts/dsr", get(dsr_handler))
        .route(
            "/api/v1/debts/{id}",
            get(item_handler)
                .put(update_handler)
                .patch(update_handler)
                .delete(delete_handler),
        )
        .route("/api/v1/debts/{id}/schedule", get(schedule_handler))
        .route(
            "/api/v1/debts/{id}/payments",
            get(payments_handler).post(create_payment_handler),
        )
        .route(
            "/api/v1/debts/{id}/payments/{payment_id}",
            axum::routing::delete(remove_payment_handler),
        )
}
pub fn internal_routes() -> Router<AppState> {
    Router::new()
        .route("/internal/v1/debts/{id}/detail", get(detail_handler))
        .route("/internal/v1/debts/names", get(names_handler))
}
fn camel_key(s: &str) -> String {
    let mut out = String::new();
    let mut upper = false;
    for c in s.chars() {
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
fn camelize(v: Value) -> Value {
    match v {
        Value::Object(m) => Value::Object(
            m.into_iter()
                .map(|(k, v)| (camel_key(&k), camelize(v)))
                .collect(),
        ),
        Value::Array(a) => Value::Array(a.into_iter().map(camelize).collect()),
        x => x,
    }
}
async fn table_rows(pool: &PgPool, user: &str, table: &str) -> Result<Vec<Value>, ApiError> {
    let sql = format!(
        "SELECT to_jsonb(t)-'user_id' AS row FROM {table} t WHERE user_id=$1 ORDER BY sort,id"
    );
    let rows = sqlx::query(&sql)
        .bind(user)
        .fetch_all(pool)
        .await
        .map_err(db)?;
    Ok(rows
        .into_iter()
        .map(|r| camelize(r.get::<Value, _>("row")))
        .collect())
}
async fn setup_handler(State(s): State<AppState>, u: AuthUser) -> Result<Json<Value>, ApiError> {
    let categories = table_rows(&s.pool, &u.id, "categories").await?;
    let income_sources = table_rows(&s.pool, &u.id, "income_categories").await?;
    let channels = table_rows(&s.pool, &u.id, "channels").await?;
    let accounts = table_rows(&s.pool, &u.id, "accounts").await?;
    let goals=sqlx::query("SELECT to_jsonb(g)-'user_id' || jsonb_build_object('channels',COALESCE((SELECT jsonb_agg(to_jsonb(c)-'user_id' ORDER BY c.id) FROM setup_goal_channels c WHERE c.user_id=g.user_id AND c.setup_goal_id=g.id),'[]'::jsonb)) AS row FROM setup_goals g WHERE g.user_id=$1 ORDER BY g.sort,g.id").bind(&u.id).fetch_all(&s.pool).await.map_err(db)?;
    let goals: Vec<Value> = goals.into_iter().map(|r| camelize(r.get("row"))).collect();
    let debts = list(&s.pool, &u.id, Some("active"), &s.encryption_key).await?;
    let closing: Vec<Value> = debts
        .iter()
        .filter(|d| d["revolving"] != true)
        .cloned()
        .collect();
    let revolving: Vec<Value> = debts
        .into_iter()
        .filter(|d| d["revolving"] == true)
        .collect();
    let goal = |kind: &str| {
        goals
            .iter()
            .find(|g| g["kind"] == kind)
            .cloned()
            .unwrap_or(Value::Null)
    };
    let custom: Vec<Value> = goals
        .iter()
        .filter(|g| g["kind"] == "custom")
        .cloned()
        .collect();
    let inc: Vec<Value> = categories
        .iter()
        .filter(|c| c["type"] == "income")
        .cloned()
        .collect();
    let exp: Vec<Value> = categories
        .into_iter()
        .filter(|c| c["type"] != "income")
        .collect();
    Ok(Json(
        json!({"incomeCategories":inc,"expenseCategories":exp,"incomeSources":income_sources,"channels":channels,"accounts":accounts,"debts":{"closing":closing,"revolving":revolving},"goals":{"emergency":goal("emergency"),"stocks":goal("stocks"),"retirement":goal("retirement"),"custom":custom}}),
    ))
}

fn parse_id(raw: &str) -> Result<i32, ApiError> {
    if raw.is_empty() || raw.len() > 9 || !raw.bytes().all(|b| b.is_ascii_digit()) {
        return Err(bad(format!("invalid id: {raw}"), None));
    }
    raw.parse()
        .map_err(|_| bad(format!("invalid id: {raw}"), None))
}
async fn name_lock(tx: &mut Transaction<'_, Postgres>, user: &str) -> Result<(), ApiError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("debt-name:{user}"))
        .execute(&mut **tx)
        .await
        .map_err(db)?;
    Ok(())
}
async fn name_free(
    tx: &mut Transaction<'_, Postgres>,
    user: &str,
    name: &str,
    except: Option<i32>,
) -> Result<(), ApiError> {
    let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM debts WHERE user_id=$1 AND lower(trim(name))=lower(trim($2)) AND ($3::int IS NULL OR id<>$3))").bind(user).bind(name).bind(except).fetch_one(&mut **tx).await.map_err(db)?;
    if exists {
        Err(ApiError::Conflict(
            "debt name already exists".into(),
            "debtNameTaken".into(),
        ))
    } else {
        Ok(())
    }
}

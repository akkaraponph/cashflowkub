use axum::{
    Json, Router,
    body::Bytes,
    extract::{Path, State},
    http::StatusCode,
    routing::get,
};
use serde_json::{Map, Value, json};
use sqlx::{PgPool, Postgres, QueryBuilder, Row, postgres::PgRow};

use crate::{auth::AuthUser, config::AppState, error::ApiError};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
    Text { trim: bool },
    Integer { min: i64 },
    Enum(&'static [&'static str]),
}

#[derive(Clone, Copy)]
struct Field {
    api: &'static str,
    column: &'static str,
    kind: Kind,
    required: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum NameRef {
    Account,
    Goal,
    Channel,
    Income,
}

#[derive(Clone, Copy)]
struct Resource {
    table: &'static str,
    fields: &'static [Field],
    unique_name: Option<NameRef>,
}

const TEXT: Kind = Kind::Text { trim: false };
const LABEL: Kind = Kind::Text { trim: true };
const INT: Kind = Kind::Integer { min: i64::MIN };
const NONNEG: Kind = Kind::Integer { min: 0 };
const POSITIVE: Kind = Kind::Integer { min: 1 };

const ACCOUNTS: &[Field] = &[
    Field {
        api: "name",
        column: "name",
        kind: LABEL,
        required: true,
    },
    Field {
        api: "sub",
        column: "sub",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "balance",
        column: "balance",
        kind: INT,
        required: false,
    },
    Field {
        api: "icon",
        column: "icon",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "tint",
        column: "tint",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "kind",
        column: "kind",
        kind: Kind::Enum(&["bank", "cash", "ewallet", "credit"]),
        required: false,
    },
    Field {
        api: "startDate",
        column: "start_date",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "startTh",
        column: "start_th",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "sort",
        column: "sort",
        kind: INT,
        required: false,
    },
];
const CATEGORIES: &[Field] = &[
    Field {
        api: "key",
        column: "key",
        kind: LABEL,
        required: true,
    },
    Field {
        api: "label",
        column: "label",
        kind: LABEL,
        required: true,
    },
    Field {
        api: "th",
        column: "th",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "short",
        column: "short",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "icon",
        column: "icon",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "tint",
        column: "tint",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "type",
        column: "type",
        kind: Kind::Enum(&["income", "expense"]),
        required: false,
    },
    Field {
        api: "sub",
        column: "sub",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "sort",
        column: "sort",
        kind: INT,
        required: false,
    },
];
const BUDGETS: &[Field] = &[
    Field {
        api: "cat",
        column: "cat_key",
        kind: LABEL,
        required: true,
    },
    Field {
        api: "spent",
        column: "spent",
        kind: NONNEG,
        required: false,
    },
    Field {
        api: "limit",
        column: "limit_amt",
        kind: NONNEG,
        required: true,
    },
    Field {
        api: "sort",
        column: "sort",
        kind: INT,
        required: false,
    },
];
const GOALS: &[Field] = &[
    Field {
        api: "name",
        column: "name",
        kind: LABEL,
        required: true,
    },
    Field {
        api: "th",
        column: "th",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "icon",
        column: "icon",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "saved",
        column: "saved",
        kind: NONNEG,
        required: false,
    },
    Field {
        api: "target",
        column: "target",
        kind: POSITIVE,
        required: true,
    },
    Field {
        api: "monthly",
        column: "monthly",
        kind: NONNEG,
        required: false,
    },
    Field {
        api: "by",
        column: "by",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "sort",
        column: "sort",
        kind: INT,
        required: false,
    },
];
const ASSETS: &[Field] = &[
    Field {
        api: "name",
        column: "name",
        kind: LABEL,
        required: true,
    },
    Field {
        api: "th",
        column: "th",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "icon",
        column: "icon",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "tint",
        column: "tint",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "value",
        column: "value",
        kind: INT,
        required: false,
    },
    Field {
        api: "sort",
        column: "sort",
        kind: INT,
        required: false,
    },
];
const CHANNELS: &[Field] = &[
    Field {
        api: "name",
        column: "name",
        kind: LABEL,
        required: true,
    },
    Field {
        api: "th",
        column: "th",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "kind",
        column: "kind",
        kind: Kind::Enum(&["saving", "mf", "pf", "stock", "gold", "bond"]),
        required: false,
    },
    Field {
        api: "icon",
        column: "icon",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "tint",
        column: "tint",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "opening",
        column: "opening",
        kind: INT,
        required: false,
    },
    Field {
        api: "startDate",
        column: "start_date",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "startTh",
        column: "start_th",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "sort",
        column: "sort",
        kind: INT,
        required: false,
    },
];
const INCOME_CATEGORIES: &[Field] = &[
    Field {
        api: "name",
        column: "name",
        kind: LABEL,
        required: true,
    },
    Field {
        api: "th",
        column: "th",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "sub",
        column: "sub",
        kind: Kind::Enum(&["main", "side", "passive"]),
        required: false,
    },
    Field {
        api: "icon",
        column: "icon",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "tint",
        column: "tint",
        kind: TEXT,
        required: false,
    },
    Field {
        api: "sort",
        column: "sort",
        kind: INT,
        required: false,
    },
];

fn resource(name: &str) -> Result<Resource, ApiError> {
    let value = match name {
        "accounts" => Resource {
            table: "accounts",
            fields: ACCOUNTS,
            unique_name: Some(NameRef::Account),
        },
        "categories" => Resource {
            table: "categories",
            fields: CATEGORIES,
            unique_name: None,
        },
        "budgets" => Resource {
            table: "budgets",
            fields: BUDGETS,
            unique_name: None,
        },
        "goals" => Resource {
            table: "goals",
            fields: GOALS,
            unique_name: Some(NameRef::Goal),
        },
        "assets" => Resource {
            table: "assets",
            fields: ASSETS,
            unique_name: None,
        },
        "channels" => Resource {
            table: "channels",
            fields: CHANNELS,
            unique_name: Some(NameRef::Channel),
        },
        "income-categories" => Resource {
            table: "income_categories",
            fields: INCOME_CATEGORIES,
            unique_name: Some(NameRef::Income),
        },
        _ => return Err(ApiError::NotFound),
    };
    Ok(value)
}

fn bad_validation(message: impl Into<String>) -> ApiError {
    ApiError::BadRequest(message.into(), Some("validation".to_owned()))
}

fn validate_body(
    resource: Resource,
    body: Value,
    partial: bool,
) -> Result<Map<String, Value>, ApiError> {
    let object = body
        .as_object()
        .ok_or_else(|| bad_validation("request body must be an object"))?;
    let mut result = Map::new();
    for field in resource.fields {
        let Some(value) = object.get(field.api) else {
            if field.required && !partial {
                return Err(bad_validation(format!("{0}: Required", field.api)));
            }
            continue;
        };
        let normalized = match field.kind {
            Kind::Text { trim } => {
                let text = value
                    .as_str()
                    .ok_or_else(|| bad_validation(format!("{0}: Expected string", field.api)))?;
                let text = if trim {
                    text.trim().to_owned()
                } else {
                    text.to_owned()
                };
                if trim && text.is_empty() {
                    return Err(bad_validation(format!(
                        "{0}: Too small: expected string to have >=1 characters",
                        field.api
                    )));
                }
                Value::String(text)
            }
            Kind::Integer { min } => {
                let number = value
                    .as_i64()
                    .ok_or_else(|| bad_validation(format!("{0}: Expected integer", field.api)))?;
                if number < min {
                    return Err(bad_validation(format!(
                        "{0}: Number must be greater than or equal to {min}",
                        field.api
                    )));
                }
                if i32::try_from(number).is_err() {
                    return Err(bad_validation(format!(
                        "{0}: Number out of range",
                        field.api
                    )));
                }
                Value::Number(number.into())
            }
            Kind::Enum(values) => {
                let text = value
                    .as_str()
                    .ok_or_else(|| bad_validation(format!("{0}: Expected string", field.api)))?;
                if !values.contains(&text) {
                    return Err(bad_validation(format!("{0}: Invalid option", field.api)));
                }
                Value::String(text.to_owned())
            }
        };
        result.insert(field.api.to_owned(), normalized);
    }
    Ok(result)
}

fn api_row(resource: Resource, row: Value) -> Value {
    let Some(object) = row.as_object() else {
        return row;
    };
    let mut result = Map::new();
    for (key, value) in object {
        if key == "user_id" {
            continue;
        }
        let api_name = resource
            .fields
            .iter()
            .find(|field| field.column == key)
            .map(|field| field.api)
            .unwrap_or(key);
        result.insert(api_name.to_owned(), value.clone());
    }
    Value::Object(result)
}

fn json_row(row: PgRow, resource: Resource) -> Result<Value, ApiError> {
    let value: Value = row.try_get("row").map_err(|_| ApiError::Internal)?;
    Ok(api_row(resource, value))
}

fn db_error(error: sqlx::Error) -> ApiError {
    if let sqlx::Error::Database(database) = &error
        && database.code().as_deref() == Some("23505")
    {
        return ApiError::Conflict(
            "resource already exists".to_owned(),
            "resourceExists".to_owned(),
        );
    }
    ApiError::Internal
}

fn bound_value(value: &Value, query: &mut QueryBuilder<'_, Postgres>) -> Result<(), ApiError> {
    match value {
        Value::String(text) => {
            query.push_bind(text.clone());
        }
        Value::Number(number) => {
            let value = number
                .as_i64()
                .ok_or_else(|| bad_validation("Expected integer"))?;
            query.push_bind(value as i32);
        }
        _ => return Err(bad_validation("Unsupported field value")),
    }
    Ok(())
}

fn name_ref(resource: Resource) -> Option<(NameRef, &'static str)> {
    resource.unique_name.map(|kind| {
        let column = match kind {
            NameRef::Account | NameRef::Goal | NameRef::Channel | NameRef::Income => "name",
        };
        (kind, column)
    })
}

async fn ensure_name_free(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    user_id: &str,
    resource: Resource,
    name: &str,
    except_id: Option<i32>,
) -> Result<(), ApiError> {
    let Some((kind, column)) = name_ref(resource) else {
        return Ok(());
    };
    let mut query = QueryBuilder::<Postgres>::new("SELECT EXISTS (SELECT 1 FROM ");
    query
        .push(resource.table)
        .push(" WHERE user_id = ")
        .push_bind(user_id.to_owned());
    query
        .push(" AND lower(trim(")
        .push(column)
        .push(")) = lower(trim(")
        .push_bind(name.to_owned())
        .push(") )");
    if let Some(id) = except_id {
        query.push(" AND id <> ").push_bind(id);
    }
    query.push(")");
    let exists: bool = query
        .build_query_scalar()
        .fetch_one(&mut **tx)
        .await
        .map_err(db_error)?;
    if exists {
        let (message, code) = match kind {
            NameRef::Account => ("account name already exists", "accountNameTaken"),
            NameRef::Goal => ("goal name already exists", "goalNameTaken"),
            NameRef::Channel => ("channel name already exists", "channelNameTaken"),
            NameRef::Income => ("income item name already exists", "incomeNameTaken"),
        };
        return Err(ApiError::Conflict(message.to_owned(), code.to_owned()));
    }
    Ok(())
}

async fn rename_transaction_refs(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    user_id: &str,
    kind: NameRef,
    from: &str,
    to: &str,
) -> Result<(), ApiError> {
    let mut query = QueryBuilder::<Postgres>::new("UPDATE transactions SET ");
    match kind {
        NameRef::Account => {
            query
                .push("account = ")
                .push_bind(to.to_owned())
                .push(" WHERE user_id = ")
                .push_bind(user_id.to_owned());
            query.push(" AND account = ").push_bind(from.to_owned());
            query.build().execute(&mut **tx).await.map_err(db_error)?;
            let mut transfer = QueryBuilder::<Postgres>::new("UPDATE transactions SET item = ");
            transfer
                .push_bind(to.to_owned())
                .push(" WHERE user_id = ")
                .push_bind(user_id.to_owned());
            transfer
                .push(" AND activity = 'transfer' AND item = ")
                .push_bind(from.to_owned());
            transfer
                .build()
                .execute(&mut **tx)
                .await
                .map_err(db_error)?;
        }
        NameRef::Goal => {
            query
                .push("goal = ")
                .push_bind(to.to_owned())
                .push(" WHERE user_id = ")
                .push_bind(user_id.to_owned());
            query.push(" AND goal = ").push_bind(from.to_owned());
            query.build().execute(&mut **tx).await.map_err(db_error)?;
        }
        NameRef::Channel => {
            query
                .push("item = ")
                .push_bind(to.to_owned())
                .push(" WHERE user_id = ")
                .push_bind(user_id.to_owned());
            query
                .push(" AND activity IN ('save', 'withdraw') AND item = ")
                .push_bind(from.to_owned());
            query.build().execute(&mut **tx).await.map_err(db_error)?;
        }
        NameRef::Income => {
            query
                .push("item = ")
                .push_bind(to.to_owned())
                .push(" WHERE user_id = ")
                .push_bind(user_id.to_owned());
            query
                .push(" AND activity = 'receive' AND item = ")
                .push_bind(from.to_owned());
            query.build().execute(&mut **tx).await.map_err(db_error)?;
        }
    }
    Ok(())
}

async fn ensure_unused(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    user_id: &str,
    kind: NameRef,
    name: &str,
) -> Result<(), ApiError> {
    let condition = match kind {
        NameRef::Account => "(account = $2 OR (activity = 'transfer' AND item = $2))",
        NameRef::Goal => "goal = $2",
        NameRef::Channel => "(activity IN ('save', 'withdraw') AND item = $2)",
        NameRef::Income => "(activity = 'receive' AND item = $2)",
    };
    let sql =
        format!("SELECT EXISTS (SELECT 1 FROM transactions WHERE user_id = $1 AND {condition})");
    let used: bool = sqlx::query_scalar(&sql)
        .bind(user_id)
        .bind(name)
        .fetch_one(&mut **tx)
        .await
        .map_err(db_error)?;
    if used {
        let (message, code) = match kind {
            NameRef::Account => ("account is used by transactions", "accountInUse"),
            NameRef::Goal => ("goal is used by transactions", "goalInUse"),
            NameRef::Channel => ("channel is used by transactions", "channelInUse"),
            NameRef::Income => ("income item is used by transactions", "incomeInUse"),
        };
        return Err(ApiError::Conflict(message.to_owned(), code.to_owned()));
    }
    Ok(())
}

pub async fn list_resource(
    pool: &PgPool,
    user_id: &str,
    name: &str,
) -> Result<Vec<Value>, ApiError> {
    let resource = resource(name)?;
    let mut query = QueryBuilder::<Postgres>::new("SELECT to_jsonb(t) - 'user_id' AS row FROM ");
    query
        .push(resource.table)
        .push(" t WHERE t.user_id = ")
        .push_bind(user_id.to_owned())
        .push(" ORDER BY t.sort ASC");
    query
        .build()
        .fetch_all(pool)
        .await
        .map_err(db_error)?
        .into_iter()
        .map(|row| json_row(row, resource))
        .collect()
}

pub async fn get_resource(
    pool: &PgPool,
    user_id: &str,
    name: &str,
    id: i32,
) -> Result<Value, ApiError> {
    let resource = resource(name)?;
    let mut query = QueryBuilder::<Postgres>::new("SELECT to_jsonb(t) - 'user_id' AS row FROM ");
    query
        .push(resource.table)
        .push(" t WHERE t.user_id = ")
        .push_bind(user_id.to_owned())
        .push(" AND t.id = ")
        .push_bind(id);
    let row = query
        .build()
        .fetch_optional(pool)
        .await
        .map_err(db_error)?
        .ok_or(ApiError::NotFound)?;
    json_row(row, resource)
}

pub async fn create_resource(
    pool: &PgPool,
    user_id: &str,
    name: &str,
    body: Value,
) -> Result<Value, ApiError> {
    let resource = resource(name)?;
    let data = validate_body(resource, body, false)?;
    let mut tx = pool.begin().await.map_err(db_error)?;
    if let (Some((_, _)), Some(name)) =
        (name_ref(resource), data.get("name").and_then(Value::as_str))
    {
        ensure_name_free(&mut tx, user_id, resource, name, None).await?;
    }
    let mut query = QueryBuilder::<Postgres>::new("INSERT INTO ");
    query.push(resource.table).push(" (user_id");
    for field in resource
        .fields
        .iter()
        .filter(|field| data.contains_key(field.api))
    {
        query.push(", ").push(field.column);
    }
    query.push(") VALUES (").push_bind(user_id.to_owned());
    for field in resource
        .fields
        .iter()
        .filter(|field| data.contains_key(field.api))
    {
        query.push(", ");
        bound_value(&data[field.api], &mut query)?;
    }
    query
        .push(") RETURNING to_jsonb(")
        .push(resource.table)
        .push(") - 'user_id' AS row");
    let row = query.build().fetch_one(&mut *tx).await.map_err(db_error)?;
    let result = json_row(row, resource)?;
    tx.commit().await.map_err(db_error)?;
    Ok(result)
}

pub async fn update_resource(
    pool: &PgPool,
    user_id: &str,
    name: &str,
    id: i32,
    body: Value,
) -> Result<Value, ApiError> {
    let resource = resource(name)?;
    let data = validate_body(resource, body, true)?;
    let mut tx = pool.begin().await.map_err(db_error)?;
    let mut select = QueryBuilder::<Postgres>::new("SELECT to_jsonb(t) - 'user_id' AS row FROM ");
    select
        .push(resource.table)
        .push(" t WHERE t.user_id = ")
        .push_bind(user_id.to_owned())
        .push(" AND t.id = ")
        .push_bind(id)
        .push(" FOR UPDATE");
    let existing = select
        .build()
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_error)?
        .ok_or(ApiError::NotFound)?;
    let current = json_row(existing, resource)?;
    if let (Some((kind, _)), Some(updated)) =
        (name_ref(resource), data.get("name").and_then(Value::as_str))
        && current["name"].as_str() != Some(updated)
    {
        ensure_name_free(&mut tx, user_id, resource, updated, Some(id)).await?;
        rename_transaction_refs(
            &mut tx,
            user_id,
            kind,
            current["name"].as_str().unwrap_or_default(),
            updated,
        )
        .await?;
    }
    if data.is_empty() {
        tx.commit().await.map_err(db_error)?;
        return Ok(current);
    }
    let mut query = QueryBuilder::<Postgres>::new("UPDATE ");
    query.push(resource.table).push(" SET ");
    let mut first = true;
    for field in resource
        .fields
        .iter()
        .filter(|field| data.contains_key(field.api))
    {
        if !first {
            query.push(", ");
        }
        first = false;
        query.push(field.column).push(" = ");
        bound_value(&data[field.api], &mut query)?;
    }
    query
        .push(" WHERE user_id = ")
        .push_bind(user_id.to_owned())
        .push(" AND id = ")
        .push_bind(id);
    query
        .push(" RETURNING to_jsonb(")
        .push(resource.table)
        .push(") - 'user_id' AS row");
    let row = query.build().fetch_one(&mut *tx).await.map_err(db_error)?;
    let result = json_row(row, resource)?;
    tx.commit().await.map_err(db_error)?;
    Ok(result)
}

pub async fn delete_resource(
    pool: &PgPool,
    user_id: &str,
    name: &str,
    id: i32,
) -> Result<(), ApiError> {
    let resource = resource(name)?;
    let mut tx = pool.begin().await.map_err(db_error)?;
    if let Some((kind, _)) = name_ref(resource) {
        let mut select = QueryBuilder::<Postgres>::new("SELECT name FROM ");
        select
            .push(resource.table)
            .push(" WHERE user_id = ")
            .push_bind(user_id.to_owned())
            .push(" AND id = ")
            .push_bind(id)
            .push(" FOR UPDATE");
        let current: Option<String> = select
            .build_query_scalar()
            .fetch_optional(&mut *tx)
            .await
            .map_err(db_error)?;
        let current = current.ok_or(ApiError::NotFound)?;
        ensure_unused(&mut tx, user_id, kind, &current).await?;
    }
    let mut delete = QueryBuilder::<Postgres>::new("DELETE FROM ");
    delete
        .push(resource.table)
        .push(" WHERE user_id = ")
        .push_bind(user_id.to_owned())
        .push(" AND id = ")
        .push_bind(id)
        .push(" RETURNING id");
    let deleted: Option<i32> = delete
        .build_query_scalar()
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_error)?;
    if deleted.is_none() {
        return Err(ApiError::NotFound);
    }
    tx.commit().await.map_err(db_error)?;
    Ok(())
}

pub async fn get_settings(pool: &PgPool, user_id: &str) -> Result<Value, ApiError> {
    let stored: Option<String> = sqlx::query_scalar(
        "SELECT value FROM settings WHERE user_id = $1 AND key = 'monthlyIncome'",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(db_error)?;
    let income = if let Some(value) = stored {
        value.parse::<i64>().unwrap_or(0)
    } else {
        sqlx::query_scalar::<_, i32>(
            "SELECT income FROM monthly_cashflows WHERE user_id = $1 ORDER BY sort DESC LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(db_error)?
        .unwrap_or(0) as i64
    };
    Ok(json!({"monthlyIncome": income}))
}

pub async fn update_settings(pool: &PgPool, user_id: &str, body: Value) -> Result<Value, ApiError> {
    let object = body
        .as_object()
        .ok_or_else(|| bad_validation("request body must be an object"))?;
    let income = object
        .get("monthlyIncome")
        .and_then(Value::as_i64)
        .filter(|value| *value >= 0 && i32::try_from(*value).is_ok())
        .ok_or_else(|| bad_validation("monthlyIncome: Expected non-negative integer"))?;
    sqlx::query("INSERT INTO settings (user_id, key, value) VALUES ($1, 'monthlyIncome', $2) ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value")
        .bind(user_id).bind(income.to_string()).execute(pool).await.map_err(db_error)?;
    Ok(json!({"monthlyIncome": income}))
}

fn parse_id(raw: &str) -> Result<i32, ApiError> {
    if raw.is_empty() || raw.len() > 9 || !raw.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(ApiError::BadRequest(format!("invalid id: {raw}"), None));
    }
    raw.parse()
        .map_err(|_| ApiError::BadRequest(format!("invalid id: {raw}"), None))
}

fn parse_json(body: Bytes) -> Result<Value, ApiError> {
    if body.is_empty() {
        return Err(ApiError::BadRequest(
            "request body is required".to_owned(),
            None,
        ));
    }
    serde_json::from_slice(&body)
        .map_err(|_| ApiError::BadRequest("request body is not valid JSON".to_owned(), None))
}

async fn list_handler(
    State(state): State<AppState>,
    user: AuthUser,
    Path(name): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let rows = list_resource(&state.pool, &user.id, &name).await?;
    Ok(Json(json!({"data": rows})))
}

async fn create_handler(
    State(state): State<AppState>,
    user: AuthUser,
    Path(name): Path<String>,
    body: Bytes,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let row = create_resource(&state.pool, &user.id, &name, parse_json(body)?).await?;
    Ok((StatusCode::CREATED, Json(row)))
}

async fn get_handler(
    State(state): State<AppState>,
    user: AuthUser,
    Path((name, id)): Path<(String, String)>,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        get_resource(&state.pool, &user.id, &name, parse_id(&id)?).await?,
    ))
}

async fn update_handler(
    State(state): State<AppState>,
    user: AuthUser,
    Path((name, id)): Path<(String, String)>,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        update_resource(
            &state.pool,
            &user.id,
            &name,
            parse_id(&id)?,
            parse_json(body)?,
        )
        .await?,
    ))
}

async fn delete_handler(
    State(state): State<AppState>,
    user: AuthUser,
    Path((name, id)): Path<(String, String)>,
) -> Result<StatusCode, ApiError> {
    delete_resource(&state.pool, &user.id, &name, parse_id(&id)?).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn get_settings_handler(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(get_settings(&state.pool, &user.id).await?))
}

async fn update_settings_handler(
    State(state): State<AppState>,
    user: AuthUser,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        update_settings(&state.pool, &user.id, parse_json(body)?).await?,
    ))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/{resource}", get(list_handler).post(create_handler))
        .route(
            "/{resource}/{id}",
            get(get_handler)
                .put(update_handler)
                .patch(update_handler)
                .delete(delete_handler),
        )
        .route(
            "/settings",
            get(get_settings_handler).put(update_settings_handler),
        )
}

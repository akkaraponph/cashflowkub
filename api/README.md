# CashflowKub API

REST backend for the CashflowKub personal-finance app, built with **Go + Fiber v3 + GORM + PostgreSQL**.

## Run

```bash
cd api
cp .env.example .env          # adjust DATABASE_URL if needed
go mod tidy
go run .                      # migrates, seeds, and serves on :8080
```

Need a database? `docker compose up -d postgres` brings up Postgres matching the `.env` defaults.

On boot the server **auto-migrates** the schema and (when `SEED_ON_BOOT=true`) **re-seeds** the canonical demo data from the design comp. Set `SEED_ON_BOOT=false` to keep your own edits.

## Configuration (`.env`)

| Var            | Default                                              | Notes                          |
| -------------- | ---------------------------------------------------- | ------------------------------ |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/cfk_db` | `postgres://` also accepted    |
| `PORT`         | `8080`                                               |                                |
| `APP_ENV`      | `development`                                         | `development` enables SQL logs |
| `CORS_ORIGINS` | `*`                                                  | comma-separated list           |
| `SEED_ON_BOOT` | `true`                                               | re-seed demo data on startup   |

## Endpoints

Base path: `/api/v1`

### CRUD resources
`GET/POST /<resource>`, `GET/PUT/PATCH/DELETE /<resource>/:id`

- `accounts`, `categories`, `budgets`, `goals`, `assets`, `channels`, `income-categories`
- `transactions` — `GET` supports `?type=income|expense&category=&account=&from=&to=&limit=`; rows include derived `date` + `group` (Today/Yesterday)
- `debts` — `GET ?status=active|paid`; rows include `remaining` + `progress`
- `bills` — `GET ?status=paid|unpaid`; rows include `status` + `daysDiff`

### Actions & aggregates
| Method | Path                       | Purpose                                              |
| ------ | -------------------------- | --------------------------------------------------- |
| GET    | `/dashboard`               | net worth, month cashflow, spending donut, debt focus, next bill, goals |
| GET    | `/networth`                | assets + active liabilities breakdown + trend       |
| GET    | `/reports`                 | category breakdown, top merchants, monthly series   |
| GET    | `/setup`                   | categories, channels, accounts, debts, goals config |
| GET    | `/plan?month=YYYY-MM`      | income/expense/savings plan groups + summary        |
| GET    | `/plan/snapshots`          | asset mark-to-market valuations + net-worth history |
| GET    | `/debts/:id/schedule`      | month-by-month amortization schedule                |
| POST   | `/debts/:id/pay`           | apply a payment (`{"amount":1523}`)                 |
| GET    | `/bills/summary`           | totals, next due bill, daily-spend calendar map     |
| PATCH  | `/bills/:id/pay`           | toggle/set paid (`{"paid":true}`)                   |
| GET    | `/health`                  | liveness                                            |

## Layout

```
api/
├── main.go                  # wiring: config → db → migrate → seed → serve
└── internal/
    ├── config/              # env loading
    ├── database/            # GORM connect + AutoMigrate
    ├── models/              # all domain entities
    ├── seed/                # canonical demo data from the design
    ├── handlers/            # HTTP handlers (generic CRUD + aggregates)
    └── routes/              # route registration
```

# CashflowKub (web)

Bilingual (EN / ไทย) personal-finance manager: Next.js 16 + shadcn/ui front end, Next.js Route Handlers as the REST API, Prisma 7 + PostgreSQL.

## Run

```bash
cp .env.example .env              # set the Postgres password
createdb cashflowkub && createdb cashflowkub_test
pnpm install                      # also runs prisma generate
pnpm db:deploy && pnpm db:seed    # schema + demo data
pnpm dev                          # http://localhost:3000
```

## Test

```bash
pnpm test        # unit + api (api tests use TEST_DATABASE_URL)
pnpm test:e2e    # page smoke tests against a running `pnpm start`
```

`test:e2e` targets the server at `E2E_BASE_URL` (e.g. `E2E_BASE_URL=http://localhost:3111 pnpm test:e2e`).

## API

Base path `/api/v1`. Lists return `{ "data": [...] }`; errors return `{ "error": "..." }`.

- CRUD: `accounts`, `categories`, `budgets`, `goals`, `assets`, `channels`, `income-categories` (`GET/POST /<r>`, `GET/PUT/PATCH/DELETE /<r>/:id`)
- `transactions` (`?type=income|expense&category=&account=&from=&to=&limit=&offset=`), `debts` (`?status=active|paid`), `bills` (`?status=paid|unpaid`)
- `DELETE /transactions/batch` (`{ "ids": number[] }`, 1-500 positive ints): deletes them in one statement and responds `{ "deleted": n }`; unknown ids are skipped.
- `GET /dashboard`, `/networth`, `/reports`, `/setup`, `/plan?month=YYYY-MM`, `/plan/snapshots`, `/bills/summary`, `/debts/:id/schedule`
- `PATCH /bills/:id/pay` (`{ "paid"?: boolean }`)
- `GET/POST /debts/:id/payments`: POST body `{ "amount": number (positive int), "date"?: "YYYY-MM-DD", "note"?: string }`; responds `201 { payment, debt, excess }`. The payment is split fee → interest → principal; only the applied amount is stored, and `excess` is the part of `amount` beyond what was owed (0 otherwise). A closed debt gives 409.
- `DELETE /debts/:id/payments/:paymentId`: removes the payment, recomputes `paid`/`done` (reopens a closed debt) and returns the updated debt.
- `GET/PUT /tax?year=YYYY`: one saved Thai personal-income-tax plan per year (`TaxInput` body, integer baht). Responds `{ year, rulesYear, assumed, saved, input, result }`; `result.balance > 0` means you owe, `< 0` a refund. Only 2025 rules are pinned: other years set `assumed: true`.
- `GET/PUT /settings`: `{ "monthlyIncome": non-negative int }`.
- `GET /debts/strategy?strategy=avalanche|snowball|custom&extra=`: `{ baseline, plan, interestSaved, monthsSaved }`; `baseline`/`plan` carry `{ strategy, extra, months, totalInterest, neverPaysOff, order, payoffMonth }`. Check `neverPaysOff` before presenting savings. `extra` is a non-negative int.
- `GET /debts/dsr?target=`: `{ dsr: { income, monthlyDebt, ratio, band }, targetDsr, monthlyCut, incomeNeeded, quickWins, refinance, actions }`; `target` is 0 < target <= 1.
- `GET /api/health`

### Upgrading an existing database

After `pnpm db:deploy`, existing debts get due day 1 and an empty payment ledger, so they may show as overdue until each debt's due day (and terms) is edited. `paid` and `done` are preserved via `opening_paid`.

## Layout

- `src/server/<domain>/logic.ts`: pure, unit-tested business logic.
- `src/server/<domain>/service.ts`: Prisma access.
- `src/app/api/v1/**`: REST handlers.
- `src/app/(app)/**`: Server Component pages that call services directly.
- `src/components/cfk`: app motifs and charts.
- `src/components/ui`: shadcn.

## Security

There is **no authentication or authorization**: every `/api/v1` write endpoint is open. This is a
single-user, localhost app. Do not expose it to a network or host it publicly without adding auth first.
The seed (`pnpm db:seed`) truncates whatever `DATABASE_URL` points at; only run it against a local demo DB.

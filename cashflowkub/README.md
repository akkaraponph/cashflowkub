# CashflowKub (web)

Bilingual (EN / ไทย) personal-finance manager: Next.js 16 + shadcn/ui front end, Next.js Route Handlers as the REST API, Prisma 7 + PostgreSQL.

## Run

```bash
cp .env.example .env              # set the Postgres password and the secrets below
createdb cashflowkub && createdb cashflowkub_test
pnpm install                      # also runs prisma generate
pnpm db:deploy && pnpm db:seed    # schema + demo user and data
pnpm dev                          # http://localhost:3000
```

Required environment variables (no defaults; see `.env.example`):

| Name | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public origin, e.g. `http://localhost:3000` |
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` (base64 of 32 bytes); back it up, losing it makes encrypted notes unreadable |
| `SEED_DEMO_PASSWORD` | Password of the seeded demo user `demo@cashflowkub.local` |
| `PRIVACY_CONTROLLER_NAME`, `PRIVACY_CONTACT_EMAIL` | Shown on `/privacy`; the page throws if unset |

Sign in as `demo@cashflowkub.local` with `SEED_DEMO_PASSWORD`, or create your own account at `/signup`.

### Existing data from before login existed

`pnpm db:deploy` assigns every existing row to a placeholder user. Sign up with your real email, then run
`pnpm db:claim --email <your email>` once: it moves those rows to your account, encrypts the free-text columns and prints the rows moved per table.

## Test

```bash
pnpm test        # unit + api (api tests use TEST_DATABASE_URL)
pnpm test:e2e    # page smoke tests against a running `pnpm start`
pnpm test:pw     # Playwright browser tests of every feature
```

`test:e2e` targets the server at `E2E_BASE_URL` (e.g. `E2E_BASE_URL=http://localhost:3111 pnpm test:e2e`).

`test:pw` needs the browser once: `pnpm exec playwright install chromium`. It builds the app into `.next-e2e`, starts it on port 3210
against `TEST_DATABASE_URL` and reseeds that database before every test, so it never touches your dev database or a running `pnpm dev`.
Specs are in `tests/playwright/`, one file per feature area. Run one with `pnpm test:pw transactions`; reports and traces go to the
system temp folder (`cashflowkub-playwright/`), and `pnpm exec playwright show-report` opens the last report.

## API

Base path `/api/v1`. Every endpoint except `/api/health` needs the session cookie from sign-in; without it the response is `401 { "error": "not signed in", "code": "unauthorized" }`. Each user only ever sees their own rows (another user's id is a 404). Lists return `{ "data": [...] }`; errors return `{ "error": "..." }`.

- Auth (Better Auth, camelCase fields): `POST /api/auth/sign-up/email` (`name`, `email`, `password` of 10+ chars, `privacyVersion`), `/api/auth/sign-in/email`, `/api/auth/sign-out`, `/api/auth/delete-user` (`password`; permanent).
- `GET /me/export`: all of your data as a JSON download. `POST /me/privacy` (`{ "privacy_version" }`): acknowledge the current privacy notice.
- OpenAPI and Postman files for these: `../docs/postman-collections/`.

- CRUD: `accounts`, `categories`, `budgets`, `goals`, `assets`, `channels`, `income-categories` (`GET/POST /<r>`, `GET/PUT/PATCH/DELETE /<r>/:id`)
- `transactions` (`?type=income|expense&category=&account=&from=&to=&limit=&offset=`), `debts` (`?status=active|paid`), `bills` (`?status=paid|unpaid`)
- Transaction `amount`, `interest` and `fee` are numbers with up to 2 decimal places (e.g. `-45.5`).
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

## Security and privacy

Email + password login (Better Auth), per-user data, AES-256-GCM encryption of free-text notes, JSON export and permanent account deletion. How it works, the PDPA record of
processing, the breach runbook and the deployment requirements (TLS, disk encryption, `sslmode=require`, encrypted backups) are in
[`../docs/knowledge/auth-and-privacy.md`](../docs/knowledge/auth-and-privacy.md).

- `/privacy` is a **draft** that needs a legal review before real users sign up.
- Password reset and email verification are not built (no email provider yet), so a forgotten password means a lost account. Do not open public sign-up before that.
- The seed (`pnpm db:seed`) truncates whatever `DATABASE_URL` points at, users included; only run it against a local demo DB.

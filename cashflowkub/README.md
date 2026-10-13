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
- `transactions` (`?type=income|expense&category=&account=&from=&to=&limit=`), `debts` (`?status=active|paid`), `bills` (`?status=paid|unpaid`)
- `GET /dashboard`, `/networth`, `/reports`, `/setup`, `/plan?month=YYYY-MM`, `/plan/snapshots`, `/bills/summary`, `/debts/:id/schedule`
- `POST /debts/:id/pay` (`{ "amount"?: number }`), `PATCH /bills/:id/pay` (`{ "paid"?: boolean }`)
- `GET /api/health`

## Layout

- `src/server/<domain>/logic.ts`: pure, unit-tested business logic.
- `src/server/<domain>/service.ts`: Prisma access.
- `src/app/api/v1/**`: REST handlers.
- `src/app/(app)/**`: Server Component pages that call services directly.
- `src/components/cfk`: app motifs and charts.
- `src/components/ui`: shadcn.

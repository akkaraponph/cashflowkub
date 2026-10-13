# CashflowKub Next.js Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild CashflowKub as a single full-stack Next.js app in `cashflowkub/` (shadcn/ui front end, Next.js Route Handlers as the REST backend, Prisma + PostgreSQL), feature-equal to today's Go API (`api/`) + Expo app (`mobile/`), then delete `api/` and `mobile/`.

**Architecture:** One Next.js 16 App Router project. Business logic is ported from Go into `src/server/<domain>/logic.ts` (pure, unit-tested) and `src/server/<domain>/service.ts` (Prisma reads/writes). Route Handlers under `src/app/api/v1/**` expose the same REST contract as the Go API; Server Component pages call the services directly (no HTTP hop) and small Client Components call the REST API for mutations, then `router.refresh()`.

**Tech Stack:** Next.js 16.4 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) · Prisma 7.10 with `@prisma/adapter-pg` · PostgreSQL 18 · zod 4 · next-themes · lucide-react · Vitest · pnpm.

**Spec:** There is no separate design doc. The spec is the existing code, which stays in the repo until Task 14: the Go API in `api/` (contract: `api/README.md`, logic: `api/internal/**`, data: `api/internal/seed/seed.go`) and the Expo app in `mobile/` (screens: `mobile/src/app/**`, strings: `mobile/src/lib/i18n.ts`, theme: `mobile/src/global.css`). Also the user's request: *"full stack nextjs shadcn ui + next api + prisma, postgresql, in /cashflowkub/cashflowkub, by ref api and existing code, after finish remove api and mobile"*. A follow-up plan, `docs/superpowers/plans/2026-10-13-debt-management.md`, builds on this one.

## Global Constraints

- App lives in `/Users/akkaraponph/Workspaces/codespaces/cashflowkub/cashflowkub` (currently an empty dir). All commands below run from there unless stated.
- Package manager: **pnpm**. Node is v26.
- Versions: `next@16.4.0`, `prisma@7.10.0` + `@prisma/client@7.10.0` + `@prisma/adapter-pg@7.10.0` (pin these exactly — `prisma@latest` currently resolves to an 8.0 RC), `zod@^4`, `vitest@^5`.
- REST base path `/api/v1`; list endpoints return `{ "data": [...] }`; errors return `{ "error": "<message>" }` with 400 / 404 / 409 / 500.
- Money is whole Thai baht as `Int`. Bilingual strings are an English field plus a `th` field.
- "Today" is the fixed reference date **2026-06-18** and the current month is **`2026-06`** (`src/lib/clock.ts`). Never use the wall clock in logic.
- Dev database is a **new** database `cashflowkub`; tests use `cashflowkub_test`. **Do not point Prisma at `cfk_db`**: the Go API's GORM tables live there and `prisma migrate dev` would want to reset it.
- Never run `prisma migrate reset` (Prisma refuses it from AI agents, and it's destructive). Tests use `prisma migrate deploy`, then a TRUNCATE-based reseed. Migrations are generated with `prisma migrate diff … --script` and applied with `prisma migrate deploy`, because `migrate dev` needs an interactive terminal.
- UI copy comes from the ported i18n dictionary (EN + TH). Default language `en`, default theme `light`. Language and year live in cookies `cfk-lang` / `cfk-year`.
- Controls that were no-ops in the mobile app are **not** ported: "Add budget", "Add account", "New goal", "Add funds", "Extra payment", Reports period chips, Settings security/banks/help/sign-out rows, and the profile edit button. Don't add dead buttons.
- Keep the design tokens from `mobile/src/global.css` (Emerald Bank palette + six "file-type" tints).

## Review Focus

1. **Bad ids.** A non-numeric id (`/api/v1/debts/abc`) returns 400 and an unknown id (`/api/v1/debts/9999`) returns 404, never 500. Tests in Task 6 and Task 7.
2. **Bad bodies.** An empty or non-JSON body on POST/PUT returns 400 with a message. The optional-body actions (`PATCH /bills/:id/pay`, `POST /debts/:id/pay`) accept an empty body. Tests in Task 6 and Task 7.
3. **Language cookie.** `cfk-lang=th` renders Thai strings, and a garbage cookie value falls back to English without crashing. Unit test in Task 9; e2e check in Task 10.
4. **Debt overpayment.** Paying more than the remaining balance caps `paid` at `original`, sets `done=true` and sets `monthsLeft=0`. Unit test in Task 4; API test in Task 7.
5. **Mutations show up in aggregates.** Paying the overdue KTC bill moves the dashboard's `nextBill` to the next unpaid bill (MEA Water). Pages render dynamically, so there is no stale cache. Test in Task 8.

---

## File Structure

```
cashflowkub/
├── package.json, tsconfig.json, next.config.ts, components.json, eslint.config.mjs
├── prisma.config.ts                  # Prisma 7 config (datasource url, migrations, seed)
├── vitest.config.ts                  # projects: unit | api | e2e
├── .env.example                      # DATABASE_URL, TEST_DATABASE_URL, BASE_URL
├── prisma/
│   ├── schema.prisma                 # 17 models (port of api/internal/shared/model)
│   ├── migrations/                   # generated
│   ├── seed-data.ts                  # demo dataset (port of api/internal/seed)
│   ├── seed-lib.ts                   # seedDatabase(db): truncate + insert
│   └── seed.ts                       # CLI entry for `prisma db seed`
├── src/
│   ├── generated/prisma/             # prisma generate output (gitignored)
│   ├── lib/
│   │   ├── db.ts                     # PrismaClient singleton
│   │   ├── clock.ts                  # reference today
│   │   ├── format.ts                 # fmt / signed / compact / pct / clamp01
│   │   ├── i18n.ts                   # EN/TH dictionary + localized()
│   │   ├── prefs.ts                  # cookie names, resolveLang/resolveYear/stepYear (pure)
│   │   ├── prefs-server.ts           # getPrefs()/getI18n() from cookies()
│   │   ├── pref-cookie.ts            # client cookie writer
│   │   ├── api-client.ts             # client fetch wrapper for mutations
│   │   └── utils.ts                  # cn() (created by shadcn)
│   ├── server/
│   │   ├── errors.ts                 # HttpError, notFound, badRequest
│   │   ├── validate.ts               # parseBody(zodSchema, data)
│   │   ├── http.ts                   # route() wrapper, readJson, parseId, ok/created/list/noContent
│   │   ├── views.ts                  # DebtView, BillView (shared derived shapes)
│   │   ├── reference/{resources.ts,service.ts}   # 7 generic CRUD resources
│   │   ├── transaction/{logic.ts,service.ts}
│   │   ├── debt/{logic.ts,service.ts}
│   │   ├── bill/{logic.ts,service.ts}
│   │   ├── plan/{logic.ts,service.ts}
│   │   ├── analytics/{logic.ts,service.ts}
│   │   └── setup/{logic.ts,service.ts}
│   ├── app/
│   │   ├── layout.tsx, globals.css
│   │   ├── api/health/route.ts
│   │   ├── api/v1/**/route.ts        # REST contract
│   │   └── (app)/layout.tsx + one folder per screen
│   └── components/
│       ├── ui/                       # shadcn (generated)
│       ├── theme-provider.tsx, i18n-provider.tsx
│       ├── app-shell/{nav.ts,app-nav.tsx,app-header.tsx,pref-controls.tsx,add-transaction-dialog.tsx}
│       └── cfk/                      # app motifs: icon, tile, tint, progress, list-row, hero, tone-badge,
│                                     # segmented-links, page-title, stat-card, tx-row, charts, charts-math
└── tests/
    ├── setup/{env.ts,global-setup.ts}
    ├── fixtures.ts                   # row factories for unit tests
    ├── unit/*.test.ts
    ├── api/*.test.ts                 # call route handlers directly against cashflowkub_test
    └── e2e/pages.test.ts             # fetches pages from a running server
```

---

### Task 1: Scaffold the Next.js app + core utilities

**Files:**
- Create: the whole scaffold under `cashflowkub/` (via `create-next-app` and `shadcn init`)
- Create: `vitest.config.ts`, `.env.example`, `src/lib/clock.ts`, `src/lib/format.ts`
- Test: `tests/unit/format.test.ts`, `tests/unit/clock.test.ts`

**Interfaces:**
- Produces: `REF_TODAY: Date`, `CURRENT_MONTH = '2026-06'`, `today(): Date`, `todayDay(): number` from `@/lib/clock`; `fmt(n)`, `signed(n)`, `compact(n)`, `pct(ratio)`, `clamp01(v)` from `@/lib/format`; vitest projects `unit`, `api`, `e2e`.

- [ ] **Step 1: Generate the app**

```bash
cd /Users/akkaraponph/Workspaces/codespaces/cashflowkub
pnpm create next-app@16.4.0 cashflowkub --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
cd cashflowkub
pnpm add @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 zod next-themes lucide-react
pnpm add -D prisma@7.10.0 vitest tsx dotenv
pnpm dlx shadcn@latest init --base-color neutral --yes
pnpm dlx shadcn@latest add button card badge dialog input label sheet table separator sonner
```

If `shadcn init` asks which component library to use, pick **Radix UI**.

- [ ] **Step 2: Add scripts and env files**

Set `"scripts"` in `package.json` to:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --project unit --project api",
  "test:unit": "vitest run --project unit",
  "test:api": "vitest run --project api",
  "test:e2e": "vitest run --project e2e",
  "db:deploy": "prisma migrate deploy",
  "db:seed": "prisma db seed"
}
```

Create `.env.example`:

```bash
# Local Postgres. On this machine the postgres password is the POSTGRES_PASSWORD in api/docker-compose.yml.
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cashflowkub
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cashflowkub_test
# Used by the e2e page smoke tests (a running `pnpm start`).
BASE_URL=http://localhost:3000
```

Copy it to `.env` with the real password, then create both databases:

```bash
cp .env.example .env   # then edit the password in both URLs
PGPASSWORD=<password> createdb -h localhost -U postgres cashflowkub
PGPASSWORD=<password> createdb -h localhost -U postgres cashflowkub_test
```

Confirm `.gitignore` contains `.env*` (create-next-app adds it), and append:

```
/src/generated/
!.env.example
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      {
        extends: true,
        test: {
          name: 'api',
          include: ['tests/api/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/setup/env.ts'],
          globalSetup: ['tests/setup/global-setup.ts'],
          fileParallelism: false,
        },
      },
      { extends: true, test: { name: 'e2e', include: ['tests/e2e/**/*.test.ts'], environment: 'node' } },
    ],
  },
});
```

(`tests/setup/*` is created in Task 2. Until then only run `--project unit`.)

- [ ] **Step 4: Write the failing tests**

`tests/unit/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clamp01, compact, fmt, pct, signed } from '@/lib/format';

describe('format', () => {
  it('fmt groups thousands and drops the sign', () => {
    expect(fmt(1234567)).toBe('฿1,234,567');
    expect(fmt(-18200)).toBe('฿18,200');
    expect(fmt(0)).toBe('฿0');
  });
  it('signed prefixes + or -', () => {
    expect(signed(44300)).toBe('+฿44,300');
    expect(signed(-185)).toBe('-฿185');
  });
  it('compact abbreviates k and M', () => {
    expect(compact(17700)).toBe('฿17.7k');
    expect(compact(1_250_000)).toBe('฿1.3M');
    expect(compact(950)).toBe('฿950');
  });
  it('pct rounds a ratio', () => {
    expect(pct(0.624)).toBe('62%');
  });
  it('clamp01 bounds a ratio', () => {
    expect(clamp01(1.3)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
  });
});
```

`tests/unit/clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CURRENT_MONTH, today, todayDay } from '@/lib/clock';

describe('clock', () => {
  it('is pinned to the design reference date', () => {
    expect(today().toISOString()).toBe('2026-06-18T00:00:00.000Z');
    expect(todayDay()).toBe(18);
    expect(CURRENT_MONTH).toBe('2026-06');
  });
  it('returns a copy callers cannot mutate', () => {
    const t = today();
    t.setUTCDate(1);
    expect(todayDay()).toBe(18);
  });
});
```

- [ ] **Step 5: Run them and see them fail**

Run: `pnpm test:unit`
Expected: FAIL, `Cannot find module '@/lib/format'` / `'@/lib/clock'`.

- [ ] **Step 6: Implement**

`src/lib/clock.ts`:

```ts
// The design comp is a fixed snapshot, so "today" is a constant (Jun 18, 2026)
// rather than the wall clock. Every date-relative label derives from today().
export const REF_TODAY = new Date(Date.UTC(2026, 5, 18));
export const CURRENT_MONTH = '2026-06';

export function today(): Date {
  return new Date(REF_TODAY);
}

export function todayDay(): number {
  return REF_TODAY.getUTCDate();
}
```

`src/lib/format.ts` (ported from `mobile/src/lib/format.ts`):

```ts
// Money + number formatting, done by hand so output is identical on server and client.

function group(n: number): string {
  return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "฿1,234": absolute value, no sign. */
export function fmt(n: number): string {
  return '฿' + group(n);
}

/** "+฿1,234" / "-฿1,234". */
export function signed(n: number): string {
  return (n < 0 ? '-' : '+') + fmt(n);
}

/** Compact baht for chart labels: 17700 -> "฿17.7k", 1_250_000 -> "฿1.3M". */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return '฿' + trim(abs / 1_000_000) + 'M';
  if (abs >= 1_000) return '฿' + trim(abs / 1_000) + 'k';
  return '฿' + group(abs);
}

function trim(v: number): string {
  return (Math.round(v * 10) / 10).toString();
}

/** "62%" from a 0..1 ratio. */
export function pct(ratio: number): string {
  return Math.round(ratio * 100) + '%';
}

/** Clamp a ratio into 0..1 for progress bars. */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
```

- [ ] **Step 7: Run tests, typecheck, build**

Run: `pnpm test:unit && pnpm typecheck && pnpm build`
Expected: unit tests PASS, typecheck clean, build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/akkaraponph/Workspaces/codespaces/cashflowkub
git add cashflowkub
git commit -m "feat(web): scaffold Next.js app with shadcn, vitest and core utilities"
```

---

### Task 2: Prisma schema, client, and API test harness

**Files:**
- Create: `prisma.config.ts`, `prisma/schema.prisma`, `src/lib/db.ts`
- Create: `tests/setup/env.ts`, `tests/setup/global-setup.ts`
- Modify: `package.json` (add `postinstall`)
- Test: `tests/api/db.test.ts`

**Interfaces:**
- Produces: `prisma` from `@/lib/db`. Model types import from `@/generated/prisma/client`: `Account`, `Category`, `Transaction`, `Budget`, `Goal`, `Debt`, `Asset`, `Bill`, `Channel`, `IncomeCategory`, `PlanItem`, `AssetSnapshot`, `NetWorthHistory`, `MonthlyCashflow`, `DaySpend`, `SetupGoal`, `SetupGoalChannel`, plus the `Prisma` namespace and `PrismaClient`. Field names equal the JSON keys of the Go API (`cat`, `acct`, `limit`, `group`) and are `@map`ped to the Go column names.

- [ ] **Step 1: Write the schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

/// A place money lives: bank, cash, e-wallet or credit line.
model Account {
  id        Int    @id @default(autoincrement())
  name      String
  sub       String @default("")
  balance   Int    @default(0) /// negative for credit balances owed
  icon      String @default("landmark")
  tint      String @default("doc")
  kind      String @default("bank") /// bank | cash | ewallet | credit
  startDate String @default("") @map("start_date")
  startTh   String @default("") @map("start_th")
  sort      Int    @default(0)

  @@map("accounts")
}

/// Spending/earning bucket; `key` is the slug used by transactions, budgets and the plan.
model Category {
  id    Int    @id @default(autoincrement())
  key   String @unique
  label String
  th    String @default("")
  short String @default("")
  icon  String @default("circle")
  tint  String @default("doc")
  type  String @default("expense") /// income | expense
  sub   String @default("") /// need | want
  sort  Int    @default(0)

  @@map("categories")
}

/// One money movement. Signed amount: negative = expense.
model Transaction {
  id     Int      @id @default(autoincrement())
  name   String
  cat    String   @map("cat_key")
  acct   String   @map("account")
  amount Int
  date   DateTime @db.Date
  note   String   @default("")

  @@index([date])
  @@map("transactions")
}

model Budget {
  id    Int    @id @default(autoincrement())
  cat   String @map("cat_key")
  spent Int    @default(0)
  limit Int    @map("limit_amt")
  sort  Int    @default(0)

  @@map("budgets")
}

model Goal {
  id      Int    @id @default(autoincrement())
  name    String
  th      String @default("")
  icon    String @default("target")
  saved   Int    @default(0)
  target  Int
  monthly Int    @default(0)
  by      String @default("")
  sort    Int    @default(0)

  @@map("goals")
}

/// A loan or credit line being paid down. remaining = original - paid (derived).
model Debt {
  id         Int     @id @default(autoincrement())
  name       String
  th         String  @default("")
  icon       String  @default("credit-card")
  tint       String  @default("pdf")
  original   Int
  paid       Int     @default(0)
  apr        Float   @default(0)
  monthly    Int     @default(0)
  calc       String  @default("reducing") /// flat | reducing
  payoff     String  @default("")
  payoffTh   String  @default("") @map("payoff_th")
  monthsLeft Int     @default(0) @map("months_left")
  done       Boolean @default(false)
  revolving  Boolean @default(false)
  sort       Int     @default(0)

  @@map("debts")
}

model Asset {
  id    Int    @id @default(autoincrement())
  name  String
  th    String @default("")
  icon  String @default("wallet")
  tint  String @default("doc")
  value Int    @default(0)
  sort  Int    @default(0)

  @@map("assets")
}

/// Payment due on a day of the month.
model Bill {
  id     Int     @id @default(autoincrement())
  name   String
  th     String  @default("")
  icon   String  @default("receipt")
  tint   String  @default("pdf")
  amount Int
  dueDay Int     @map("due_day")
  paid   Boolean @default(false)
  freq   String  @default("monthly") /// monthly | once
  cat    String  @default("bills") @map("cat_key")
  sort   Int     @default(0)

  @@map("bills")
}

model Channel {
  id        Int    @id @default(autoincrement())
  name      String
  th        String @default("")
  kind      String @default("saving") /// saving | mf | pf | stock | gold | bond
  icon      String @default("piggy-bank")
  tint      String @default("doc")
  opening   Int    @default(0)
  startDate String @default("") @map("start_date")
  startTh   String @default("") @map("start_th")
  sort      Int    @default(0)

  @@map("channels")
}

model IncomeCategory {
  id   Int    @id @default(autoincrement())
  name String
  th   String @default("")
  sub  String @default("main") /// main | side | passive
  icon String @default("briefcase")
  tint String @default("xls")
  sort Int    @default(0)

  @@map("income_categories")
}

/// Planned-vs-actual row for a month; `type` partitions the three plan tables.
model PlanItem {
  id      Int    @id @default(autoincrement())
  type    String /// income | expense | savings
  name    String
  th      String @default("")
  icon    String @default("")
  tint    String @default("")
  cat     String @default("") @map("cat_key")
  sub     String @default("")
  planned Int    @default(0)
  actual  Int    @default(0)
  month   String /// YYYY-MM
  sort    Int    @default(0)

  @@index([month])
  @@map("plan_items")
}

model AssetSnapshot {
  id    Int    @id @default(autoincrement())
  name  String
  th    String @default("")
  group String @map("grp") /// bank | savings | invest | other
  icon  String @default("")
  tint  String @default("")
  prev  Int    @default(0)
  curr  Int    @default(0)
  month String
  sort  Int    @default(0)

  @@map("asset_snapshots")
}

model NetWorthHistory {
  id      Int    @id @default(autoincrement())
  month   String
  monthTh String @map("month_th")
  value   Int
  sort    Int    @default(0)

  @@map("net_worth_histories")
}

model MonthlyCashflow {
  id      Int    @id @default(autoincrement())
  month   String
  income  Int
  expense Int
  sort    Int    @default(0)

  @@map("monthly_cashflows")
}

model DaySpend {
  id     Int    @id @default(autoincrement())
  day    Int
  amount Int
  month  String

  @@map("day_spends")
}

model SetupGoal {
  id          Int                @id @default(autoincrement())
  kind        String /// emergency | stocks | retirement | custom
  name        String
  th          String             @default("")
  icon        String             @default("target")
  tint        String             @default("doc")
  startDate   String             @default("") @map("start_date")
  startTh     String             @default("") @map("start_th")
  endDate     String             @default("") @map("end_date")
  endTh       String             @default("") @map("end_th")
  inflation   Float              @default(0)
  target      Int                @default(0)
  opening     Int                @default(0)
  currentAge  Int?               @map("current_age")
  retireAge   Int?               @map("retire_age")
  useUntilAge Int?               @map("use_until_age")
  monthlyNeed Int?               @map("monthly_need")
  sort        Int                @default(0)
  channels    SetupGoalChannel[]

  @@map("setup_goals")
}

model SetupGoalChannel {
  id          Int       @id @default(autoincrement())
  setupGoalId Int       @map("setup_goal_id")
  setupGoal   SetupGoal @relation(fields: [setupGoalId], references: [id], onDelete: Cascade)
  name        String
  th          String    @default("")
  pct         Int

  @@map("setup_goal_channels")
}
```

- [ ] **Step 2: Add Prisma config and client**

`prisma.config.ts`:

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
});
```

`src/lib/db.ts`:

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see .env.example)');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

// Reuse one client across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Add `"postinstall": "prisma generate"` to `package.json` scripts.

- [ ] **Step 3: Generate and apply the first migration**

`prisma migrate dev` needs an interactive terminal. Generate the SQL with `migrate diff` instead, then apply it with `migrate deploy`:

```bash
mkdir -p prisma/migrations/20261013000000_init
pnpm prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/20261013000000_init/migration.sql
printf '# Please do not edit this file manually\n# It should be added in your version-control system (e.g., Git)\nprovider = "postgresql"\n' > prisma/migrations/migration_lock.toml
pnpm prisma migrate deploy
pnpm prisma generate
```

Expected: `migration.sql` contains 17 `CREATE TABLE` statements and is applied to `cashflowkub`; the client is generated into `src/generated/prisma`. (Prisma 7 renamed `--to-schema-datamodel` to `--to-schema`. If the CLI rejects the flag, `pnpm prisma migrate diff --help` lists the current name.)

- [ ] **Step 4: Add the API test harness**

`tests/setup/global-setup.ts`:

```ts
import { execSync } from 'node:child_process';
import 'dotenv/config';

// Brings the test database schema up to date once per run. Data is reset per
// test file by seedDatabase() (TRUNCATE ... RESTART IDENTITY), never by migrate reset.
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
```

`tests/setup/env.ts`:

```ts
import 'dotenv/config';

// Point every Prisma client created in API tests at the test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
```

- [ ] **Step 5: Write the failing test**

`tests/api/db.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';

describe('database', () => {
  it('connects to the test database with every table migrated', async () => {
    const [{ current_database }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    expect(current_database).toBe('cashflowkub_test');
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
    expect(tables.map((t) => t.tablename)).toEqual([
      'accounts', 'asset_snapshots', 'assets', 'bills', 'budgets', 'categories', 'channels', 'day_spends',
      'debts', 'goals', 'income_categories', 'monthly_cashflows', 'net_worth_histories', 'plan_items',
      'setup_goal_channels', 'setup_goals', 'transactions',
    ]);
  });
});
```

- [ ] **Step 6: Run it**

Run: `pnpm test:api`
Expected: PASS. If you ran it before Step 4 it fails with `Cannot find module 'tests/setup/env.ts'`.

- [ ] **Step 7: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): prisma schema, client and api test harness"
```

---

### Task 3: Seed the demo dataset

**Files:**
- Create: `prisma/seed-data.ts`, `prisma/seed-lib.ts`, `prisma/seed.ts`
- Test: `tests/api/seed.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2).
- Produces: `seedDatabase(db: PrismaClient): Promise<void>`, exported from `prisma/seed-lib.ts`. It truncates every table and restarts identities, so ids are deterministic: insertion order starting at 1 (debt id 1 = "Student Loan (กยศ)", bill id 6 = "KTC Credit Card", transaction id 3 = "Grab"). Every API test calls it.

- [ ] **Step 1: Write the failing test**

`tests/api/seed.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { seedDatabase } from '../../prisma/seed-lib';

describe('seedDatabase', () => {
  beforeAll(async () => {
    await seedDatabase(prisma);
    await seedDatabase(prisma); // idempotent: second run must not duplicate rows or shift ids
  });

  it('loads the canonical row counts', async () => {
    expect({
      categories: await prisma.category.count(),
      accounts: await prisma.account.count(),
      transactions: await prisma.transaction.count(),
      budgets: await prisma.budget.count(),
      goals: await prisma.goal.count(),
      debts: await prisma.debt.count(),
      assets: await prisma.asset.count(),
      bills: await prisma.bill.count(),
      channels: await prisma.channel.count(),
      incomeCategories: await prisma.incomeCategory.count(),
      planItems: await prisma.planItem.count(),
      assetSnapshots: await prisma.assetSnapshot.count(),
      netWorthHistory: await prisma.netWorthHistory.count(),
      monthlyCashflow: await prisma.monthlyCashflow.count(),
      daySpend: await prisma.daySpend.count(),
      setupGoals: await prisma.setupGoal.count(),
      setupGoalChannels: await prisma.setupGoalChannel.count(),
    }).toEqual({
      categories: 7, accounts: 5, transactions: 12, budgets: 6, goals: 3, debts: 14, assets: 8, bills: 13,
      channels: 9, incomeCategories: 9, planItems: 16, assetSnapshots: 14, netWorthHistory: 6,
      monthlyCashflow: 6, daySpend: 11, setupGoals: 6, setupGoalChannels: 12,
    });
  });

  it('assigns deterministic ids', async () => {
    expect((await prisma.debt.findUniqueOrThrow({ where: { id: 1 } })).name).toBe('Student Loan (กยศ)');
    expect((await prisma.bill.findUniqueOrThrow({ where: { id: 6 } })).name).toBe('KTC Credit Card');
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: 3 } })).name).toBe('Grab');
  });

  it('stores transaction dates as calendar dates', async () => {
    const salary = await prisma.transaction.findUniqueOrThrow({ where: { id: 1 } });
    expect(salary.date.toISOString()).toBe('2026-06-18T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test:api tests/api/seed.test.ts`
Expected: FAIL, `Cannot find module '../../prisma/seed-lib'`.

- [ ] **Step 3: Port the dataset**

`prisma/seed-data.ts` is a verbatim port of `api/internal/seed/seed.go`. Keep row order exactly; ids depend on it.

```ts
// Canonical CashflowKub demo data, ported verbatim from api/internal/seed/seed.go
// (itself lifted from the design comp). Row order matters: ids are assigned in order.
import type { Prisma } from '../src/generated/prisma/client';

const MONTH = '2026-06';
const d = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export const categories: Prisma.CategoryCreateManyInput[] = [
  { key: 'food', label: 'Food & Dining', th: 'อาหาร', short: 'Food', icon: 'utensils', tint: 'folder', type: 'expense', sub: 'need', sort: 1 },
  { key: 'transport', label: 'Transport', th: 'เดินทาง', short: 'Transit', icon: 'car', tint: 'doc', type: 'expense', sub: 'need', sort: 2 },
  { key: 'shopping', label: 'Shopping', th: 'ช้อปปิ้ง', short: 'Shop', icon: 'shopping-bag', tint: 'image', type: 'expense', sub: 'want', sort: 3 },
  { key: 'bills', label: 'Bills', th: 'บิล', short: 'Bills', icon: 'receipt', tint: 'pdf', type: 'expense', sub: 'need', sort: 4 },
  { key: 'fun', label: 'Entertainment', th: 'บันเทิง', short: 'Fun', icon: 'clapperboard', tint: 'video', type: 'expense', sub: 'want', sort: 5 },
  { key: 'health', label: 'Health', th: 'สุขภาพ', short: 'Health', icon: 'heart-pulse', tint: 'xls', type: 'expense', sub: 'need', sort: 6 },
  { key: 'income', label: 'Income', th: 'รายรับ', short: 'Income', icon: 'arrow-down-left', tint: 'xls', type: 'income', sub: '', sort: 7 },
];

export const accounts: Prisma.AccountCreateManyInput[] = [
  { name: 'Kasikorn Savings', sub: 'KBank ••4821', balance: 128400, icon: 'landmark', tint: 'doc', kind: 'bank', startDate: 'Mar 1, 2019', startTh: '1 มี.ค. 2019', sort: 1 },
  { name: 'SCB Current', sub: 'SCB ••0192', balance: 42580, icon: 'landmark', tint: 'xls', kind: 'bank', startDate: 'Jul 12, 2020', startTh: '12 ก.ค. 2020', sort: 2 },
  { name: 'Cash Wallet', sub: 'เงินสด', balance: 3200, icon: 'banknote', tint: 'folder', kind: 'cash', startDate: 'Always', startTh: 'ตลอด', sort: 3 },
  { name: 'TrueMoney', sub: 'e-Wallet', balance: 1850, icon: 'wallet', tint: 'image', kind: 'ewallet', startDate: 'Sep 4, 2021', startTh: '4 ก.ย. 2021', sort: 4 },
  { name: 'KTC Credit', sub: '••7733', balance: -18200, icon: 'credit-card', tint: 'pdf', kind: 'credit', startDate: 'May 22, 2022', startTh: '22 พ.ค. 2022', sort: 5 },
];

export const transactions: Prisma.TransactionCreateManyInput[] = [
  { name: 'Monthly Salary', cat: 'income', acct: 'Kasikorn Savings', amount: 62000, date: d('2026-06-18'), note: 'Acme Co. payroll' },
  { name: 'Starbucks', cat: 'food', acct: 'SCB Current', amount: -185, date: d('2026-06-18'), note: 'Latte + croissant' },
  { name: 'Grab', cat: 'transport', acct: 'TrueMoney', amount: -120, date: d('2026-06-18'), note: 'Ride to office' },
  { name: '7-Eleven', cat: 'food', acct: 'Cash Wallet', amount: -248, date: d('2026-06-17'), note: 'Snacks' },
  { name: 'Netflix', cat: 'fun', acct: 'KTC Credit', amount: -419, date: d('2026-06-17'), note: 'Premium plan' },
  { name: 'PEA Electricity', cat: 'bills', acct: 'SCB Current', amount: -1240, date: d('2026-06-17'), note: 'June bill' },
  { name: 'Central Ladprao', cat: 'shopping', acct: 'KTC Credit', amount: -2890, date: d('2026-06-15'), note: 'Clothes' },
  { name: 'BTS Rabbit top-up', cat: 'transport', acct: 'TrueMoney', amount: -400, date: d('2026-06-15'), note: 'Commute card' },
  { name: 'Boots Pharmacy', cat: 'health', acct: 'SCB Current', amount: -560, date: d('2026-06-15'), note: 'Vitamins' },
  { name: 'Lazada', cat: 'shopping', acct: 'KTC Credit', amount: -1150, date: d('2026-06-14'), note: 'Phone case' },
  { name: 'Foodpanda', cat: 'food', acct: 'SCB Current', amount: -320, date: d('2026-06-14'), note: 'Dinner' },
  { name: 'Fitness First', cat: 'health', acct: 'SCB Current', amount: -1500, date: d('2026-06-13'), note: 'Membership' },
];

export const budgets: Prisma.BudgetCreateManyInput[] = [
  { cat: 'shopping', spent: 6500, limit: 5000, sort: 1 },
  { cat: 'food', spent: 4200, limit: 5000, sort: 2 },
  { cat: 'bills', spent: 3200, limit: 3500, sort: 3 },
  { cat: 'transport', spent: 1800, limit: 2500, sort: 4 },
  { cat: 'health', spent: 1100, limit: 1500, sort: 5 },
  { cat: 'fun', spent: 900, limit: 1500, sort: 6 },
];

export const goals: Prisma.GoalCreateManyInput[] = [
  { name: 'Emergency Fund', th: 'เงินสำรองฉุกเฉิน', icon: 'shield', saved: 145000, target: 200000, monthly: 8000, by: 'Ongoing', sort: 1 },
  { name: 'Japan Trip', th: 'เที่ยวญี่ปุ่น', icon: 'plane', saved: 64000, target: 120000, monthly: 6000, by: 'Dec 2026', sort: 2 },
  { name: 'New iPhone', th: 'ไอโฟนใหม่', icon: 'smartphone', saved: 28000, target: 45000, monthly: 3000, by: 'Sep 2026', sort: 3 },
];

export const debts: Prisma.DebtCreateManyInput[] = [
  { name: 'Student Loan (กยศ)', th: 'กยศ', icon: 'graduation-cap', tint: 'doc', original: 186650, paid: 8275, apr: 0, monthly: 3889, calc: 'flat', payoff: 'May 2030', payoffTh: 'พ.ค. 2030', monthsLeft: 46, sort: 1 },
  { name: 'KrungThai Personal', th: 'กรุงไทยใจป้ำ', icon: 'landmark', tint: 'pdf', original: 70000, paid: 24300, apr: 25, monthly: 2783, calc: 'reducing', payoff: 'Nov 2028', payoffTh: 'พ.ย. 2028', monthsLeft: 28, sort: 2 },
  { name: 'Kbank Nano 3', th: 'Kbank Nano 3', icon: 'credit-card', tint: 'pdf', original: 12000, paid: 4570, apr: 33, monthly: 1523, calc: 'reducing', payoff: 'Mar 2027', payoffTh: 'มี.ค. 2027', monthsLeft: 6, revolving: true, sort: 3 },
  { name: 'SPEC 3 Personal', th: 'SPEC 3', icon: 'receipt', tint: 'pdf', original: 9593, paid: 5300, apr: 33, monthly: 1607, calc: 'reducing', payoff: 'Dec 2026', payoffTh: 'ธ.ค. 2026', monthsLeft: 3, sort: 4 },
  { name: 'Kbank Nano 2', th: 'Kbank Nano 2', icon: 'credit-card', tint: 'pdf', original: 8000, paid: 5400, apr: 33, monthly: 1016, calc: 'reducing', payoff: 'Nov 2026', payoffTh: 'พ.ย. 2026', monthsLeft: 3, revolving: true, sort: 5 },
  { name: 'SPEC 4', th: 'SPEC 4', icon: 'receipt', tint: 'doc', original: 7789, paid: 7789, apr: 33, monthly: 948, calc: 'reducing', payoff: 'Jul 2026', payoffTh: 'ก.ค. 2026', monthsLeft: 0, done: true, sort: 6 },
  { name: 'iPhone 16 / PQ', th: 'ผ่อน iPhone 16 กับ PQ', icon: 'smartphone', tint: 'image', original: 30580, paid: 30580, apr: 0, monthly: 3058, calc: 'flat', payoff: 'Mar 2026', payoffTh: 'มี.ค. 2026', monthsLeft: 0, done: true, sort: 7 },
  { name: 'Motorcycle', th: 'รถมอเตอร์ไซค์', icon: 'bike', tint: 'doc', original: 14885, paid: 14885, apr: 0, monthly: 2977, calc: 'flat', payoff: 'Apr 2025', payoffTh: 'เม.ย. 2025', monthsLeft: 0, done: true, sort: 8 },
  { name: 'iPhone Piggybank', th: 'ยืมกระปุก IPHONE', icon: 'piggy-bank', tint: 'folder', original: 15800, paid: 15800, apr: 0, monthly: 7900, calc: 'flat', payoff: 'Feb 2025', payoffTh: 'ก.พ. 2025', monthsLeft: 0, done: true, sort: 9 },
  { name: 'Kbank Nano 1', th: 'Kbank Nano', icon: 'credit-card', tint: 'pdf', original: 5000, paid: 5000, apr: 33, monthly: 635, calc: 'reducing', payoff: 'Jul 2025', payoffTh: 'ก.ค. 2025', monthsLeft: 0, done: true, sort: 10 },
  { name: 'SPEC 1', th: 'SPEC 1', icon: 'receipt', tint: 'pdf', original: 4032, paid: 4032, apr: 31.4, monthly: 898, calc: 'reducing', payoff: 'Sep 2025', payoffTh: 'ก.ย. 2025', monthsLeft: 0, done: true, sort: 11 },
  { name: 'SPEC 2', th: 'SPEC 2', icon: 'receipt', tint: 'pdf', original: 5514, paid: 5514, apr: 33, monthly: 915, calc: 'reducing', payoff: 'Aug 2025', payoffTh: 'ส.ค. 2025', monthsLeft: 0, done: true, sort: 12 },
  { name: 'Water Heater / PQ', th: 'เครื่องทำน้ำอุ่น พี่คิว', icon: 'shower-head', tint: 'image', original: 1886, paid: 1886, apr: 0, monthly: 629, calc: 'flat', payoff: 'Mar 2025', payoffTh: 'มี.ค. 2025', monthsLeft: 0, done: true, sort: 13 },
  { name: 'Desk & Keyboard', th: 'โต๊ะ และ คีย์บอร์ด', icon: 'monitor', tint: 'doc', original: 2137, paid: 2137, apr: 0, monthly: 712, calc: 'flat', payoff: 'Jul 2025', payoffTh: 'ก.ค. 2025', monthsLeft: 0, done: true, sort: 14 },
];

export const assets: Prisma.AssetCreateManyInput[] = [
  { name: 'Kasikorn Savings', th: 'ออมทรัพย์ กสิกร', icon: 'landmark', tint: 'doc', value: 128400, sort: 1 },
  { name: 'SCB Current', th: 'กระแสรายวัน SCB', icon: 'landmark', tint: 'xls', value: 42580, sort: 2 },
  { name: 'Cash Wallet', th: 'เงินสด', icon: 'banknote', tint: 'folder', value: 3200, sort: 3 },
  { name: 'TrueMoney Wallet', th: 'TrueMoney', icon: 'wallet', tint: 'image', value: 1850, sort: 4 },
  { name: 'SSF Mutual Fund', th: 'กองทุน SSF', icon: 'trending-up', tint: 'xls', value: 82400, sort: 5 },
  { name: 'Provident Fund', th: 'กองทุนสำรองเลี้ยงชีพ', icon: 'piggy-bank', tint: 'xls', value: 48500, sort: 6 },
  { name: 'Motorcycle', th: 'รถมอเตอร์ไซค์', icon: 'bike', tint: 'doc', value: 22000, sort: 7 },
  { name: 'Electronics & Gear', th: 'อุปกรณ์อิเล็กทรอนิกส์', icon: 'monitor', tint: 'image', value: 35000, sort: 8 },
];

export const bills: Prisma.BillCreateManyInput[] = [
  { name: 'Spotify Family', th: 'Spotify Family', icon: 'music', tint: 'image', amount: 149, dueDay: 1, paid: true, freq: 'monthly', cat: 'fun', sort: 1 },
  { name: 'Netflix Premium', th: 'Netflix Premium', icon: 'clapperboard', tint: 'video', amount: 419, dueDay: 3, paid: true, freq: 'monthly', cat: 'fun', sort: 2 },
  { name: 'Apartment Rent', th: 'ค่าเช่าบ้าน', icon: 'house', tint: 'folder', amount: 12000, dueDay: 5, paid: true, freq: 'monthly', cat: 'bills', sort: 3 },
  { name: 'PEA Electricity', th: 'ค่าไฟ PEA', icon: 'zap', tint: 'pdf', amount: 1240, dueDay: 10, paid: true, freq: 'monthly', cat: 'bills', sort: 4 },
  { name: 'AIS Fiber Internet', th: 'AIS Fiber อินเทอร์เน็ต', icon: 'wifi', tint: 'doc', amount: 590, dueDay: 15, paid: true, freq: 'monthly', cat: 'bills', sort: 5 },
  { name: 'KTC Credit Card', th: 'บัตรเครดิต KTC', icon: 'credit-card', tint: 'pdf', amount: 2500, dueDay: 16, paid: false, freq: 'monthly', cat: 'debt', sort: 6 },
  { name: 'MEA Water', th: 'ค่าน้ำประปา', icon: 'droplet', tint: 'doc', amount: 180, dueDay: 20, paid: false, freq: 'monthly', cat: 'bills', sort: 7 },
  { name: 'AIS Mobile', th: 'AIS มือถือ', icon: 'smartphone', tint: 'image', amount: 399, dueDay: 20, paid: false, freq: 'monthly', cat: 'bills', sort: 8 },
  { name: 'Kbank Nano 3', th: 'Kbank Nano 3', icon: 'credit-card', tint: 'pdf', amount: 1523, dueDay: 25, paid: false, freq: 'monthly', cat: 'debt', sort: 9 },
  { name: 'KrungThai Personal', th: 'กรุงไทยใจป้ำ', icon: 'landmark', tint: 'pdf', amount: 2783, dueDay: 25, paid: false, freq: 'monthly', cat: 'debt', sort: 10 },
  { name: 'Student Loan (กยศ)', th: 'กยศ', icon: 'graduation-cap', tint: 'doc', amount: 3889, dueDay: 28, paid: false, freq: 'monthly', cat: 'debt', sort: 11 },
  { name: 'AIA Life Insurance', th: 'ประกันชีวิต AIA', icon: 'shield', tint: 'xls', amount: 1850, dueDay: 30, paid: false, freq: 'monthly', cat: 'bills', sort: 12 },
  { name: 'iCloud+ 200GB', th: 'iCloud+ 200GB', icon: 'cloud', tint: 'image', amount: 99, dueDay: 30, paid: false, freq: 'monthly', cat: 'fun', sort: 13 },
];

export const channels: Prisma.ChannelCreateManyInput[] = [
  { name: 'SCB Easy Savings', th: 'SCB Easy ออมทรัพย์', kind: 'saving', icon: 'piggy-bank', tint: 'doc', opening: 35000, startDate: 'Jan 1, 2025', startTh: '1 ม.ค. 2025', sort: 1 },
  { name: 'TMRW High-yield', th: 'TMRW ดอกเบี้ยสูง', kind: 'saving', icon: 'piggy-bank', tint: 'xls', opening: 50000, startDate: 'Mar 12, 2025', startTh: '12 มี.ค. 2025', sort: 2 },
  { name: 'SSF Mutual Fund', th: 'กองทุน SSF', kind: 'mf', icon: 'trending-up', tint: 'xls', opening: 82400, startDate: 'Apr 1, 2024', startTh: '1 เม.ย. 2024', sort: 3 },
  { name: 'RMF Mutual Fund', th: 'กองทุน RMF', kind: 'mf', icon: 'pie-chart', tint: 'pdf', opening: 32000, startDate: 'Jan 1, 2024', startTh: '1 ม.ค. 2024', sort: 4 },
  { name: 'Provident Fund', th: 'กองทุนสำรองเลี้ยงชีพ', kind: 'pf', icon: 'briefcase', tint: 'folder', opening: 48500, startDate: 'Jun 1, 2022', startTh: '1 มิ.ย. 2022', sort: 5 },
  { name: 'SET portfolio', th: 'พอร์ตหุ้นไทย', kind: 'stock', icon: 'bar-chart-3', tint: 'pdf', opening: 28000, startDate: 'Aug 14, 2024', startTh: '14 ส.ค. 2024', sort: 6 },
  { name: 'US ETF portfolio', th: 'พอร์ตหุ้นต่างประเทศ', kind: 'stock', icon: 'globe', tint: 'image', opening: 18000, startDate: 'Nov 1, 2024', startTh: '1 พ.ย. 2024', sort: 7 },
  { name: 'Gold savings', th: 'ออมทอง', kind: 'gold', icon: 'coins', tint: 'image', opening: 15000, startDate: 'Jan 1, 2025', startTh: '1 ม.ค. 2025', sort: 8 },
  { name: 'Government bond', th: 'พันธบัตรรัฐบาล', kind: 'bond', icon: 'landmark', tint: 'doc', opening: 100000, startDate: 'Feb 1, 2023', startTh: '1 ก.พ. 2023', sort: 9 },
];

export const incomeCategories: Prisma.IncomeCategoryCreateManyInput[] = [
  { name: 'Monthly salary', th: 'เงินเดือน', sub: 'main', icon: 'briefcase', tint: 'xls', sort: 1 },
  { name: 'Year-end bonus', th: 'โบนัสประจำปี', sub: 'main', icon: 'gift', tint: 'xls', sort: 2 },
  { name: 'Overtime pay', th: 'ค่าล่วงเวลา', sub: 'main', icon: 'clock-3', tint: 'xls', sort: 3 },
  { name: 'Freelance work', th: 'รับงานฟรีแลนซ์', sub: 'side', icon: 'pen-tool', tint: 'doc', sort: 4 },
  { name: 'Online shop sales', th: 'ขายของออนไลน์', sub: 'side', icon: 'shopping-bag', tint: 'folder', sort: 5 },
  { name: 'Tutoring', th: 'สอนพิเศษ', sub: 'side', icon: 'book-open', tint: 'doc', sort: 6 },
  { name: 'Stock dividends', th: 'เงินปันผลหุ้น', sub: 'passive', icon: 'trending-up', tint: 'pdf', sort: 7 },
  { name: 'Mutual fund yield', th: 'ผลตอบแทนกองทุน', sub: 'passive', icon: 'pie-chart', tint: 'pdf', sort: 8 },
  { name: 'Rental income', th: 'ค่าเช่า', sub: 'passive', icon: 'house', tint: 'folder', sort: 9 },
];

export const planItems: Prisma.PlanItemCreateManyInput[] = [
  { type: 'income', name: 'Monthly salary', th: 'เงินเดือน', icon: 'briefcase', tint: 'xls', planned: 60000, actual: 62000, month: MONTH, sort: 1 },
  { type: 'income', name: 'Year-end bonus', th: 'โบนัสประจำปี', icon: 'gift', tint: 'xls', planned: 0, actual: 0, month: MONTH, sort: 2 },
  { type: 'income', name: 'Freelance work', th: 'รับงานฟรีแลนซ์', icon: 'pen-tool', tint: 'doc', planned: 5000, actual: 3200, month: MONTH, sort: 3 },
  { type: 'income', name: 'Stock dividends', th: 'เงินปันผลหุ้น', icon: 'trending-up', tint: 'pdf', planned: 1500, actual: 1820, month: MONTH, sort: 4 },
  { type: 'income', name: 'Other', th: 'อื่น ๆ', icon: 'plus', tint: 'folder', planned: 0, actual: 0, month: MONTH, sort: 5 },
  { type: 'expense', name: 'Food & Dining', th: 'ค่าอาหาร', cat: 'food', sub: 'need', planned: 5000, actual: 4200, month: MONTH, sort: 1 },
  { type: 'expense', name: 'Transport', th: 'ค่าเดินทาง', cat: 'transport', sub: 'need', planned: 2500, actual: 1800, month: MONTH, sort: 2 },
  { type: 'expense', name: 'Bills', th: 'ค่าน้ำ ค่าไฟ บิล', cat: 'bills', sub: 'need', planned: 3500, actual: 3200, month: MONTH, sort: 3 },
  { type: 'expense', name: 'Health', th: 'สุขภาพ', cat: 'health', sub: 'need', planned: 1500, actual: 1100, month: MONTH, sort: 4 },
  { type: 'expense', name: 'Shopping', th: 'ช้อปปิ้ง', cat: 'shopping', sub: 'want', planned: 5000, actual: 6500, month: MONTH, sort: 5 },
  { type: 'expense', name: 'Entertainment', th: 'บันเทิง', cat: 'fun', sub: 'want', planned: 1500, actual: 900, month: MONTH, sort: 6 },
  { type: 'savings', name: 'Emergency fund', th: 'เงินสำรองฉุกเฉิน', icon: 'shield-check', tint: 'doc', planned: 8000, actual: 8000, month: MONTH, sort: 1 },
  { type: 'savings', name: 'Stock portfolio', th: 'พอร์ตหุ้น', icon: 'trending-up', tint: 'xls', planned: 5000, actual: 5500, month: MONTH, sort: 2 },
  { type: 'savings', name: 'Retirement', th: 'เงินเพื่อเกษียณ', icon: 'tent-tree', tint: 'folder', planned: 4500, actual: 4500, month: MONTH, sort: 3 },
  { type: 'savings', name: 'Japan trip', th: 'เที่ยวญี่ปุ่น', icon: 'plane', tint: 'image', planned: 6000, actual: 4000, month: MONTH, sort: 4 },
  { type: 'savings', name: 'New iPhone', th: 'ไอโฟนใหม่', icon: 'smartphone', tint: 'pdf', planned: 3000, actual: 3000, month: MONTH, sort: 5 },
];

export const assetSnapshots: Prisma.AssetSnapshotCreateManyInput[] = [
  { name: 'Kasikorn Savings', th: 'ออมทรัพย์ กสิกร', group: 'bank', icon: 'landmark', tint: 'doc', prev: 122100, curr: 128400, month: MONTH, sort: 1 },
  { name: 'SCB Current', th: 'กระแสรายวัน SCB', group: 'bank', icon: 'landmark', tint: 'xls', prev: 41200, curr: 42580, month: MONTH, sort: 2 },
  { name: 'Cash Wallet', th: 'เงินสด', group: 'bank', icon: 'banknote', tint: 'folder', prev: 3500, curr: 3200, month: MONTH, sort: 3 },
  { name: 'TrueMoney', th: 'TrueMoney', group: 'bank', icon: 'wallet', tint: 'image', prev: 1200, curr: 1850, month: MONTH, sort: 4 },
  { name: 'SCB Easy Savings', th: 'SCB Easy ออมทรัพย์', group: 'savings', icon: 'piggy-bank', tint: 'doc', prev: 34800, curr: 35000, month: MONTH, sort: 5 },
  { name: 'TMRW High-yield', th: 'TMRW ดอกเบี้ยสูง', group: 'savings', icon: 'piggy-bank', tint: 'xls', prev: 49500, curr: 50000, month: MONTH, sort: 6 },
  { name: 'SSF Mutual Fund', th: 'กองทุน SSF', group: 'invest', icon: 'trending-up', tint: 'xls', prev: 80100, curr: 82400, month: MONTH, sort: 7 },
  { name: 'RMF Mutual Fund', th: 'กองทุน RMF', group: 'invest', icon: 'pie-chart', tint: 'pdf', prev: 31200, curr: 32000, month: MONTH, sort: 8 },
  { name: 'Provident Fund', th: 'กองทุนสำรองเลี้ยงชีพ', group: 'invest', icon: 'briefcase', tint: 'folder', prev: 47200, curr: 48500, month: MONTH, sort: 9 },
  { name: 'SET portfolio', th: 'พอร์ตหุ้นไทย', group: 'invest', icon: 'bar-chart-3', tint: 'pdf', prev: 30100, curr: 28000, month: MONTH, sort: 10 },
  { name: 'US ETF', th: 'พอร์ตหุ้นต่างประเทศ', group: 'invest', icon: 'globe', tint: 'image', prev: 16800, curr: 18000, month: MONTH, sort: 11 },
  { name: 'Gold savings', th: 'ออมทอง', group: 'invest', icon: 'coins', tint: 'image', prev: 14200, curr: 15000, month: MONTH, sort: 12 },
  { name: 'Motorcycle', th: 'รถมอเตอร์ไซค์', group: 'other', icon: 'bike', tint: 'doc', prev: 22500, curr: 22000, month: MONTH, sort: 13 },
  { name: 'Electronics', th: 'อุปกรณ์อิเล็กทรอนิกส์', group: 'other', icon: 'monitor', tint: 'image', prev: 35800, curr: 35000, month: MONTH, sort: 14 },
];

export const netWorthHistory: Prisma.NetWorthHistoryCreateManyInput[] = [
  { month: 'Jan', monthTh: 'ม.ค.', value: 295000, sort: 1 },
  { month: 'Feb', monthTh: 'ก.พ.', value: 312000, sort: 2 },
  { month: 'Mar', monthTh: 'มี.ค.', value: 328000, sort: 3 },
  { month: 'Apr', monthTh: 'เม.ย.', value: 446000, sort: 4 },
  { month: 'May', monthTh: 'พ.ค.', value: 510200, sort: 5 },
  { month: 'Jun', monthTh: 'มิ.ย.', value: 540850, sort: 6 },
];

export const monthlyCashflow: Prisma.MonthlyCashflowCreateManyInput[] = [
  { month: 'Jan', income: 60000, expense: 38000, sort: 1 },
  { month: 'Feb', income: 60000, expense: 42000, sort: 2 },
  { month: 'Mar', income: 62000, expense: 35000, sort: 3 },
  { month: 'Apr', income: 60000, expense: 47000, sort: 4 },
  { month: 'May', income: 62000, expense: 39000, sort: 5 },
  { month: 'Jun', income: 62000, expense: 17700, sort: 6 },
];

const DAY_SPEND: Record<number, number> = { 1: 149, 3: 419, 5: 12000, 7: 540, 10: 1240, 12: 280, 13: 1500, 14: 1470, 15: 1180, 17: 2219, 18: 553 };
export const daySpend: Prisma.DaySpendCreateManyInput[] = Object.entries(DAY_SPEND).map(([day, amount]) => ({ day: Number(day), amount, month: MONTH }));

type SetupGoalSeed = Omit<Prisma.SetupGoalCreateInput, 'channels'> & { channels: { name: string; th: string; pct: number }[] };
export const setupGoals: SetupGoalSeed[] = [
  {
    kind: 'emergency', name: 'Emergency fund', th: 'เงินสำรองเผื่อฉุกเฉิน 6 เดือน', icon: 'shield-check', tint: 'doc',
    startDate: 'Jan 2025', startTh: 'ม.ค. 2025', endDate: 'Dec 2025', endTh: 'ธ.ค. 2025', inflation: 4, target: 155287, opening: 25000, sort: 1,
    channels: [{ name: 'SCB Easy Savings', th: 'SCB Easy ออมทรัพย์', pct: 60 }, { name: 'TMRW High-yield', th: 'TMRW ดอกเบี้ยสูง', pct: 40 }],
  },
  {
    kind: 'stocks', name: 'Stock portfolio', th: 'พอร์ตหุ้น', icon: 'trending-up', tint: 'xls',
    startDate: 'Jan 2026', startTh: 'ม.ค. 2026', endDate: 'Dec 2030', endTh: 'ธ.ค. 2030', inflation: 4, target: 500000, opening: 28000, sort: 2,
    channels: [{ name: 'SET portfolio', th: 'พอร์ตหุ้นไทย', pct: 70 }, { name: 'US ETF', th: 'พอร์ตหุ้นต่างประเทศ', pct: 30 }],
  },
  {
    kind: 'retirement', name: 'Retirement', th: 'เงินเพื่อเกษียณ', icon: 'tent-tree', tint: 'folder',
    inflation: 4, opening: 80500, currentAge: 23, retireAge: 60, useUntilAge: 80, monthlyNeed: 10000, sort: 3,
    channels: [
      { name: 'Provident fund', th: 'กองทุนสำรองเลี้ยงชีพ', pct: 45 },
      { name: 'SSF', th: 'กองทุน SSF', pct: 30 },
      { name: 'RMF', th: 'กองทุน RMF', pct: 25 },
    ],
  },
  {
    kind: 'custom', name: 'Japan trip', th: 'เที่ยวญี่ปุ่น', icon: 'plane', tint: 'image',
    startDate: 'Jan 2026', startTh: 'ม.ค. 2026', endDate: 'Dec 2026', endTh: 'ธ.ค. 2026', inflation: 3, target: 120000, opening: 64000, sort: 4,
    channels: [{ name: 'TMB Travel Savings', th: 'TMB ออมทริป', pct: 100 }],
  },
  {
    kind: 'custom', name: 'New iPhone', th: 'ไอโฟนใหม่', icon: 'smartphone', tint: 'pdf',
    startDate: 'Mar 2026', startTh: 'มี.ค. 2026', endDate: 'Sep 2026', endTh: 'ก.ย. 2026', inflation: 0, target: 45000, opening: 28000, sort: 5,
    channels: [{ name: 'Cash Wallet', th: 'เงินสด', pct: 100 }],
  },
  {
    kind: 'custom', name: 'Buy a condo', th: 'ซื้อคอนโด', icon: 'house', tint: 'folder',
    startDate: 'Jan 2026', startTh: 'ม.ค. 2026', endDate: 'Dec 2032', endTh: 'ธ.ค. 2032', inflation: 4, target: 2500000, opening: 50000, sort: 6,
    channels: [{ name: 'High-yield savings', th: 'ออมดอกสูง', pct: 60 }, { name: 'Government bond', th: 'พันธบัตรรัฐบาล', pct: 40 }],
  },
];
```

- [ ] **Step 4: Implement the seeder and CLI**

`prisma/seed-lib.ts`:

```ts
import type { PrismaClient } from '../src/generated/prisma/client';
import * as data from './seed-data';

const TABLES = [
  'setup_goal_channels', 'setup_goals', 'day_spends', 'monthly_cashflows', 'net_worth_histories',
  'asset_snapshots', 'plan_items', 'income_categories', 'channels', 'bills', 'assets', 'debts',
  'goals', 'budgets', 'transactions', 'categories', 'accounts',
];

/** Replaces all data with the canonical demo set. Idempotent; ids restart at 1. */
export async function seedDatabase(db: PrismaClient): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    await tx.category.createMany({ data: data.categories });
    await tx.account.createMany({ data: data.accounts });
    await tx.transaction.createMany({ data: data.transactions });
    await tx.budget.createMany({ data: data.budgets });
    await tx.goal.createMany({ data: data.goals });
    await tx.debt.createMany({ data: data.debts });
    await tx.asset.createMany({ data: data.assets });
    await tx.bill.createMany({ data: data.bills });
    await tx.channel.createMany({ data: data.channels });
    await tx.incomeCategory.createMany({ data: data.incomeCategories });
    await tx.planItem.createMany({ data: data.planItems });
    await tx.assetSnapshot.createMany({ data: data.assetSnapshots });
    await tx.netWorthHistory.createMany({ data: data.netWorthHistory });
    await tx.monthlyCashflow.createMany({ data: data.monthlyCashflow });
    await tx.daySpend.createMany({ data: data.daySpend });
    for (const { channels, ...goal } of data.setupGoals) {
      await tx.setupGoal.create({ data: { ...goal, channels: { create: channels } } });
    }
  });
}
```

`prisma/seed.ts`:

```ts
import { prisma } from '../src/lib/db';
import { seedDatabase } from './seed-lib';

seedDatabase(prisma)
  .then(() => console.log('seed: complete'))
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 5: Run the test, then seed the dev DB**

Run: `pnpm test:api tests/api/seed.test.ts`
Expected: PASS.

Run: `pnpm db:seed`
Expected: `seed: complete`.

- [ ] **Step 6: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): port canonical demo seed data"
```

---

### Task 4: Pure logic — views, transactions, debts, bills

**Files:**
- Create: `src/server/errors.ts`, `src/server/views.ts`, `src/server/transaction/logic.ts`, `src/server/debt/logic.ts`, `src/server/bill/logic.ts`
- Create: `tests/fixtures.ts`
- Test: `tests/unit/views.test.ts`, `tests/unit/transaction-logic.test.ts`, `tests/unit/debt-logic.test.ts`, `tests/unit/bill-logic.test.ts`

**Interfaces:**
- Consumes: Prisma model types (Task 2), `today()` (Task 1).
- Produces:
  - `class HttpError extends Error { status: number }`, `notFound(): HttpError`, `badRequest(msg): HttpError` from `@/server/errors`.
  - `interface DebtView extends Debt { remaining: number; progress: number }`, `toDebtView(d: Debt): DebtView`; `type BillStatus = 'paid'|'overdue'|'dueToday'|'dueSoon'|'upcoming'`, `interface BillView extends Bill { status: BillStatus; daysDiff: number }`, `toBillView(b: Bill, todayDay: number): BillView` from `@/server/views`.
  - `interface TxView { id; name; cat; acct; amount; note; date: string; group: string }`, `toTxView(t, today)`, `groupLabel(date, today)`, `formatLongDate(d)`, `parseFlexDate(s): Date | null`, `interface TxFilter`, `parseTxFilter(params: URLSearchParams): TxFilter` from `@/server/transaction/logic`.
  - `interface ScheduleRow { month; payment; principal; interest; balance }`, `interface ScheduleView { debt: DebtView; schedule: ScheduleRow[]; totalInterest; months }`, `buildSchedule(d: Debt): ScheduleView`, `applyPayment(d: Debt, amount: number): Debt`, `type Strategy = 'avalanche'|'snowball'|'custom'`, `parseStrategy(v: string | undefined): Strategy`, `sortByStrategy(debts: DebtView[], s: Strategy): DebtView[]` from `@/server/debt/logic`.
  - `interface BillSummary { total; paid; remaining; count; month; today; nextBill: BillView | null; daySpend: DaySpend[] }`, `buildBillSummary(bills, days, todayDay, month)`, `applyPaid(b: Bill, paid?: boolean): Bill` from `@/server/bill/logic`.
  - Test factories `debt()`, `bill()`, `tx()`, `budget()`, `category()`, `asset()`, `planItem()`, `snapshot()`, `nwPoint()`, `cashflow()`, `goal()`, `setupGoal()` from `tests/fixtures.ts`.

- [ ] **Step 1: Write the fixtures**

`tests/fixtures.ts`:

```ts
// Row factories for unit tests: complete Prisma rows with neutral defaults.
import type {
  Asset, AssetSnapshot, Bill, Budget, Category, Debt, Goal, MonthlyCashflow, NetWorthHistory, PlanItem, Prisma, Transaction,
} from '@/generated/prisma/client';

export const debt = (o: Partial<Debt> = {}): Debt => ({
  id: 1, name: 'Loan', th: 'เงินกู้', icon: 'landmark', tint: 'pdf', original: 10000, paid: 0, apr: 0,
  monthly: 1000, calc: 'reducing', payoff: '', payoffTh: '', monthsLeft: 10, done: false, revolving: false, sort: 1, ...o,
});
export const bill = (o: Partial<Bill> = {}): Bill => ({
  id: 1, name: 'Bill', th: 'บิล', icon: 'receipt', tint: 'pdf', amount: 100, dueDay: 20, paid: false, freq: 'monthly', cat: 'bills', sort: 1, ...o,
});
export const tx = (o: Partial<Transaction> = {}): Transaction => ({
  id: 1, name: 'Coffee', cat: 'food', acct: 'Cash', amount: -100, date: new Date('2026-06-18T00:00:00Z'), note: '', ...o,
});
export const budget = (o: Partial<Budget> = {}): Budget => ({ id: 1, cat: 'food', spent: 0, limit: 1000, sort: 1, ...o });
export const category = (o: Partial<Category> = {}): Category => ({
  id: 1, key: 'food', label: 'Food', th: 'อาหาร', short: 'Food', icon: 'utensils', tint: 'folder', type: 'expense', sub: 'need', sort: 1, ...o,
});
export const asset = (o: Partial<Asset> = {}): Asset => ({ id: 1, name: 'Bank', th: 'ธนาคาร', icon: 'landmark', tint: 'doc', value: 0, sort: 1, ...o });
export const planItem = (o: Partial<PlanItem> = {}): PlanItem => ({
  id: 1, type: 'income', name: 'Salary', th: 'เงินเดือน', icon: '', tint: '', cat: '', sub: '', planned: 0, actual: 0, month: '2026-06', sort: 1, ...o,
});
export const snapshot = (o: Partial<AssetSnapshot> = {}): AssetSnapshot => ({
  id: 1, name: 'Bank', th: 'ธนาคาร', group: 'bank', icon: '', tint: '', prev: 0, curr: 0, month: '2026-06', sort: 1, ...o,
});
export const nwPoint = (o: Partial<NetWorthHistory> = {}): NetWorthHistory => ({ id: 1, month: 'Jun', monthTh: 'มิ.ย.', value: 0, sort: 1, ...o });
export const cashflow = (o: Partial<MonthlyCashflow> = {}): MonthlyCashflow => ({ id: 1, month: 'Jun', income: 0, expense: 0, sort: 1, ...o });
export const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 1, name: 'Goal', th: 'เป้าหมาย', icon: 'target', saved: 0, target: 1000, monthly: 0, by: '', sort: 1, ...o,
});
export type SetupGoalRow = Prisma.SetupGoalGetPayload<{ include: { channels: true } }>;
export const setupGoal = (o: Partial<SetupGoalRow> = {}): SetupGoalRow => ({
  id: 1, kind: 'custom', name: 'Trip', th: 'เที่ยว', icon: 'plane', tint: 'image', startDate: '', startTh: '', endDate: '', endTh: '',
  inflation: 0, target: 0, opening: 0, currentAge: null, retireAge: null, useUntilAge: null, monthlyNeed: null, sort: 1, channels: [], ...o,
});
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/views.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toBillView, toDebtView } from '@/server/views';
import { bill, debt } from '../fixtures';

describe('toDebtView', () => {
  it('derives remaining and progress', () => {
    const v = toDebtView(debt({ original: 70000, paid: 24300 }));
    expect(v.remaining).toBe(45700);
    expect(v.progress).toBeCloseTo(0.3471, 4);
  });
  it('never reports negative remaining and survives a zero original', () => {
    expect(toDebtView(debt({ original: 100, paid: 150 })).remaining).toBe(0);
    expect(toDebtView(debt({ original: 0, paid: 0 })).progress).toBe(0);
  });
});

describe('toBillView', () => {
  it.each([
    [{ paid: true, dueDay: 1 }, 'paid', -17],
    [{ dueDay: 16 }, 'overdue', -2],
    [{ dueDay: 18 }, 'dueToday', 0],
    [{ dueDay: 23 }, 'dueSoon', 5],
    [{ dueDay: 24 }, 'upcoming', 6],
  ] as const)('%o -> %s', (o, status, diff) => {
    const v = toBillView(bill(o), 18);
    expect(v.status).toBe(status);
    expect(v.daysDiff).toBe(diff);
  });
});
```

`tests/unit/transaction-logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatLongDate, groupLabel, parseFlexDate, parseTxFilter, toTxView } from '@/server/transaction/logic';
import { HttpError } from '@/server/errors';
import { tx } from '../fixtures';

const TODAY = new Date('2026-06-18T00:00:00Z');
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('groupLabel', () => {
  it('buckets Today / Yesterday / short date', () => {
    expect(groupLabel(day('2026-06-18'), TODAY)).toBe('Today');
    expect(groupLabel(day('2026-06-17'), TODAY)).toBe('Yesterday');
    expect(groupLabel(day('2026-06-15'), TODAY)).toBe('Jun 15');
  });
  it('handles yesterday across a year boundary', () => {
    expect(groupLabel(day('2025-12-31'), day('2026-01-01'))).toBe('Yesterday');
  });
});

describe('toTxView', () => {
  it('formats date and group, and drops the raw Date', () => {
    const v = toTxView(tx({ id: 7, date: day('2026-06-15') }), TODAY);
    expect(v).toEqual({ id: 7, name: 'Coffee', cat: 'food', acct: 'Cash', amount: -100, note: '', date: 'Jun 15, 2026', group: 'Jun 15' });
    expect(formatLongDate(day('2026-01-02'))).toBe('Jan 2, 2026');
  });
});

describe('parseFlexDate', () => {
  it('accepts the three supported layouts', () => {
    expect(parseFlexDate('Jun 18, 2026')?.toISOString()).toBe('2026-06-18T00:00:00.000Z');
    expect(parseFlexDate('2026-06-18')?.toISOString()).toBe('2026-06-18T00:00:00.000Z');
    expect(parseFlexDate('2026-06-18T15:30:00Z')?.toISOString()).toBe('2026-06-18T00:00:00.000Z');
  });
  it('rejects impossible or unknown dates', () => {
    expect(parseFlexDate('2026-02-30')).toBeNull();
    expect(parseFlexDate('Foo 1, 2026')).toBeNull();
    expect(parseFlexDate('yesterday')).toBeNull();
  });
});

describe('parseTxFilter', () => {
  it('keeps valid filters and ignores junk type/limit', () => {
    const f = parseTxFilter(new URLSearchParams('type=income&category=food&account=Cash&from=2026-06-01&limit=5'));
    expect(f).toEqual({ type: 'income', category: 'food', account: 'Cash', from: day('2026-06-01'), limit: 5 });
    expect(parseTxFilter(new URLSearchParams('type=bogus&limit=abc'))).toEqual({});
  });
  it('caps limit at 500', () => {
    expect(parseTxFilter(new URLSearchParams('limit=100000')).limit).toBe(500);
  });
  it('rejects an invalid date with a 400', () => {
    expect(() => parseTxFilter(new URLSearchParams('to=2026-13-01'))).toThrow(HttpError);
  });
});
```

`tests/unit/debt-logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyPayment, buildSchedule, parseStrategy, sortByStrategy } from '@/server/debt/logic';
import { toDebtView } from '@/server/views';
import { debt } from '../fixtures';

describe('buildSchedule', () => {
  it('charges interest on the reducing balance', () => {
    const s = buildSchedule(debt({ original: 70000, paid: 24300, apr: 25, monthly: 2783, calc: 'reducing' }));
    expect(s.schedule[0]).toEqual({ month: 1, payment: 2783, principal: 1831, interest: 952, balance: 43869 });
    expect(s.schedule.at(-1)?.balance).toBe(0);
    expect(s.months).toBe(s.schedule.length);
    expect(s.totalInterest).toBe(s.schedule.reduce((a, r) => a + r.interest, 0));
  });
  it('charges no interest on a 0% flat loan and shortens the final payment', () => {
    const s = buildSchedule(debt({ original: 186650, paid: 8275, apr: 0, monthly: 3889, calc: 'flat' }));
    expect(s.months).toBe(46);
    expect(s.totalInterest).toBe(0);
    expect(s.schedule.at(-1)).toEqual({ month: 46, payment: 3370, principal: 3370, interest: 0, balance: 0 });
  });
  it('returns an empty schedule for a paid-off or payment-less debt', () => {
    expect(buildSchedule(debt({ original: 100, paid: 100 })).months).toBe(0);
    expect(buildSchedule(debt({ monthly: 0 })).months).toBe(0);
  });
});

describe('applyPayment', () => {
  it('defaults to the monthly minimum and decrements months left', () => {
    const d = applyPayment(debt({ original: 9593, paid: 5300, monthly: 1607, monthsLeft: 3 }), 0);
    expect(d).toMatchObject({ paid: 6907, monthsLeft: 2, done: false });
  });
  it('caps an overpayment at the original and closes the debt', () => {
    const d = applyPayment(debt({ original: 9593, paid: 5300, monthsLeft: 3 }), 999999);
    expect(d).toMatchObject({ paid: 9593, done: true, monthsLeft: 0 });
  });
});

describe('sortByStrategy', () => {
  const views = [
    debt({ id: 1, apr: 0, original: 1000, paid: 0, sort: 1 }),
    debt({ id: 2, apr: 33, original: 5000, paid: 0, sort: 2 }),
    debt({ id: 3, apr: 25, original: 300, paid: 0, sort: 3 }),
  ].map(toDebtView);
  it('avalanche = highest APR first', () => expect(sortByStrategy(views, 'avalanche').map((d) => d.id)).toEqual([2, 3, 1]));
  it('snowball = smallest balance first', () => expect(sortByStrategy(views, 'snowball').map((d) => d.id)).toEqual([3, 1, 2]));
  it('custom = configured order', () => expect(sortByStrategy(views, 'custom').map((d) => d.id)).toEqual([1, 2, 3]));
  it('does not mutate its input', () => {
    sortByStrategy(views, 'avalanche');
    expect(views.map((d) => d.id)).toEqual([1, 2, 3]);
  });
  it('parseStrategy falls back to avalanche', () => {
    expect(parseStrategy('snowball')).toBe('snowball');
    expect(parseStrategy('nope')).toBe('avalanche');
    expect(parseStrategy(undefined)).toBe('avalanche');
  });
});
```

`tests/unit/bill-logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyPaid, buildBillSummary } from '@/server/bill/logic';
import { bill } from '../fixtures';

describe('buildBillSummary', () => {
  it('totals paid vs remaining and picks the first unpaid as next', () => {
    const bills = [
      bill({ id: 1, amount: 149, dueDay: 1, paid: true }),
      bill({ id: 2, amount: 2500, dueDay: 16 }),
      bill({ id: 3, amount: 180, dueDay: 20 }),
    ];
    const s = buildBillSummary(bills, [], 18, '2026-06');
    expect(s).toMatchObject({ total: 2829, paid: 149, remaining: 2680, count: 3, month: '2026-06', today: 18 });
    expect(s.nextBill).toMatchObject({ id: 2, status: 'overdue', daysDiff: -2 });
  });
  it('has no next bill when everything is paid', () => {
    expect(buildBillSummary([bill({ paid: true })], [], 18, '2026-06').nextBill).toBeNull();
  });
});

describe('applyPaid', () => {
  it('toggles when no value is given and sets when one is', () => {
    expect(applyPaid(bill({ paid: false }), undefined).paid).toBe(true);
    expect(applyPaid(bill({ paid: true }), undefined).paid).toBe(false);
    expect(applyPaid(bill({ paid: true }), true).paid).toBe(true);
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `pnpm test:unit`
Expected: FAIL, modules `@/server/views`, `@/server/transaction/logic`, `@/server/debt/logic`, `@/server/bill/logic` not found.

- [ ] **Step 4: Implement**

`src/server/errors.ts`:

```ts
/** An error that maps directly to an HTTP status in route handlers. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (): HttpError => new HttpError(404, 'resource not found');
export const badRequest = (message: string): HttpError => new HttpError(400, message);
```

`src/server/views.ts`:

```ts
// Derived read shapes rendered by more than one feature (port of api/internal/shared/view).
import type { Bill, Debt } from '@/generated/prisma/client';

export interface DebtView extends Debt {
  remaining: number;
  /** 0..1, paid / original */
  progress: number;
}

export function toDebtView(d: Debt): DebtView {
  return {
    ...d,
    remaining: Math.max(0, d.original - d.paid),
    progress: d.original > 0 ? d.paid / d.original : 0,
  };
}

export type BillStatus = 'paid' | 'overdue' | 'dueToday' | 'dueSoon' | 'upcoming';

export interface BillView extends Bill {
  status: BillStatus;
  /** dueDay - today (negative = late) */
  daysDiff: number;
}

export function toBillView(b: Bill, todayDay: number): BillView {
  const daysDiff = b.dueDay - todayDay;
  let status: BillStatus = 'upcoming';
  if (b.paid) status = 'paid';
  else if (daysDiff < 0) status = 'overdue';
  else if (daysDiff === 0) status = 'dueToday';
  else if (daysDiff <= 5) status = 'dueSoon';
  return { ...b, status, daysDiff };
}
```

`src/server/transaction/logic.ts`:

```ts
// Pure transaction logic: read view, date-relative group label, date parsing, list filter.
import type { Transaction } from '@/generated/prisma/client';
import { badRequest } from '@/server/errors';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface TxView {
  id: number;
  name: string;
  cat: string;
  acct: string;
  amount: number;
  note: string;
  /** "Jun 18, 2026" */
  date: string;
  /** "Today" | "Yesterday" | "Jun 15" */
  group: string;
}

export function formatLongDate(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

export function groupLabel(date: Date, today: Date): string {
  if (sameDay(date, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function toTxView(t: Transaction, today: Date): TxView {
  return {
    id: t.id, name: t.name, cat: t.cat, acct: t.acct, amount: t.amount, note: t.note,
    date: formatLongDate(t.date), group: groupLabel(t.date, today),
  };
}

function utcDate(y: number, m: number, d: number): Date | null {
  if (m < 0 || m > 11) return null;
  const out = new Date(Date.UTC(y, m, d));
  return out.getUTCMonth() === m && out.getUTCDate() === d ? out : null;
}

/** Parses "Jun 18, 2026", "2026-06-18" or an RFC 3339 timestamp to a UTC calendar date; null if invalid. */
export function parseFlexDate(raw: string): Date | null {
  const s = raw.trim();
  const long = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(s);
  if (long) return utcDate(Number(long[3]), MONTHS.indexOf(long[1]), Number(long[2]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return utcDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = new Date(s);
    if (!Number.isNaN(t.getTime())) return utcDate(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  }
  return null;
}

export interface TxFilter {
  type?: 'income' | 'expense';
  category?: string;
  account?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

/** Reads list filters from a query string. Unknown type / bad limit are ignored; bad dates are a 400. */
export function parseTxFilter(params: URLSearchParams): TxFilter {
  const f: TxFilter = {};
  const type = params.get('type');
  if (type === 'income' || type === 'expense') f.type = type;
  const category = params.get('category');
  if (category) f.category = category;
  const account = params.get('account');
  if (account) f.account = account;
  for (const key of ['from', 'to'] as const) {
    const raw = params.get(key);
    if (!raw) continue;
    const parsed = parseFlexDate(raw);
    if (!parsed) throw badRequest(`invalid ${key} date: ${raw}`);
    f[key] = parsed;
  }
  const limit = Number(params.get('limit'));
  if (Number.isInteger(limit) && limit > 0) f.limit = Math.min(limit, 500);
  return f;
}
```

`src/server/debt/logic.ts`:

```ts
// Pure debt logic: amortization schedule, payment transition, payoff ordering.
import type { Debt } from '@/generated/prisma/client';
import { toDebtView, type DebtView } from '@/server/views';

export interface ScheduleRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface ScheduleView {
  debt: DebtView;
  schedule: ScheduleRow[];
  totalInterest: number;
  months: number;
}

/** Month-by-month payoff at the debt's monthly payment (reducing = interest on balance; flat = none). */
export function buildSchedule(d: Debt): ScheduleView {
  let balance = d.original - d.paid;
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;
  for (let month = 1; balance > 0 && month <= 600 && d.monthly > 0; month++) {
    const interest = d.calc === 'reducing' && d.apr > 0 ? Math.round((balance * d.apr) / 100 / 12) : 0;
    let principal = d.monthly - interest;
    if (principal <= 0) principal = d.monthly; // APR alone exceeds the payment: still chip away (Go parity)
    principal = Math.min(principal, balance);
    balance -= principal;
    totalInterest += interest;
    rows.push({ month, payment: principal + interest, principal, interest, balance });
  }
  return { debt: toDebtView(d), schedule: rows, totalInterest, months: rows.length };
}

/** Applies a payment; amount <= 0 means "the monthly minimum". Closes the debt when fully repaid. */
export function applyPayment(d: Debt, amount: number): Debt {
  const pay = amount > 0 ? amount : d.monthly;
  const paid = d.paid + pay;
  if (paid >= d.original) return { ...d, paid: d.original, done: true, monthsLeft: 0 };
  return { ...d, paid, monthsLeft: Math.max(0, d.monthsLeft - 1) };
}

export type Strategy = 'avalanche' | 'snowball' | 'custom';

export function parseStrategy(v: string | undefined): Strategy {
  return v === 'snowball' || v === 'custom' ? v : 'avalanche';
}

export function sortByStrategy(debts: DebtView[], strategy: Strategy): DebtView[] {
  const list = [...debts];
  if (strategy === 'avalanche') return list.sort((a, b) => b.apr - a.apr);
  if (strategy === 'snowball') return list.sort((a, b) => a.remaining - b.remaining);
  return list.sort((a, b) => a.sort - b.sort);
}
```

`src/server/bill/logic.ts`:

```ts
// Pure bill logic: month summary and the paid-flag transition.
import type { Bill, DaySpend } from '@/generated/prisma/client';
import { toBillView, type BillView } from '@/server/views';

export interface BillSummary {
  total: number;
  paid: number;
  remaining: number;
  count: number;
  month: string;
  today: number;
  nextBill: BillView | null;
  daySpend: DaySpend[];
}

/** Bills must be ordered by due day; the first unpaid one is "next". */
export function buildBillSummary(bills: Bill[], daySpend: DaySpend[], todayDay: number, month: string): BillSummary {
  let total = 0;
  let paid = 0;
  let nextBill: BillView | null = null;
  for (const b of bills) {
    total += b.amount;
    if (b.paid) paid += b.amount;
    else nextBill ??= toBillView(b, todayDay);
  }
  return { total, paid, remaining: total - paid, count: bills.length, month, today: todayDay, nextBill, daySpend };
}

/** undefined toggles the flag; a boolean sets it. */
export function applyPaid(b: Bill, paid: boolean | undefined): Bill {
  return { ...b, paid: paid ?? !b.paid };
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): port pure view, transaction, debt and bill logic"
```

---

### Task 5: Pure logic — plan, analytics, setup

**Files:**
- Create: `src/server/plan/logic.ts`, `src/server/analytics/logic.ts`, `src/server/setup/logic.ts`
- Test: `tests/unit/plan-logic.test.ts`, `tests/unit/analytics-logic.test.ts`, `tests/unit/setup-logic.test.ts`

**Interfaces:**
- Consumes: `DebtView`, `toBillView`, `BillView` (Task 4); fixtures (Task 4).
- Produces:
  - `PlanGroup { type; items: PlanItem[]; totalPlanned; totalActual; variance }`, `PlanSummary { plannedNet; actualNet; netVariance; incomeRatio; expenseUsage; savingsRatio }` (ratios are 0..100), `PlanView { income; expense; savings; summary }`, `buildPlan(items)`, `SnapshotGroup { group; items; prev; curr }`, `SnapshotsView { groups; prev; curr; delta; history; labels: { prev; curr; prevTh; currTh; lastUpdate } }`, `buildSnapshots(snaps, history)` from `@/server/plan/logic`.
  - `CategorySpend { cat; label; th; tint; icon; spent; pct }` (pct 0..100), `Merchant { name; cat; total }`, `spendingByCategory(budgets, cats): { items: CategorySpend[]; total: number }`, `netWorthTotals(assets, activeDebts: DebtView[]): { totalAssets; totalLiab; netWorth }`, `topMerchants(expenseTx): Merchant[]`, `DashboardInput`, `DashboardView`, `buildDashboard(input)`, `NetWorthView`, `buildNetWorth({ assets, activeDebts, history })`, `ReportsView`, `buildReports({ budgets, categories, expenseTx, monthly })` from `@/server/analytics/logic`.
  - `type SetupGoalRow = Prisma.SetupGoalGetPayload<{ include: { channels: true } }>`, `SetupView`, `buildSetup(input: SetupInput): SetupView` from `@/server/setup/logic`. **Builders take `DebtView[]`, not raw debts**, so a later change to how views are derived only touches the services.

- [ ] **Step 1: Write the failing tests**

`tests/unit/plan-logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPlan, buildSnapshots } from '@/server/plan/logic';
import { nwPoint, planItem, snapshot } from '../fixtures';

describe('buildPlan', () => {
  const items = [
    planItem({ id: 1, type: 'income', planned: 60000, actual: 62000 }),
    planItem({ id: 2, type: 'income', planned: 5000, actual: 3200 }),
    planItem({ id: 3, type: 'expense', planned: 5000, actual: 6500 }),
    planItem({ id: 4, type: 'savings', planned: 8000, actual: 8000 }),
    planItem({ id: 5, type: 'unknown', planned: 999, actual: 999 }),
  ];
  const plan = buildPlan(items);
  it('partitions and totals each group', () => {
    expect(plan.income).toMatchObject({ type: 'income', totalPlanned: 65000, totalActual: 65200, variance: 200 });
    expect(plan.income.items.map((i) => i.id)).toEqual([1, 2]);
    expect(plan.expense).toMatchObject({ totalPlanned: 5000, totalActual: 6500, variance: 1500 });
  });
  it('rolls up net and ratios, ignoring unknown types', () => {
    expect(plan.summary).toMatchObject({ plannedNet: 52000, actualNet: 50700, netVariance: -1300, expenseUsage: 130, savingsRatio: 100 });
    expect(plan.summary.incomeRatio).toBeCloseTo(100.3077, 3);
  });
  it('reports 0% when nothing is planned', () => {
    expect(buildPlan([]).summary.incomeRatio).toBe(0);
  });
});

describe('buildSnapshots', () => {
  it('groups in first-seen order with per-group and overall totals', () => {
    const v = buildSnapshots(
      [
        snapshot({ id: 1, group: 'bank', prev: 100, curr: 150 }),
        snapshot({ id: 2, group: 'invest', prev: 300, curr: 250 }),
        snapshot({ id: 3, group: 'bank', prev: 10, curr: 20 }),
      ],
      [nwPoint({ value: 5 })],
    );
    expect(v.groups.map((g) => [g.group, g.prev, g.curr])).toEqual([['bank', 110, 170], ['invest', 300, 250]]);
    expect(v).toMatchObject({ prev: 410, curr: 420, delta: 10 });
    expect(v.history).toHaveLength(1);
    expect(v.labels).toEqual({ prev: 'May 2026', curr: 'Jun 2026', prevTh: 'พ.ค. 2026', currTh: 'มิ.ย. 2026', lastUpdate: 'May 31, 2026' });
  });
});
```

`tests/unit/analytics-logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildDashboard, buildNetWorth, buildReports, netWorthTotals, spendingByCategory, topMerchants } from '@/server/analytics/logic';
import { toDebtView } from '@/server/views';
import { asset, bill, budget, cashflow, category, debt, goal, nwPoint, tx } from '../fixtures';

const cats = [category({ key: 'food', label: 'Food', tint: 'folder' }), category({ id: 2, key: 'fun', label: 'Fun', tint: 'video' })];
const budgets = [budget({ cat: 'food', spent: 750 }), budget({ id: 2, cat: 'fun', spent: 250 }), budget({ id: 3, cat: 'ghost', spent: 0 })];
const active = [
  toDebtView(debt({ id: 1, original: 1000, paid: 400, apr: 0 })),
  toDebtView(debt({ id: 2, original: 500, paid: 100, apr: 33 })),
  toDebtView(debt({ id: 3, original: 300, paid: 0, apr: 33 })),
];

describe('spendingByCategory', () => {
  it('joins budget spend to category metadata with percentages', () => {
    const { items, total } = spendingByCategory(budgets, cats);
    expect(total).toBe(1000);
    expect(items[0]).toMatchObject({ cat: 'food', label: 'Food', tint: 'folder', spent: 750, pct: 75 });
    expect(items[2]).toMatchObject({ cat: 'ghost', label: '', pct: 0 });
  });
  it('returns 0% everywhere when nothing was spent', () => {
    expect(spendingByCategory([budget({ spent: 0 })], cats).items[0].pct).toBe(0);
  });
});

describe('netWorthTotals', () => {
  it('subtracts remaining active debt from assets', () => {
    expect(netWorthTotals([asset({ value: 2000 }), asset({ id: 2, value: 500 })], active)).toEqual({ totalAssets: 2500, totalLiab: 1300, netWorth: 1200 });
  });
});

describe('topMerchants', () => {
  it('sums expenses per merchant and keeps the top six', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name, i) => tx({ id: i + 1, name, amount: -(i + 1) * 100 }));
    rows.push(tx({ id: 99, name: 'A', amount: -1000 }));
    const top = topMerchants(rows);
    expect(top).toHaveLength(6);
    expect(top[0]).toEqual({ name: 'A', cat: 'food', total: 1100 });
    expect(top.map((m) => m.name)).not.toContain('B');
  });
});

describe('buildDashboard', () => {
  const view = buildDashboard({
    assets: [asset({ value: 2000 })],
    activeDebts: active,
    budgets,
    categories: cats,
    cashflow: [cashflow({ income: 1, expense: 1 }), cashflow({ id: 2, income: 62000, expense: 17700 })],
    unpaidBills: [bill({ id: 6, dueDay: 16 }), bill({ id: 7, dueDay: 20 })],
    goals: [goal()],
    netWorthHist: [nwPoint()],
    todayDay: 18,
  });
  it('uses the latest cashflow month', () => expect(view.month).toEqual({ income: 62000, expense: 17700, net: 44300 }));
  it('rolls up debt and focuses the first highest-APR debt', () => {
    expect(view.debt).toMatchObject({ original: 1800, paid: 500, remaining: 1300 });
    expect(view.debt.progress).toBeCloseTo(500 / 1800);
    expect(view.debt.focus?.id).toBe(2);
  });
  it('surfaces the first unpaid bill with status', () => expect(view.nextBill).toMatchObject({ id: 6, status: 'overdue' }));
  it('handles empty inputs', () => {
    const empty = buildDashboard({ assets: [], activeDebts: [], budgets: [], categories: [], cashflow: [], unpaidBills: [], goals: [], netWorthHist: [], todayDay: 18 });
    expect(empty).toMatchObject({ netWorth: 0, month: { income: 0, expense: 0, net: 0 }, nextBill: null, debt: { progress: 0, focus: null } });
  });
});

describe('buildNetWorth / buildReports', () => {
  it('sorts liabilities by remaining, largest first', () => {
    const v = buildNetWorth({ assets: [], activeDebts: active, history: [] });
    expect(v.liabilities.map((d) => d.id)).toEqual([1, 2, 3]);
    expect(v.totalLiab).toBe(1300);
  });
  it('assembles the reports view', () => {
    const r = buildReports({ budgets, categories: cats, expenseTx: [tx()], monthly: [cashflow()] });
    expect(r.spendTotal).toBe(1000);
    expect(r.topMerchants).toEqual([{ name: 'Coffee', cat: 'food', total: 100 }]);
    expect(r.monthly).toHaveLength(1);
  });
});
```

`tests/unit/setup-logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSetup } from '@/server/setup/logic';
import { toDebtView } from '@/server/views';
import { category, debt, setupGoal } from '../fixtures';

describe('buildSetup', () => {
  const v = buildSetup({
    categories: [category({ id: 1, type: 'expense' }), category({ id: 2, key: 'income', type: 'income' })],
    incomeSources: [],
    channels: [],
    accounts: [],
    activeDebts: [toDebtView(debt({ id: 1 })), toDebtView(debt({ id: 2, revolving: true }))],
    setupGoals: [setupGoal({ id: 1, kind: 'emergency' }), setupGoal({ id: 2, kind: 'custom' }), setupGoal({ id: 3, kind: 'custom' })],
  });
  it('splits categories by type', () => {
    expect(v.incomeCategories.map((c) => c.id)).toEqual([2]);
    expect(v.expenseCategories.map((c) => c.id)).toEqual([1]);
  });
  it('splits debts into closing and revolving', () => {
    expect(v.debts.closing.map((d) => d.id)).toEqual([1]);
    expect(v.debts.revolving.map((d) => d.id)).toEqual([2]);
  });
  it('picks the fixed goal kinds and lists custom ones; missing kinds are null', () => {
    expect(v.goals.emergency?.id).toBe(1);
    expect(v.goals.stocks).toBeNull();
    expect(v.goals.retirement).toBeNull();
    expect(v.goals.custom.map((g) => g.id)).toEqual([2, 3]);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test:unit`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/server/plan/logic.ts`:

```ts
// Pure plan logic: plan-vs-actual tables and the mark-to-market asset view.
import type { AssetSnapshot, NetWorthHistory, PlanItem } from '@/generated/prisma/client';

export interface PlanGroup {
  type: string;
  items: PlanItem[];
  totalPlanned: number;
  totalActual: number;
  variance: number;
}

export interface PlanSummary {
  plannedNet: number;
  actualNet: number;
  netVariance: number;
  /** percentages, 0..100+ */
  incomeRatio: number;
  expenseUsage: number;
  savingsRatio: number;
}

export interface PlanView {
  income: PlanGroup;
  expense: PlanGroup;
  savings: PlanGroup;
  summary: PlanSummary;
}

function buildGroup(type: string, items: PlanItem[]): PlanGroup {
  const groupItems = items.filter((i) => i.type === type);
  const totalPlanned = groupItems.reduce((s, i) => s + i.planned, 0);
  const totalActual = groupItems.reduce((s, i) => s + i.actual, 0);
  return { type, items: groupItems, totalPlanned, totalActual, variance: totalActual - totalPlanned };
}

const ratio = (actual: number, planned: number): number => (planned === 0 ? 0 : (actual / planned) * 100);

export function buildPlan(items: PlanItem[]): PlanView {
  const income = buildGroup('income', items);
  const expense = buildGroup('expense', items);
  const savings = buildGroup('savings', items);
  const plannedNet = income.totalPlanned - expense.totalPlanned - savings.totalPlanned;
  const actualNet = income.totalActual - expense.totalActual - savings.totalActual;
  return {
    income, expense, savings,
    summary: {
      plannedNet, actualNet, netVariance: actualNet - plannedNet,
      incomeRatio: ratio(income.totalActual, income.totalPlanned),
      expenseUsage: ratio(expense.totalActual, expense.totalPlanned),
      savingsRatio: ratio(savings.totalActual, savings.totalPlanned),
    },
  };
}

export interface SnapshotGroup {
  group: string;
  items: AssetSnapshot[];
  prev: number;
  curr: number;
}

export interface SnapshotsView {
  groups: SnapshotGroup[];
  prev: number;
  curr: number;
  delta: number;
  history: NetWorthHistory[];
  labels: { prev: string; curr: string; prevTh: string; currTh: string; lastUpdate: string };
}

export function buildSnapshots(snaps: AssetSnapshot[], history: NetWorthHistory[]): SnapshotsView {
  const byGroup = new Map<string, SnapshotGroup>();
  for (const s of snaps) {
    const g = byGroup.get(s.group) ?? { group: s.group, items: [], prev: 0, curr: 0 };
    g.items.push(s);
    g.prev += s.prev;
    g.curr += s.curr;
    byGroup.set(s.group, g);
  }
  const groups = [...byGroup.values()];
  const prev = groups.reduce((s, g) => s + g.prev, 0);
  const curr = groups.reduce((s, g) => s + g.curr, 0);
  return {
    groups, prev, curr, delta: curr - prev, history,
    labels: { prev: 'May 2026', curr: 'Jun 2026', prevTh: 'พ.ค. 2026', currTh: 'มิ.ย. 2026', lastUpdate: 'May 31, 2026' },
  };
}
```

`src/server/analytics/logic.ts`:

```ts
// Pure analytics: spending breakdown, net worth, debt roll-up, merchants, screen views.
import type { Asset, Bill, Budget, Category, Goal, MonthlyCashflow, NetWorthHistory, Transaction } from '@/generated/prisma/client';
import { toBillView, type BillView, type DebtView } from '@/server/views';

export interface CategorySpend {
  cat: string;
  label: string;
  th: string;
  tint: string;
  icon: string;
  spent: number;
  /** share of total, 0..100 */
  pct: number;
}

export interface Merchant {
  name: string;
  cat: string;
  total: number;
}

/** Budget order is preserved (callers pass budgets sorted by spend, high to low). */
export function spendingByCategory(budgets: Budget[], cats: Category[]): { items: CategorySpend[]; total: number } {
  const byKey = new Map(cats.map((c) => [c.key, c]));
  const total = budgets.reduce((s, b) => s + b.spent, 0);
  const items = budgets.map((b) => {
    const c = byKey.get(b.cat);
    return {
      cat: b.cat, label: c?.label ?? '', th: c?.th ?? '', tint: c?.tint ?? '', icon: c?.icon ?? '',
      spent: b.spent, pct: total > 0 ? (b.spent / total) * 100 : 0,
    };
  });
  return { items, total };
}

export function netWorthTotals(assets: Asset[], activeDebts: DebtView[]): { totalAssets: number; totalLiab: number; netWorth: number } {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiab = activeDebts.reduce((s, d) => s + d.remaining, 0);
  return { totalAssets, totalLiab, netWorth: totalAssets - totalLiab };
}

export function topMerchants(expenseTx: Transaction[]): Merchant[] {
  const byName = new Map<string, Merchant>();
  for (const t of expenseTx) {
    const m = byName.get(t.name) ?? { name: t.name, cat: t.cat, total: 0 };
    m.total += -t.amount;
    m.cat = t.cat;
    byName.set(t.name, m);
  }
  return [...byName.values()].sort((a, b) => b.total - a.total).slice(0, 6);
}

export interface DebtSummary {
  original: number;
  paid: number;
  remaining: number;
  progress: number;
  /** highest-APR active debt (avalanche default) */
  focus: DebtView | null;
}

function debtRollup(activeDebts: DebtView[]): DebtSummary {
  let original = 0;
  let paid = 0;
  let remaining = 0;
  let focus: DebtView | null = null;
  for (const d of activeDebts) {
    original += d.original;
    paid += d.paid;
    remaining += d.original - d.paid;
    if (!focus || d.apr > focus.apr) focus = d;
  }
  return { original, paid, remaining, progress: original > 0 ? paid / original : 0, focus };
}

export interface DashboardInput {
  assets: Asset[];
  activeDebts: DebtView[];
  budgets: Budget[];
  categories: Category[];
  cashflow: MonthlyCashflow[];
  unpaidBills: Bill[];
  goals: Goal[];
  netWorthHist: NetWorthHistory[];
  todayDay: number;
}

export interface DashboardView {
  netWorth: number;
  totalAssets: number;
  totalLiab: number;
  month: { income: number; expense: number; net: number };
  cashflow: MonthlyCashflow[];
  spending: CategorySpend[];
  spendTotal: number;
  debt: DebtSummary;
  nextBill: BillView | null;
  goals: Goal[];
  netWorthHist: NetWorthHistory[];
}

export function buildDashboard(input: DashboardInput): DashboardView {
  const totals = netWorthTotals(input.assets, input.activeDebts);
  const last = input.cashflow.at(-1);
  const income = last?.income ?? 0;
  const expense = last?.expense ?? 0;
  const { items, total } = spendingByCategory(input.budgets, input.categories);
  const first = input.unpaidBills[0];
  return {
    ...totals,
    month: { income, expense, net: income - expense },
    cashflow: input.cashflow,
    spending: items,
    spendTotal: total,
    debt: debtRollup(input.activeDebts),
    nextBill: first ? toBillView(first, input.todayDay) : null,
    goals: input.goals,
    netWorthHist: input.netWorthHist,
  };
}

export interface NetWorthView {
  netWorth: number;
  totalAssets: number;
  totalLiab: number;
  assets: Asset[];
  liabilities: DebtView[];
  history: NetWorthHistory[];
}

export function buildNetWorth(input: { assets: Asset[]; activeDebts: DebtView[]; history: NetWorthHistory[] }): NetWorthView {
  return {
    ...netWorthTotals(input.assets, input.activeDebts),
    assets: input.assets,
    liabilities: [...input.activeDebts].sort((a, b) => b.remaining - a.remaining),
    history: input.history,
  };
}

export interface ReportsView {
  breakdown: CategorySpend[];
  spendTotal: number;
  topMerchants: Merchant[];
  monthly: MonthlyCashflow[];
}

export function buildReports(input: { budgets: Budget[]; categories: Category[]; expenseTx: Transaction[]; monthly: MonthlyCashflow[] }): ReportsView {
  const { items, total } = spendingByCategory(input.budgets, input.categories);
  return { breakdown: items, spendTotal: total, topMerchants: topMerchants(input.expenseTx), monthly: input.monthly };
}
```

`src/server/setup/logic.ts`:

```ts
// Pure setup read model: partitions configured rows into the Financial Setup shape.
import type { Account, Category, Channel, IncomeCategory, Prisma } from '@/generated/prisma/client';
import type { DebtView } from '@/server/views';

export type SetupGoalRow = Prisma.SetupGoalGetPayload<{ include: { channels: true } }>;

export interface SetupInput {
  categories: Category[];
  incomeSources: IncomeCategory[];
  channels: Channel[];
  accounts: Account[];
  activeDebts: DebtView[];
  setupGoals: SetupGoalRow[];
}

export interface SetupView {
  incomeCategories: Category[];
  expenseCategories: Category[];
  incomeSources: IncomeCategory[];
  channels: Channel[];
  accounts: Account[];
  debts: { closing: DebtView[]; revolving: DebtView[] };
  goals: { emergency: SetupGoalRow | null; stocks: SetupGoalRow | null; retirement: SetupGoalRow | null; custom: SetupGoalRow[] };
}

export function buildSetup(input: SetupInput): SetupView {
  const kind = (k: string): SetupGoalRow | null => input.setupGoals.find((g) => g.kind === k) ?? null;
  return {
    incomeCategories: input.categories.filter((c) => c.type === 'income'),
    expenseCategories: input.categories.filter((c) => c.type !== 'income'),
    incomeSources: input.incomeSources,
    channels: input.channels,
    accounts: input.accounts,
    debts: {
      closing: input.activeDebts.filter((d) => !d.revolving),
      revolving: input.activeDebts.filter((d) => d.revolving),
    },
    goals: {
      emergency: kind('emergency'),
      stocks: kind('stocks'),
      retirement: kind('retirement'),
      custom: input.setupGoals.filter((g) => g.kind === 'custom'),
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): port pure plan, analytics and setup logic"
```

---

### Task 6: HTTP plumbing + generic reference CRUD API

**Files:**
- Create: `src/server/validate.ts`, `src/server/http.ts`, `src/server/reference/resources.ts`, `src/server/reference/service.ts`
- Create: `src/app/api/v1/[resource]/route.ts`, `src/app/api/v1/[resource]/[id]/route.ts`, `src/app/api/health/route.ts`
- Create: `tests/api/helpers.ts`
- Test: `tests/api/reference.test.ts`

**Interfaces:**
- Consumes: `HttpError`, `notFound`, `badRequest` (Task 4); `prisma` (Task 2); `seedDatabase` (Task 3).
- Produces:
  - `parseBody<T>(schema: z.ZodType<T>, data: unknown): T` (throws 400) from `@/server/validate`.
  - `route(fn)` (wraps a handler and maps `HttpError` → status, Prisma P2025 → 404, P2002 → 409, anything else → 500), `readJson(req, { optional? }): Promise<unknown>`, `parseId(raw: string): number`, `ok(v)`, `created(v)`, `list(rows)`, `noContent()` from `@/server/http`.
  - `type ResourceName = 'accounts'|'categories'|'budgets'|'goals'|'assets'|'channels'|'income-categories'`, `isResourceName(v)`, `RESOURCE_SCHEMAS`, `interface ResourceRows` from `@/server/reference/resources`.
  - `listResource(name)`, `getResource(name, id)`, `createResource(name, body: unknown)`, `updateResource(name, id, body: unknown)`, `deleteResource(name, id)` from `@/server/reference/service`. `listResource('categories')` returns `Category[]` sorted by `sort`.
  - Test helpers `call(handler, { method?, url?, body?, params? })` → `{ status, json }` and `resetDb()` from `tests/api/helpers.ts`.

- [ ] **Step 1: Write the test helpers and failing tests**

`tests/api/helpers.ts`:

```ts
import { prisma } from '@/lib/db';
import { seedDatabase } from '../../prisma/seed-lib';

export const resetDb = (): Promise<void> => seedDatabase(prisma);

type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

/** Invokes a route handler directly. `body` is JSON-encoded unless it is already a string. */
export async function call<P = Record<string, string>>(
  handler: Handler<P>,
  opts: { method?: string; url?: string; body?: unknown; params?: P } = {},
): Promise<{ status: number; json: any }> {
  const init: RequestInit = { method: opts.method ?? 'GET' };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  const res = await handler(new Request(`http://test${opts.url ?? '/'}`, init), { params: Promise.resolve((opts.params ?? {}) as P) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
```

(`any` in the helper's return type is deliberate: tests assert on arbitrary JSON.)

`tests/api/reference.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/[resource]/route';
import * as item from '@/app/api/v1/[resource]/[id]/route';
import { GET as health } from '@/app/api/health/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('GET /api/v1/:resource', () => {
  it('lists rows in sort order inside a data envelope', async () => {
    const { status, json } = await call(collection.GET, { params: { resource: 'categories' } });
    expect(status).toBe(200);
    expect(json.data).toHaveLength(7);
    expect(json.data[0]).toMatchObject({ id: 1, key: 'food', label: 'Food & Dining' });
  });
  it('404s an unknown resource', async () => {
    expect((await call(collection.GET, { params: { resource: 'secrets' } })).status).toBe(404);
  });
});

describe('POST /api/v1/:resource', () => {
  it('creates with defaults and returns 201', async () => {
    const { status, json } = await call(collection.POST, { method: 'POST', params: { resource: 'goals' }, body: { name: 'Car', target: 300000 } });
    expect(status).toBe(201);
    expect(json).toMatchObject({ id: 4, name: 'Car', target: 300000, saved: 0, icon: 'target' });
  });
  it('rejects an empty body, invalid JSON and schema violations with 400', async () => {
    const base = { method: 'POST', params: { resource: 'goals' } };
    expect((await call(collection.POST, { ...base, body: '' })).status).toBe(400);
    expect((await call(collection.POST, { ...base, body: '{nope' })).status).toBe(400);
    const bad = await call(collection.POST, { ...base, body: { name: '', target: 'lots' } });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/name|target/);
  });
  it('409s a duplicate category key', async () => {
    const r = await call(collection.POST, { method: 'POST', params: { resource: 'categories' }, body: { key: 'food', label: 'Dup' } });
    expect(r.status).toBe(409);
  });
});

describe('/api/v1/:resource/:id', () => {
  it('gets, patches (keeping omitted fields) and deletes', async () => {
    const params = { resource: 'accounts', id: '3' };
    expect((await call(item.GET, { params })).json).toMatchObject({ name: 'Cash Wallet', balance: 3200 });
    const patched = await call(item.PATCH, { method: 'PATCH', params, body: { balance: 0 } });
    expect(patched.json).toMatchObject({ name: 'Cash Wallet', balance: 0 });
    expect((await call(item.DELETE, { method: 'DELETE', params })).status).toBe(204);
    expect((await call(item.GET, { params })).status).toBe(404);
  });
  it('400s a non-numeric id and 404s a missing one on every verb', async () => {
    for (const handler of [item.GET, item.PUT, item.PATCH, item.DELETE]) {
      expect((await call(handler, { method: 'PUT', params: { resource: 'assets', id: 'abc' }, body: {} })).status).toBe(400);
      expect((await call(handler, { method: 'PUT', params: { resource: 'assets', id: '9999' }, body: {} })).status).toBe(404);
    }
  });
});

describe('GET /api/health', () => {
  it('reports ok', async () => {
    expect((await call(health)).json).toEqual({ status: 'ok', service: 'cashflowkub' });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test:api tests/api/reference.test.ts`
Expected: FAIL, route modules not found.

- [ ] **Step 3: Implement the plumbing**

`src/server/validate.ts`:

```ts
import { z } from 'zod';
import { badRequest } from '@/server/errors';

/** Validates untrusted input; a failure becomes a 400 with zod's readable message. */
export function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw badRequest(z.prettifyError(result.error));
  return result.data;
}
```

`src/server/http.ts`:

```ts
// Route-handler helpers: error mapping, body/id parsing, response envelopes.
import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { badRequest, HttpError } from '@/server/errors';

export const ok = (value: unknown): Response => NextResponse.json(value);
export const created = (value: unknown): Response => NextResponse.json(value, { status: 201 });
export const list = (rows: unknown[]): Response => NextResponse.json({ data: rows });
export const noContent = (): Response => new Response(null, { status: 204 });

function toErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'resource not found' }, { status: 404 });
    if (err.code === 'P2002') return NextResponse.json({ error: 'resource already exists' }, { status: 409 });
  }
  console.error(err);
  return NextResponse.json({ error: 'internal server error' }, { status: 500 });
}

/** Wraps a handler so every thrown error becomes a JSON error response. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Reads a JSON body. Empty body: `{}` when optional, otherwise 400. */
export async function readJson(req: Request, opts: { optional?: boolean } = {}): Promise<unknown> {
  const text = await req.text();
  if (text.trim() === '') {
    if (opts.optional) return {};
    throw badRequest('request body is required');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('request body is not valid JSON');
  }
}

export function parseId(raw: string): number {
  if (!/^\d{1,9}$/.test(raw)) throw badRequest(`invalid id: ${raw}`);
  return Number(raw);
}
```

`src/server/reference/resources.ts`:

```ts
// The seven plain-CRUD resources: their URL names, row types and input schemas.
import { z } from 'zod';
import type { Account, Asset, Budget, Category, Channel, Goal, IncomeCategory } from '@/generated/prisma/client';

const name = z.string().trim().min(1);
const text = z.string().optional();
const int = z.number().int().optional();

export const RESOURCE_SCHEMAS = {
  accounts: z.object({
    name, sub: text, balance: int, icon: text, tint: text,
    kind: z.enum(['bank', 'cash', 'ewallet', 'credit']).optional(), startDate: text, startTh: text, sort: int,
  }),
  categories: z.object({
    key: name, label: name, th: text, short: text, icon: text, tint: text,
    type: z.enum(['income', 'expense']).optional(), sub: text, sort: int,
  }),
  budgets: z.object({ cat: name, spent: z.number().int().nonnegative().optional(), limit: z.number().int().nonnegative(), sort: int }),
  goals: z.object({
    name, th: text, icon: text, saved: z.number().int().nonnegative().optional(), target: z.number().int().positive(),
    monthly: z.number().int().nonnegative().optional(), by: text, sort: int,
  }),
  assets: z.object({ name, th: text, icon: text, tint: text, value: int, sort: int }),
  channels: z.object({
    name, th: text, kind: z.enum(['saving', 'mf', 'pf', 'stock', 'gold', 'bond']).optional(), icon: text, tint: text,
    opening: int, startDate: text, startTh: text, sort: int,
  }),
  'income-categories': z.object({ name, th: text, sub: z.enum(['main', 'side', 'passive']).optional(), icon: text, tint: text, sort: int }),
} as const;

export interface ResourceRows {
  accounts: Account;
  categories: Category;
  budgets: Budget;
  goals: Goal;
  assets: Asset;
  channels: Channel;
  'income-categories': IncomeCategory;
}

export type ResourceName = keyof ResourceRows;

export function isResourceName(v: string): v is ResourceName {
  return Object.hasOwn(RESOURCE_SCHEMAS, v);
}
```

`src/server/reference/service.ts`:

```ts
// Generic CRUD over the reference resources.
import { prisma } from '@/lib/db';
import { notFound } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { RESOURCE_SCHEMAS, type ResourceName, type ResourceRows } from './resources';

interface Delegate<Row> {
  findMany(args: { orderBy: { sort: 'asc' } }): Promise<Row[]>;
  findUnique(args: { where: { id: number } }): Promise<Row | null>;
  create(args: { data: object }): Promise<Row>;
  update(args: { where: { id: number }; data: object }): Promise<Row>;
  delete(args: { where: { id: number } }): Promise<Row>;
}

// Each Prisma model delegate has its own generic signatures. They all satisfy this
// narrow shape at runtime, so we widen them once here instead of at every call site.
function delegate<K extends ResourceName>(name: K): Delegate<ResourceRows[K]> {
  const delegates = {
    accounts: prisma.account,
    categories: prisma.category,
    budgets: prisma.budget,
    goals: prisma.goal,
    assets: prisma.asset,
    channels: prisma.channel,
    'income-categories': prisma.incomeCategory,
  };
  return delegates[name] as unknown as Delegate<ResourceRows[K]>;
}

export function listResource<K extends ResourceName>(name: K): Promise<ResourceRows[K][]> {
  return delegate(name).findMany({ orderBy: { sort: 'asc' } });
}

export async function getResource<K extends ResourceName>(name: K, id: number): Promise<ResourceRows[K]> {
  const row = await delegate(name).findUnique({ where: { id } });
  if (!row) throw notFound();
  return row;
}

export function createResource<K extends ResourceName>(name: K, body: unknown): Promise<ResourceRows[K]> {
  return delegate(name).create({ data: parseBody(RESOURCE_SCHEMAS[name], body) });
}

export function updateResource<K extends ResourceName>(name: K, id: number, body: unknown): Promise<ResourceRows[K]> {
  return delegate(name).update({ where: { id }, data: parseBody(RESOURCE_SCHEMAS[name].partial(), body) });
}

export async function deleteResource(name: ResourceName, id: number): Promise<void> {
  await delegate(name).delete({ where: { id } });
}
```

- [ ] **Step 4: Implement the routes**

`src/app/api/v1/[resource]/route.ts`:

```ts
import { created, list, readJson, route } from '@/server/http';
import { notFound } from '@/server/errors';
import { isResourceName, type ResourceName } from '@/server/reference/resources';
import { createResource, listResource } from '@/server/reference/service';

type Ctx = { params: Promise<{ resource: string }> };

async function resourceOf(ctx: Ctx): Promise<ResourceName> {
  const { resource } = await ctx.params;
  if (!isResourceName(resource)) throw notFound();
  return resource;
}

export const GET = route(async (_req: Request, ctx: Ctx) => list(await listResource(await resourceOf(ctx))));

export const POST = route(async (req: Request, ctx: Ctx) => created(await createResource(await resourceOf(ctx), await readJson(req))));
```

`src/app/api/v1/[resource]/[id]/route.ts`:

```ts
import { noContent, ok, parseId, readJson, route } from '@/server/http';
import { notFound } from '@/server/errors';
import { isResourceName, type ResourceName } from '@/server/reference/resources';
import { deleteResource, getResource, updateResource } from '@/server/reference/service';

type Ctx = { params: Promise<{ resource: string; id: string }> };

async function target(ctx: Ctx): Promise<{ name: ResourceName; id: number }> {
  const { resource, id } = await ctx.params;
  if (!isResourceName(resource)) throw notFound();
  return { name: resource, id: parseId(id) };
}

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { name, id } = await target(ctx);
  return ok(await getResource(name, id));
});

const update = route(async (req: Request, ctx: Ctx) => {
  const { name, id } = await target(ctx);
  return ok(await updateResource(name, id, await readJson(req)));
});
export const PUT = update;
export const PATCH = update;

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { name, id } = await target(ctx);
  await deleteResource(name, id);
  return noContent();
});
```

`src/app/api/health/route.ts`:

```ts
import { ok, route } from '@/server/http';

export const GET = route(async () => ok({ status: 'ok', service: 'cashflowkub' }));
```

- [ ] **Step 5: Run tests**

Run: `pnpm test:api && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): http plumbing and generic reference CRUD api"
```

---

### Task 7: Transactions, debts and bills API

**Files:**
- Create: `src/server/transaction/service.ts`, `src/server/debt/service.ts`, `src/server/bill/service.ts`
- Create routes: `src/app/api/v1/transactions/route.ts`, `src/app/api/v1/transactions/[id]/route.ts`, `src/app/api/v1/debts/route.ts`, `src/app/api/v1/debts/[id]/route.ts`, `src/app/api/v1/debts/[id]/schedule/route.ts`, `src/app/api/v1/debts/[id]/pay/route.ts`, `src/app/api/v1/bills/route.ts`, `src/app/api/v1/bills/summary/route.ts`, `src/app/api/v1/bills/[id]/route.ts`, `src/app/api/v1/bills/[id]/pay/route.ts`
- Test: `tests/api/transactions.test.ts`, `tests/api/debts.test.ts`, `tests/api/bills.test.ts`

**Interfaces:**
- Consumes: Task 4 logic; Task 6 `route`, `readJson`, `parseId`, `parseBody`, `ok`/`created`/`list`/`noContent`; `today()`, `todayDay()`, `CURRENT_MONTH`.
- Produces (services, which pages call directly in later tasks):
  - `listTransactions(f: TxFilter): Promise<TxView[]>` (newest first: date desc, id desc), `getTransaction(id)`, `createTransaction(body: unknown)`, `updateTransaction(id, body: unknown)`, `deleteTransaction(id)`.
  - `listDebts(status?: string): Promise<DebtView[]>` (`'active'`, `'paid'`, anything else = all; ordered done asc, sort asc), `listActiveDebtViews(): Promise<DebtView[]>` (sort asc), `getDebt(id)`, `getDebtSchedule(id): Promise<ScheduleView>`, `payDebt(id, body: unknown): Promise<DebtView>`, `createDebt(body)`, `updateDebt(id, body)`, `deleteDebt(id)`.
  - `listBills(status?: string): Promise<BillView[]>` (ordered dueDay asc, sort asc), `getBillSummary(): Promise<BillSummary>`, `toggleBillPaid(id, body: unknown): Promise<BillView>`, `createBill(body)`, `updateBill(id, body)`, `deleteBill(id)`.

- [ ] **Step 1: Write the failing tests**

`tests/api/transactions.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/transactions/route';
import * as item from '@/app/api/v1/transactions/[id]/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('GET /api/v1/transactions', () => {
  it('lists newest first with derived date and group', async () => {
    const { json } = await call(collection.GET, { url: '/api/v1/transactions' });
    expect(json.data).toHaveLength(12);
    expect(json.data[0]).toEqual({ id: 3, name: 'Grab', cat: 'transport', acct: 'TrueMoney', amount: -120, note: 'Ride to office', date: 'Jun 18, 2026', group: 'Today' });
    expect(json.data[3].group).toBe('Yesterday');
  });
  it('filters by type, category, date range and limit', async () => {
    const get = async (qs: string) => (await call(collection.GET, { url: `/api/v1/transactions?${qs}` })).json.data;
    expect(await get('type=income')).toHaveLength(1);
    expect((await get('type=expense')).every((t: { amount: number }) => t.amount < 0)).toBe(true);
    expect(await get('category=food')).toHaveLength(3);
    expect(await get('from=2026-06-15&to=2026-06-15')).toHaveLength(3);
    expect(await get('limit=5')).toHaveLength(5);
  });
  it('400s an invalid date filter', async () => {
    expect((await call(collection.GET, { url: '/api/v1/transactions?from=nope' })).status).toBe(400);
  });
});

describe('POST /api/v1/transactions', () => {
  it('records a transaction dated today by default', async () => {
    const { status, json } = await call(collection.POST, { method: 'POST', body: { name: 'Lunch', cat: 'food', acct: 'Cash Wallet', amount: -90 } });
    expect(status).toBe(201);
    expect(json).toMatchObject({ id: 13, name: 'Lunch', date: 'Jun 18, 2026', group: 'Today', note: '' });
  });
  it('accepts an explicit date', async () => {
    const { json } = await call(collection.POST, { method: 'POST', body: { name: 'Gift', cat: 'income', acct: 'Cash Wallet', amount: 500, date: 'Jun 1, 2026' } });
    expect(json).toMatchObject({ date: 'Jun 1, 2026', group: 'Jun 1' });
  });
  it('rejects zero amounts, blank names and bad dates', async () => {
    const post = (body: object) => call(collection.POST, { method: 'POST', body });
    expect((await post({ name: 'X', cat: 'food', acct: 'Cash', amount: 0 })).status).toBe(400);
    expect((await post({ name: ' ', cat: 'food', acct: 'Cash', amount: -1 })).status).toBe(400);
    expect((await post({ name: 'X', cat: 'food', acct: 'Cash', amount: -1, date: '2026-02-30' })).status).toBe(400);
  });
});

describe('/api/v1/transactions/:id', () => {
  it('gets, updates and deletes', async () => {
    expect((await call(item.GET, { params: { id: '1' } })).json).toMatchObject({ name: 'Monthly Salary', amount: 62000 });
    expect((await call(item.PATCH, { method: 'PATCH', params: { id: '1' }, body: { note: 'June' } })).json).toMatchObject({ name: 'Monthly Salary', note: 'June' });
    expect((await call(item.DELETE, { method: 'DELETE', params: { id: '1' } })).status).toBe(204);
    expect((await call(item.GET, { params: { id: '1' } })).status).toBe(404);
  });
  it('400s a bad id', async () => {
    expect((await call(item.GET, { params: { id: '1.5' } })).status).toBe(400);
  });
});
```

`tests/api/debts.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/debts/route';
import * as item from '@/app/api/v1/debts/[id]/route';
import { GET as schedule } from '@/app/api/v1/debts/[id]/schedule/route';
import { POST as pay } from '@/app/api/v1/debts/[id]/pay/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('GET /api/v1/debts', () => {
  it('filters by status with derived remaining/progress', async () => {
    const active = (await call(collection.GET, { url: '/api/v1/debts?status=active' })).json.data;
    expect(active).toHaveLength(5);
    expect(active[0]).toMatchObject({ id: 1, remaining: 178375 });
    expect((await call(collection.GET, { url: '/api/v1/debts?status=paid' })).json.data).toHaveLength(9);
    expect((await call(collection.GET, { url: '/api/v1/debts' })).json.data).toHaveLength(14);
  });
});

describe('debt by id', () => {
  it('gets one and 404s a missing one', async () => {
    expect((await call(item.GET, { params: { id: '2' } })).json).toMatchObject({ name: 'KrungThai Personal', remaining: 45700 });
    expect((await call(item.GET, { params: { id: '9999' } })).status).toBe(404);
    expect((await call(item.GET, { params: { id: 'abc' } })).status).toBe(400);
  });
  it('builds the amortization schedule', async () => {
    const { json } = await call(schedule, { params: { id: '2' } });
    expect(json.schedule[0]).toEqual({ month: 1, payment: 2783, principal: 1831, interest: 952, balance: 43869 });
    expect(json.months).toBe(json.schedule.length);
  });
});

describe('POST /api/v1/debts/:id/pay', () => {
  it('pays the monthly minimum when the body is empty', async () => {
    const { status, json } = await call(pay, { method: 'POST', params: { id: '4' }, body: '' });
    expect(status).toBe(200);
    expect(json).toMatchObject({ paid: 6907, monthsLeft: 2, done: false });
  });
  it('caps an overpayment and closes the debt', async () => {
    const { json } = await call(pay, { method: 'POST', params: { id: '4' }, body: { amount: 999999 } });
    expect(json).toMatchObject({ paid: 9593, remaining: 0, done: true, monthsLeft: 0 });
  });
  it('rejects a negative amount', async () => {
    expect((await call(pay, { method: 'POST', params: { id: '4' }, body: { amount: -5 } })).status).toBe(400);
  });
});

describe('debt create / update / delete', () => {
  it('creates, edits and removes a debt', async () => {
    const created = await call(collection.POST, { method: 'POST', body: { name: 'Shopee SPayLater', original: 6000, monthly: 1000, calc: 'flat' } });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ id: 15, paid: 0, remaining: 6000 });
    const id = String(created.json.id);
    expect((await call(item.PATCH, { method: 'PATCH', params: { id }, body: { apr: 12 } })).json.apr).toBe(12);
    expect((await call(item.DELETE, { method: 'DELETE', params: { id } })).status).toBe(204);
  });
  it('rejects an unknown calc method', async () => {
    expect((await call(collection.POST, { method: 'POST', body: { name: 'X', original: 1, calc: 'magic' } })).status).toBe(400);
  });
});
```

`tests/api/bills.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/bills/route';
import { GET as summary } from '@/app/api/v1/bills/summary/route';
import { PATCH as pay } from '@/app/api/v1/bills/[id]/pay/route';
import * as item from '@/app/api/v1/bills/[id]/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('bills', () => {
  it('lists with derived status, filtered by paid flag', async () => {
    const all = (await call(collection.GET, { url: '/api/v1/bills' })).json.data;
    expect(all).toHaveLength(13);
    expect(all.find((b: { id: number }) => b.id === 6)).toMatchObject({ status: 'overdue', daysDiff: -2 });
    expect((await call(collection.GET, { url: '/api/v1/bills?status=paid' })).json.data).toHaveLength(5);
    expect((await call(collection.GET, { url: '/api/v1/bills?status=unpaid' })).json.data).toHaveLength(8);
  });
  it('summarizes the month', async () => {
    const { json } = await call(summary);
    expect(json).toMatchObject({ total: 27621, paid: 14398, remaining: 13223, count: 13, month: '2026-06', today: 18 });
    expect(json.nextBill).toMatchObject({ id: 6, name: 'KTC Credit Card' });
    expect(json.daySpend).toHaveLength(11);
  });
  it('toggles with an empty body and sets with an explicit flag', async () => {
    expect((await call(pay, { method: 'PATCH', params: { id: '6' }, body: '' })).json).toMatchObject({ paid: true, status: 'paid' });
    expect((await call(pay, { method: 'PATCH', params: { id: '6' }, body: { paid: true } })).json.paid).toBe(true);
    expect((await call(pay, { method: 'PATCH', params: { id: '6' } })).json.paid).toBe(false);
    expect((await call(pay, { method: 'PATCH', params: { id: '9999' } })).status).toBe(404);
  });
  it('creates, edits and deletes', async () => {
    const created = await call(collection.POST, { method: 'POST', body: { name: 'Gym', amount: 1500, dueDay: 3 } });
    expect(created.status).toBe(201);
    const id = String(created.json.id);
    expect((await call(item.PATCH, { method: 'PATCH', params: { id }, body: { amount: 1600 } })).json.amount).toBe(1600);
    expect((await call(item.DELETE, { method: 'DELETE', params: { id } })).status).toBe(204);
    expect((await call(collection.POST, { method: 'POST', body: { name: 'Bad', amount: 1, dueDay: 32 } })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test:api`
Expected: FAIL, route modules not found.

- [ ] **Step 3: Implement the services**

`src/server/transaction/service.ts`:

```ts
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { today } from '@/lib/clock';
import type { Prisma } from '@/generated/prisma/client';
import { badRequest, notFound } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { parseFlexDate, toTxView, type TxFilter, type TxView } from './logic';

const txSchema = z.object({
  name: z.string().trim().min(1),
  cat: z.string().min(1),
  acct: z.string().min(1),
  amount: z.number().int().refine((n) => n !== 0, 'amount must not be zero'),
  note: z.string().optional(),
  date: z.string().optional(),
});

function toDate(raw: string | undefined): Date | undefined {
  if (raw === undefined) return undefined;
  const d = parseFlexDate(raw);
  if (!d) throw badRequest(`invalid date: ${raw}`);
  return d;
}

export async function listTransactions(f: TxFilter): Promise<TxView[]> {
  const where: Prisma.TransactionWhereInput = {};
  if (f.type === 'income') where.amount = { gt: 0 };
  if (f.type === 'expense') where.amount = { lt: 0 };
  if (f.category) where.cat = f.category;
  if (f.account) where.acct = f.account;
  if (f.from || f.to) where.date = { gte: f.from, lte: f.to };
  const rows = await prisma.transaction.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: f.limit });
  const now = today();
  return rows.map((t) => toTxView(t, now));
}

export async function getTransaction(id: number): Promise<TxView> {
  const row = await prisma.transaction.findUnique({ where: { id } });
  if (!row) throw notFound();
  return toTxView(row, today());
}

export async function createTransaction(body: unknown): Promise<TxView> {
  const { date, ...input } = parseBody(txSchema, body);
  const row = await prisma.transaction.create({ data: { ...input, date: toDate(date) ?? today() } });
  return toTxView(row, today());
}

export async function updateTransaction(id: number, body: unknown): Promise<TxView> {
  const { date, ...input } = parseBody(txSchema.partial(), body);
  const row = await prisma.transaction.update({ where: { id }, data: { ...input, date: toDate(date) } });
  return toTxView(row, today());
}

export async function deleteTransaction(id: number): Promise<void> {
  await prisma.transaction.delete({ where: { id } });
}
```

`src/server/debt/service.ts`:

```ts
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { notFound } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { toDebtView, type DebtView } from '@/server/views';
import { applyPayment, buildSchedule, type ScheduleView } from './logic';

const text = z.string().optional();
const debtSchema = z.object({
  name: z.string().trim().min(1),
  th: text, icon: text, tint: text,
  original: z.number().int().positive(),
  paid: z.number().int().nonnegative().optional(),
  apr: z.number().min(0).max(1000).optional(),
  monthly: z.number().int().nonnegative().optional(),
  calc: z.enum(['flat', 'reducing']).optional(),
  payoff: text, payoffTh: text,
  monthsLeft: z.number().int().nonnegative().optional(),
  done: z.boolean().optional(),
  revolving: z.boolean().optional(),
  sort: z.number().int().optional(),
});
const paySchema = z.object({ amount: z.number().int().nonnegative().optional() });

async function findDebt(id: number) {
  const row = await prisma.debt.findUnique({ where: { id } });
  if (!row) throw notFound();
  return row;
}

export async function listDebts(status?: string): Promise<DebtView[]> {
  const where = status === 'active' ? { done: false } : status === 'paid' ? { done: true } : {};
  const rows = await prisma.debt.findMany({ where, orderBy: [{ done: 'asc' }, { sort: 'asc' }] });
  return rows.map(toDebtView);
}

export async function listActiveDebtViews(): Promise<DebtView[]> {
  const rows = await prisma.debt.findMany({ where: { done: false }, orderBy: { sort: 'asc' } });
  return rows.map(toDebtView);
}

export async function getDebt(id: number): Promise<DebtView> {
  return toDebtView(await findDebt(id));
}

export async function getDebtSchedule(id: number): Promise<ScheduleView> {
  return buildSchedule(await findDebt(id));
}

export async function payDebt(id: number, body: unknown): Promise<DebtView> {
  const { amount = 0 } = parseBody(paySchema, body);
  const next = applyPayment(await findDebt(id), amount);
  const saved = await prisma.debt.update({ where: { id }, data: { paid: next.paid, done: next.done, monthsLeft: next.monthsLeft } });
  return toDebtView(saved);
}

export async function createDebt(body: unknown): Promise<DebtView> {
  return toDebtView(await prisma.debt.create({ data: parseBody(debtSchema, body) }));
}

export async function updateDebt(id: number, body: unknown): Promise<DebtView> {
  return toDebtView(await prisma.debt.update({ where: { id }, data: parseBody(debtSchema.partial(), body) }));
}

export async function deleteDebt(id: number): Promise<void> {
  await prisma.debt.delete({ where: { id } });
}
```

`src/server/bill/service.ts`:

```ts
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { CURRENT_MONTH, todayDay } from '@/lib/clock';
import { notFound } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { toBillView, type BillView } from '@/server/views';
import { applyPaid, buildBillSummary, type BillSummary } from './logic';

const text = z.string().optional();
const billSchema = z.object({
  name: z.string().trim().min(1),
  th: text, icon: text, tint: text,
  amount: z.number().int().nonnegative(),
  dueDay: z.number().int().min(1).max(31),
  paid: z.boolean().optional(),
  freq: z.enum(['monthly', 'once']).optional(),
  cat: text,
  sort: z.number().int().optional(),
});
const toggleSchema = z.object({ paid: z.boolean().optional() });
const ORDER = [{ dueDay: 'asc' as const }, { sort: 'asc' as const }];

export async function listBills(status?: string): Promise<BillView[]> {
  const where = status === 'paid' ? { paid: true } : status === 'unpaid' ? { paid: false } : {};
  const rows = await prisma.bill.findMany({ where, orderBy: ORDER });
  const day = todayDay();
  return rows.map((b) => toBillView(b, day));
}

export async function getBillSummary(): Promise<BillSummary> {
  const [bills, days] = await Promise.all([
    prisma.bill.findMany({ orderBy: ORDER }),
    prisma.daySpend.findMany({ where: { month: CURRENT_MONTH }, orderBy: { day: 'asc' } }),
  ]);
  return buildBillSummary(bills, days, todayDay(), CURRENT_MONTH);
}

export async function toggleBillPaid(id: number, body: unknown): Promise<BillView> {
  const { paid } = parseBody(toggleSchema, body);
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) throw notFound();
  const saved = await prisma.bill.update({ where: { id }, data: { paid: applyPaid(bill, paid).paid } });
  return toBillView(saved, todayDay());
}

export async function createBill(body: unknown): Promise<BillView> {
  return toBillView(await prisma.bill.create({ data: parseBody(billSchema, body) }), todayDay());
}

export async function updateBill(id: number, body: unknown): Promise<BillView> {
  return toBillView(await prisma.bill.update({ where: { id }, data: parseBody(billSchema.partial(), body) }), todayDay());
}

export async function deleteBill(id: number): Promise<void> {
  await prisma.bill.delete({ where: { id } });
}
```

- [ ] **Step 4: Implement the routes**

`src/app/api/v1/transactions/route.ts`:

```ts
import { created, list, readJson, route } from '@/server/http';
import { parseTxFilter } from '@/server/transaction/logic';
import { createTransaction, listTransactions } from '@/server/transaction/service';

export const GET = route(async (req: Request) => list(await listTransactions(parseTxFilter(new URL(req.url).searchParams))));

export const POST = route(async (req: Request) => created(await createTransaction(await readJson(req))));
```

`src/app/api/v1/transactions/[id]/route.ts`:

```ts
import { noContent, ok, parseId, readJson, route } from '@/server/http';
import { deleteTransaction, getTransaction, updateTransaction } from '@/server/transaction/service';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => ok(await getTransaction(parseId((await ctx.params).id))));

const update = route(async (req: Request, ctx: Ctx) => ok(await updateTransaction(parseId((await ctx.params).id), await readJson(req))));
export const PUT = update;
export const PATCH = update;

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  await deleteTransaction(parseId((await ctx.params).id));
  return noContent();
});
```

`src/app/api/v1/debts/route.ts`:

```ts
import { created, list, readJson, route } from '@/server/http';
import { createDebt, listDebts } from '@/server/debt/service';

export const GET = route(async (req: Request) => list(await listDebts(new URL(req.url).searchParams.get('status') ?? undefined)));

export const POST = route(async (req: Request) => created(await createDebt(await readJson(req))));
```

`src/app/api/v1/debts/[id]/route.ts`:

```ts
import { noContent, ok, parseId, readJson, route } from '@/server/http';
import { deleteDebt, getDebt, updateDebt } from '@/server/debt/service';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => ok(await getDebt(parseId((await ctx.params).id))));

const update = route(async (req: Request, ctx: Ctx) => ok(await updateDebt(parseId((await ctx.params).id), await readJson(req))));
export const PUT = update;
export const PATCH = update;

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  await deleteDebt(parseId((await ctx.params).id));
  return noContent();
});
```

`src/app/api/v1/debts/[id]/schedule/route.ts`:

```ts
import { ok, parseId, route } from '@/server/http';
import { getDebtSchedule } from '@/server/debt/service';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => ok(await getDebtSchedule(parseId((await ctx.params).id))));
```

`src/app/api/v1/debts/[id]/pay/route.ts`:

```ts
import { ok, parseId, readJson, route } from '@/server/http';
import { payDebt } from '@/server/debt/service';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, ctx: Ctx) =>
  ok(await payDebt(parseId((await ctx.params).id), await readJson(req, { optional: true }))),
);
```

`src/app/api/v1/bills/route.ts`:

```ts
import { created, list, readJson, route } from '@/server/http';
import { createBill, listBills } from '@/server/bill/service';

export const GET = route(async (req: Request) => list(await listBills(new URL(req.url).searchParams.get('status') ?? undefined)));

export const POST = route(async (req: Request) => created(await createBill(await readJson(req))));
```

`src/app/api/v1/bills/summary/route.ts`:

```ts
import { ok, route } from '@/server/http';
import { getBillSummary } from '@/server/bill/service';

export const GET = route(async () => ok(await getBillSummary()));
```

`src/app/api/v1/bills/[id]/route.ts`:

```ts
import { noContent, ok, parseId, readJson, route } from '@/server/http';
import { deleteBill, updateBill } from '@/server/bill/service';

type Ctx = { params: Promise<{ id: string }> };

const update = route(async (req: Request, ctx: Ctx) => ok(await updateBill(parseId((await ctx.params).id), await readJson(req))));
export const PUT = update;
export const PATCH = update;

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  await deleteBill(parseId((await ctx.params).id));
  return noContent();
});
```

`src/app/api/v1/bills/[id]/pay/route.ts`:

```ts
import { ok, parseId, readJson, route } from '@/server/http';
import { toggleBillPaid } from '@/server/bill/service';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) =>
  ok(await toggleBillPaid(parseId((await ctx.params).id), await readJson(req, { optional: true }))),
);
```

- [ ] **Step 5: Run tests**

Run: `pnpm test:api && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): transactions, debts and bills api"
```

---

### Task 8: Aggregate API — dashboard, net worth, reports, setup, plan

**Files:**
- Create: `src/server/analytics/service.ts`, `src/server/setup/service.ts`, `src/server/plan/service.ts`
- Create routes: `src/app/api/v1/dashboard/route.ts`, `src/app/api/v1/networth/route.ts`, `src/app/api/v1/reports/route.ts`, `src/app/api/v1/setup/route.ts`, `src/app/api/v1/plan/route.ts`, `src/app/api/v1/plan/[id]/route.ts`, `src/app/api/v1/plan/snapshots/route.ts`
- Test: `tests/api/aggregates.test.ts`

**Interfaces:**
- Consumes: Task 5 builders, `listActiveDebtViews()` (Task 7), Task 6 helpers, `CURRENT_MONTH`.
- Produces: `getDashboard(): Promise<DashboardView>`, `getNetWorth(): Promise<NetWorthView>`, `getReports(): Promise<ReportsView>` from `@/server/analytics/service`; `getSetup(): Promise<SetupView>` from `@/server/setup/service`; `getPlan(month?: string): Promise<PlanView>` (400 on a malformed month), `getSnapshots(): Promise<SnapshotsView>`, `createPlanItem(body)`, `updatePlanItem(id, body)`, `deletePlanItem(id)` from `@/server/plan/service`.

- [ ] **Step 1: Write the failing tests**

`tests/api/aggregates.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { GET as dashboard } from '@/app/api/v1/dashboard/route';
import { GET as networth } from '@/app/api/v1/networth/route';
import { GET as reports } from '@/app/api/v1/reports/route';
import { GET as setup } from '@/app/api/v1/setup/route';
import * as plan from '@/app/api/v1/plan/route';
import * as planItem from '@/app/api/v1/plan/[id]/route';
import { GET as snapshots } from '@/app/api/v1/plan/snapshots/route';
import { PATCH as payBill } from '@/app/api/v1/bills/[id]/pay/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('GET /api/v1/dashboard', () => {
  it('aggregates the home screen', async () => {
    const { json } = await call(dashboard);
    expect(json).toMatchObject({ netWorth: 125532, totalAssets: 363930, totalLiab: 238398, month: { income: 62000, expense: 17700, net: 44300 }, spendTotal: 17700 });
    expect(json.spending[0]).toMatchObject({ cat: 'shopping', label: 'Shopping', spent: 6500 });
    expect(json.debt).toMatchObject({ original: 286243, paid: 47845, remaining: 238398 });
    expect(json.debt.focus).toMatchObject({ id: 3, name: 'Kbank Nano 3' });
    expect(json.nextBill).toMatchObject({ id: 6, status: 'overdue' });
    expect(json.cashflow).toHaveLength(6);
    expect(json.goals).toHaveLength(3);
  });
  it('moves nextBill after the overdue bill is paid', async () => {
    await call(payBill, { method: 'PATCH', params: { id: '6' }, body: { paid: true } });
    expect((await call(dashboard)).json.nextBill).toMatchObject({ name: 'MEA Water', status: 'dueSoon' });
  });
});

describe('net worth and reports', () => {
  it('breaks down assets and liabilities', async () => {
    const { json } = await call(networth);
    expect(json).toMatchObject({ netWorth: 125532 });
    expect(json.assets[0]).toMatchObject({ name: 'Kasikorn Savings', value: 128400 });
    expect(json.liabilities.map((d: { id: number }) => d.id)).toEqual([1, 2, 3, 4, 5]);
    expect(json.history).toHaveLength(6);
  });
  it('ranks top merchants', async () => {
    const { json } = await call(reports);
    expect(json.topMerchants.map((m: { name: string }) => m.name)).toEqual(['Central Ladprao', 'Fitness First', 'PEA Electricity', 'Lazada', 'Boots Pharmacy', 'Netflix']);
    expect(json.spendTotal).toBe(17700);
  });
});

describe('GET /api/v1/setup', () => {
  it('partitions the configuration', async () => {
    const { json } = await call(setup);
    expect(json.incomeCategories).toHaveLength(1);
    expect(json.expenseCategories).toHaveLength(6);
    expect(json.incomeSources).toHaveLength(9);
    expect(json.debts.closing.map((d: { id: number }) => d.id)).toEqual([1, 2, 4]);
    expect(json.debts.revolving.map((d: { id: number }) => d.id)).toEqual([3, 5]);
    expect(json.goals.retirement).toMatchObject({ currentAge: 23, retireAge: 60 });
    expect(json.goals.retirement.channels).toHaveLength(3);
    expect(json.goals.custom).toHaveLength(3);
  });
});

describe('plan', () => {
  it('builds the monthly plan with totals', async () => {
    const { json } = await call(plan.GET, { url: '/api/v1/plan?month=2026-06' });
    expect(json.income).toMatchObject({ totalPlanned: 66500, totalActual: 67020 });
    expect(json.expense).toMatchObject({ totalPlanned: 19000, totalActual: 17700 });
    expect(json.savings).toMatchObject({ totalPlanned: 26500, totalActual: 25000 });
    expect(json.summary).toMatchObject({ plannedNet: 21000, actualNet: 24320, netVariance: 3320 });
  });
  it('returns empty groups for a month without items and 400s a malformed month', async () => {
    expect((await call(plan.GET, { url: '/api/v1/plan?month=2025-01' })).json.income.items).toEqual([]);
    expect((await call(plan.GET, { url: '/api/v1/plan?month=June' })).status).toBe(400);
  });
  it('creates, updates and deletes plan items', async () => {
    const created = await call(plan.POST, { method: 'POST', body: { type: 'expense', name: 'Gifts', planned: 1000, month: '2026-06' } });
    expect(created.status).toBe(201);
    const id = String(created.json.id);
    expect((await call(planItem.PATCH, { method: 'PATCH', params: { id }, body: { actual: 400 } })).json.actual).toBe(400);
    expect((await call(planItem.DELETE, { method: 'DELETE', params: { id } })).status).toBe(204);
    expect((await call(plan.POST, { method: 'POST', body: { type: 'other', name: 'X', month: '2026-06' } })).status).toBe(400);
  });
  it('groups asset snapshots', async () => {
    const { json } = await call(snapshots);
    expect(json.groups.map((g: { group: string }) => g.group)).toEqual(['bank', 'savings', 'invest', 'other']);
    expect(json).toMatchObject({ prev: 530200, curr: 541930, delta: 11730 });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test:api tests/api/aggregates.test.ts`
Expected: FAIL, route modules not found.

- [ ] **Step 3: Implement the services**

`src/server/analytics/service.ts`:

```ts
import { prisma } from '@/lib/db';
import { todayDay } from '@/lib/clock';
import { listActiveDebtViews } from '@/server/debt/service';
import { buildDashboard, buildNetWorth, buildReports, type DashboardView, type NetWorthView, type ReportsView } from './logic';

const budgetsBySpend = () => prisma.budget.findMany({ orderBy: { spent: 'desc' } });
const assetsByValue = () => prisma.asset.findMany({ orderBy: { value: 'desc' } });
const cashflow = () => prisma.monthlyCashflow.findMany({ orderBy: { sort: 'asc' } });
const history = () => prisma.netWorthHistory.findMany({ orderBy: { sort: 'asc' } });

export async function getDashboard(): Promise<DashboardView> {
  const [assets, activeDebts, budgets, categories, flow, unpaidBills, goals, netWorthHist] = await Promise.all([
    assetsByValue(),
    listActiveDebtViews(),
    budgetsBySpend(),
    prisma.category.findMany(),
    cashflow(),
    prisma.bill.findMany({ where: { paid: false }, orderBy: [{ dueDay: 'asc' }, { sort: 'asc' }] }),
    prisma.goal.findMany({ orderBy: { sort: 'asc' } }),
    history(),
  ]);
  return buildDashboard({ assets, activeDebts, budgets, categories, cashflow: flow, unpaidBills, goals, netWorthHist, todayDay: todayDay() });
}

export async function getNetWorth(): Promise<NetWorthView> {
  const [assets, activeDebts, hist] = await Promise.all([assetsByValue(), listActiveDebtViews(), history()]);
  return buildNetWorth({ assets, activeDebts, history: hist });
}

export async function getReports(): Promise<ReportsView> {
  const [budgets, categories, expenseTx, monthly] = await Promise.all([
    budgetsBySpend(),
    prisma.category.findMany(),
    prisma.transaction.findMany({ where: { amount: { lt: 0 } }, orderBy: [{ date: 'desc' }, { id: 'desc' }] }),
    cashflow(),
  ]);
  return buildReports({ budgets, categories, expenseTx, monthly });
}
```

`src/server/setup/service.ts`:

```ts
import { prisma } from '@/lib/db';
import { listActiveDebtViews } from '@/server/debt/service';
import { buildSetup, type SetupView } from './logic';

const bySort = { orderBy: { sort: 'asc' as const } };

export async function getSetup(): Promise<SetupView> {
  const [categories, incomeSources, channels, accounts, activeDebts, setupGoals] = await Promise.all([
    prisma.category.findMany(bySort),
    prisma.incomeCategory.findMany(bySort),
    prisma.channel.findMany(bySort),
    prisma.account.findMany(bySort),
    listActiveDebtViews(),
    prisma.setupGoal.findMany({ ...bySort, include: { channels: { orderBy: { id: 'asc' } } } }),
  ]);
  return buildSetup({ categories, incomeSources, channels, accounts, activeDebts, setupGoals });
}
```

`src/server/plan/service.ts`:

```ts
import { z } from 'zod';
import { prisma } from '@/lib/db';
import type { PlanItem } from '@/generated/prisma/client';
import { badRequest } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { buildPlan, buildSnapshots, type PlanView, type SnapshotsView } from './logic';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const text = z.string().optional();
const int = z.number().int().nonnegative().optional();
const planItemSchema = z.object({
  type: z.enum(['income', 'expense', 'savings']),
  name: z.string().trim().min(1),
  th: text, icon: text, tint: text, cat: text, sub: text,
  planned: int, actual: int,
  month: z.string().regex(MONTH, 'month must be YYYY-MM'),
  sort: z.number().int().optional(),
});

/** month omitted = every month (Go parity); malformed = 400. */
export async function getPlan(month?: string): Promise<PlanView> {
  if (month !== undefined && !MONTH.test(month)) throw badRequest(`invalid month: ${month} (expected YYYY-MM)`);
  return buildPlan(await prisma.planItem.findMany({ where: month ? { month } : {}, orderBy: { sort: 'asc' } }));
}

export async function getSnapshots(): Promise<SnapshotsView> {
  const [snaps, hist] = await Promise.all([
    prisma.assetSnapshot.findMany({ orderBy: { sort: 'asc' } }),
    prisma.netWorthHistory.findMany({ orderBy: { sort: 'asc' } }),
  ]);
  return buildSnapshots(snaps, hist);
}

export function createPlanItem(body: unknown): Promise<PlanItem> {
  return prisma.planItem.create({ data: parseBody(planItemSchema, body) });
}

export function updatePlanItem(id: number, body: unknown): Promise<PlanItem> {
  return prisma.planItem.update({ where: { id }, data: parseBody(planItemSchema.partial(), body) });
}

export async function deletePlanItem(id: number): Promise<void> {
  await prisma.planItem.delete({ where: { id } });
}
```

- [ ] **Step 4: Implement the routes**

`src/app/api/v1/dashboard/route.ts`:

```ts
import { ok, route } from '@/server/http';
import { getDashboard } from '@/server/analytics/service';

export const GET = route(async () => ok(await getDashboard()));
```

`src/app/api/v1/networth/route.ts`:

```ts
import { ok, route } from '@/server/http';
import { getNetWorth } from '@/server/analytics/service';

export const GET = route(async () => ok(await getNetWorth()));
```

`src/app/api/v1/reports/route.ts`:

```ts
import { ok, route } from '@/server/http';
import { getReports } from '@/server/analytics/service';

export const GET = route(async () => ok(await getReports()));
```

`src/app/api/v1/setup/route.ts`:

```ts
import { ok, route } from '@/server/http';
import { getSetup } from '@/server/setup/service';

export const GET = route(async () => ok(await getSetup()));
```

`src/app/api/v1/plan/route.ts`:

```ts
import { created, ok, readJson, route } from '@/server/http';
import { createPlanItem, getPlan } from '@/server/plan/service';

export const GET = route(async (req: Request) => ok(await getPlan(new URL(req.url).searchParams.get('month') ?? undefined)));

export const POST = route(async (req: Request) => created(await createPlanItem(await readJson(req))));
```

`src/app/api/v1/plan/[id]/route.ts`:

```ts
import { noContent, ok, parseId, readJson, route } from '@/server/http';
import { deletePlanItem, updatePlanItem } from '@/server/plan/service';

type Ctx = { params: Promise<{ id: string }> };

const update = route(async (req: Request, ctx: Ctx) => ok(await updatePlanItem(parseId((await ctx.params).id), await readJson(req))));
export const PUT = update;
export const PATCH = update;

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  await deletePlanItem(parseId((await ctx.params).id));
  return noContent();
});
```

`src/app/api/v1/plan/snapshots/route.ts`:

```ts
import { ok, route } from '@/server/http';
import { getSnapshots } from '@/server/plan/service';

export const GET = route(async () => ok(await getSnapshots()));
```

- [ ] **Step 5: Run the full suite**

Run: `pnpm test && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Smoke-test against the dev server**

```bash
pnpm dev &
curl -s localhost:3000/api/health
curl -s localhost:3000/api/v1/dashboard | head -c 300
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/v1/debts/abc   # expect 400
kill %1
```

- [ ] **Step 7: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): dashboard, net worth, reports, setup and plan api"
```

---

### Task 9: UI foundation — theme, i18n, shell, motifs, charts

**Files:**
- Create: `src/lib/i18n.ts` (port), `src/lib/prefs.ts`, `src/lib/prefs-server.ts`, `src/lib/pref-cookie.ts`, `src/lib/api-client.ts`
- Create: `src/components/theme-provider.tsx`, `src/components/i18n-provider.tsx`
- Create: `src/components/app-shell/{nav.ts,app-nav.tsx,app-header.tsx,pref-controls.tsx,add-transaction-dialog.tsx}`
- Create: `src/components/cfk/{icon.tsx,tint.ts,tile.tsx,progress.tsx,list-row.tsx,hero.tsx,tone-badge.tsx,segmented-links.tsx,page-title.tsx,stat-card.tsx,tx-row.tsx,charts-math.ts,charts.tsx}`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`; delete `src/app/page.tsx` (the create-next-app starter)
- Create: `src/app/(app)/layout.tsx`
- Test: `tests/unit/prefs.test.ts`, `tests/unit/charts-math.test.ts`, `tests/unit/i18n.test.ts`, `tests/e2e/pages.test.ts`

**Interfaces:**
- Consumes: `listResource` (Task 6), `createTransaction` via `POST /api/v1/transactions` (Task 7), `fmt`/`signed` (Task 1).
- Produces:
  - `type Lang = 'en'|'th'`, `type Dict`, `DICT: Record<Lang, Dict>`, `localized(lang, en, th): string` from `@/lib/i18n`.
  - `LANG_COOKIE`, `YEAR_COOKIE`, `YEARS`, `CURRENT_YEAR`, `resolveLang(v?)`, `resolveYear(v?)`, `stepYear(year, dir)` from `@/lib/prefs`; `getPrefs(): Promise<{ lang; year }>`, `getI18n(): Promise<{ lang; ui }>` from `@/lib/prefs-server`.
  - `writePrefCookie(name, value)` from `@/lib/pref-cookie`; `apiFetch<T>(path, { method?, body? })`, `ApiError` from `@/lib/api-client`.
  - `<I18nProvider lang>` + `useI18n(): { lang; ui }` (client) from `@/components/i18n-provider`.
  - Motifs: `<Icon name size? className?>`, `<Tile icon tint? size?>`, `tintFg(key): string` (CSS var), `<Progress value tone?>`, `<SplitBar left>`, `<ListRow …>`, `<Hero>`, `<ToneBadge label tone>` + `type Tone`, `<SegmentedLinks options value hrefFor>`, `<PageTitle title back?>`, `<StatCard …>`, `<TxRow tx cat>`; charts `<CashflowBars data>`, `<MiniBars values>`, `<Donut segments …>`, `<TrendChart values labels?>`; math `donutArcs(values, r)`, `trendPoints(values, w, h, pad)`.
  - `NAV_ITEMS: { key; href; icon }[]` from `@/components/app-shell/nav`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/prefs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveLang, resolveYear, stepYear } from '@/lib/prefs';

describe('prefs', () => {
  it('resolveLang accepts th and falls back to en', () => {
    expect(resolveLang('th')).toBe('th');
    expect(resolveLang('en')).toBe('en');
    expect(resolveLang('<script>')).toBe('en');
    expect(resolveLang(undefined)).toBe('en');
  });
  it('resolveYear accepts known years only', () => {
    expect(resolveYear('2025')).toBe(2025);
    expect(resolveYear('1999')).toBe(2026);
    expect(resolveYear('abc')).toBe(2026);
  });
  it('stepYear stays inside the range', () => {
    expect(stepYear(2026, 1)).toBe(2027);
    expect(stepYear(2024, -1)).toBe(2024);
    expect(stepYear(2028, 1)).toBe(2028);
  });
});
```

`tests/unit/charts-math.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { donutArcs, trendPoints } from '@/components/cfk/charts-math';

describe('donutArcs', () => {
  it('splits the circumference proportionally with running offsets', () => {
    const circ = 2 * Math.PI * 10;
    const arcs = donutArcs([1, 3], 10);
    expect(arcs[0].length).toBeCloseTo(circ * 0.25);
    expect(arcs[1].length).toBeCloseTo(circ * 0.75);
    expect(arcs[1].offset).toBeCloseTo(circ * 0.25);
  });
  it('treats values as fractions when they sum below 1 (progress rings)', () => {
    const circ = 2 * Math.PI * 10;
    expect(donutArcs([0.25], 10)[0].length).toBeCloseTo(circ * 0.25);
  });
});

describe('trendPoints', () => {
  it('maps min to the bottom and max to the top', () => {
    expect(trendPoints([0, 10], 100, 50, 0)).toEqual({ line: '0,50 100,0', area: '0,50 0,50 100,0 100,50' });
  });
  it('survives flat and empty series', () => {
    expect(trendPoints([5, 5], 100, 50, 0).line).toBe('0,50 100,50');
    expect(trendPoints([], 100, 50, 0)).toEqual({ line: '', area: '' });
  });
});
```

`tests/unit/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DICT, localized } from '@/lib/i18n';

describe('i18n', () => {
  it('has Thai copy for screen names', () => {
    expect(DICT.en.nav.debts).toBe('Debts');
    expect(DICT.th.nav.networth).toBe('มูลค่าสุทธิ');
  });
  it('localized prefers Thai only when present', () => {
    expect(localized('th', 'Loan', 'เงินกู้')).toBe('เงินกู้');
    expect(localized('th', 'Loan', '')).toBe('Loan');
    expect(localized('en', 'Loan', 'เงินกู้')).toBe('Loan');
  });
});
```

`tests/e2e/pages.test.ts` (runs against a live server; later tasks append rows to `PAGES`):

```ts
import 'dotenv/config';
import { describe, expect, it } from 'vitest';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

// [path, text that must appear in English, text that must appear with cfk-lang=th]
const PAGES: [string, string, string][] = [];

async function fetchPage(path: string, cookie = ''): Promise<{ status: number; html: string }> {
  const res = await fetch(BASE + path, { headers: cookie ? { cookie } : {} });
  return { status: res.status, html: await res.text() };
}

describe('pages', () => {
  it.each(PAGES)('%s renders in English and Thai', async (path, en, th) => {
    const enPage = await fetchPage(path);
    expect(enPage.status).toBe(200);
    expect(enPage.html).toContain(en);
    const thPage = await fetchPage(path, 'cfk-lang=th');
    expect(thPage.html).toContain(th);
  });

  it('falls back to English for a garbage language cookie', async () => {
    const page = await fetchPage('/', 'cfk-lang=%3Cscript%3E');
    expect(page.status).toBe(200);
    expect(page.html).toContain('Dashboard');
  });
});
```

- [ ] **Step 2: Run the unit tests and see them fail**

Run: `pnpm test:unit`
Expected: FAIL, `@/lib/prefs`, `@/components/cfk/charts-math`, `@/lib/i18n` not found.

- [ ] **Step 3: Port i18n**

```bash
cp ../mobile/src/lib/i18n.ts src/lib/i18n.ts
```

Edit `src/lib/i18n.ts`:
1. Replace the header comment with `// Bilingual UI strings ported verbatim from the CashflowKub design comp (via mobile/src/lib/i18n.ts).`
2. Delete the line `type Dict = Record<string, any>;`.
3. Change `const en: Dict = {` to `const en = {`.
4. Directly after the closing `};` of `en`, add `export type Dict = typeof en;`.
5. Keep `const th: Dict = {` as it is. Now TypeScript checks that `th` has every key `en` has (they currently match).
6. Add these keys to **`en`**, after `expenseUsage: 'Expense usage',`:

```ts
  totalBalance: 'Total balance', payFirst: 'Pay first', totalInterest: 'Total interest', over: 'over',
  menu: 'Menu', settingsProfile: 'Ploy Srichan', settingsEmail: 'ploy@email.com', currencyValue: 'THB ฿',
```

and the matching keys to **`th`**, after `expenseUsage: 'รายจ่ายตามแผน',`:

```ts
  totalBalance: 'ยอดรวม', payFirst: 'จ่ายก่อน', totalInterest: 'ดอกเบี้ยรวม', over: 'เกิน',
  menu: 'เมนู', settingsProfile: 'พลอย ศรีจันทร์', settingsEmail: 'ploy@email.com', currencyValue: 'THB ฿',
```

7. Replace `export const DICT: Record<Lang, Dict> = { en, th };` with:

```ts
export const DICT: Record<Lang, Dict> = { en, th };

/** Picks the Thai string when the UI is in Thai and a translation exists. */
export function localized(lang: Lang, en: string, th: string): string {
  return lang === 'th' && th ? th : en;
}
```

- [ ] **Step 4: Implement prefs, cookies and the api client**

`src/lib/prefs.ts`:

```ts
import type { Lang } from '@/lib/i18n';

export const LANG_COOKIE = 'cfk-lang';
export const YEAR_COOKIE = 'cfk-year';
export const YEARS = [2024, 2025, 2026, 2027, 2028];
export const CURRENT_YEAR = 2026;

export function resolveLang(v: string | undefined): Lang {
  return v === 'th' ? 'th' : 'en';
}

export function resolveYear(v: string | undefined): number {
  const n = Number(v);
  return YEARS.includes(n) ? n : CURRENT_YEAR;
}

export function stepYear(year: number, dir: -1 | 1): number {
  const i = YEARS.indexOf(year);
  return YEARS[Math.min(YEARS.length - 1, Math.max(0, i + dir))] ?? CURRENT_YEAR;
}
```

`src/lib/prefs-server.ts`:

```ts
import { cookies } from 'next/headers';
import { DICT, type Dict, type Lang } from '@/lib/i18n';
import { LANG_COOKIE, resolveLang, resolveYear, YEAR_COOKIE } from '@/lib/prefs';

export async function getPrefs(): Promise<{ lang: Lang; year: number }> {
  const jar = await cookies();
  return { lang: resolveLang(jar.get(LANG_COOKIE)?.value), year: resolveYear(jar.get(YEAR_COOKIE)?.value) };
}

export async function getI18n(): Promise<{ lang: Lang; ui: Dict }> {
  const { lang } = await getPrefs();
  return { lang, ui: DICT[lang] };
}
```

`src/lib/pref-cookie.ts`:

```ts
/** Client-side: persist a preference cookie for a year. Callers then router.refresh(). */
export function writePrefCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}
```

`src/lib/api-client.ts`:

```ts
// Client-side fetch wrapper for the REST API (mutations from Client Components).
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') message = body.error;
    } catch {
      // non-JSON error body: keep the generic message
    }
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
```

- [ ] **Step 5: Implement the chart math**

`src/components/cfk/charts-math.ts`:

```ts
export interface Arc {
  length: number;
  offset: number;
  circumference: number;
}

/** Stroke-dash arcs for a donut. Values are normalized by max(1, sum), so fractions render as partial rings. */
export function donutArcs(values: number[], r: number): Arc[] {
  const circumference = 2 * Math.PI * r;
  const total = Math.max(1, values.reduce((s, v) => s + v, 0));
  let offset = 0;
  return values.map((v) => {
    const length = (Math.max(0, v) / total) * circumference;
    const arc = { length, offset, circumference };
    offset += length;
    return arc;
  });
}

/** Polyline + filled-area points for a trend chart in a w×h box. */
export function trendPoints(values: number[], w: number, h: number, pad: number): { line: string; area: string } {
  if (values.length === 0) return { line: '', area: '' };
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const stepX = (w - pad * 2) / Math.max(1, values.length - 1);
  const x = (i: number) => pad + i * stepX;
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return { line, area: `${pad},${h} ${line} ${x(values.length - 1)},${h}` };
}
```

- [ ] **Step 6: Run the unit tests**

Run: `pnpm test:unit`
Expected: PASS.

- [ ] **Step 7: Theme tokens**

Replace `src/app/globals.css` entirely. Values come from `mobile/src/global.css`, plus the hero and brand gradients from `mobile/src/lib/theme.ts`.

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: var(--font-plex-thai), ui-sans-serif, system-ui, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-type-folder-bg: var(--type-folder-bg);
  --color-type-folder-fg: var(--type-folder-fg);
  --color-type-pdf-bg: var(--type-pdf-bg);
  --color-type-pdf-fg: var(--type-pdf-fg);
  --color-type-image-bg: var(--type-image-bg);
  --color-type-image-fg: var(--type-image-fg);
  --color-type-doc-bg: var(--type-doc-bg);
  --color-type-doc-fg: var(--type-doc-fg);
  --color-type-xls-bg: var(--type-xls-bg);
  --color-type-xls-fg: var(--type-xls-fg);
  --color-type-video-bg: var(--type-video-bg);
  --color-type-video-fg: var(--type-video-fg);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.75rem;
  --background: #f5faf7;
  --foreground: #243430;
  --card: #ffffff;
  --card-foreground: #243430;
  --popover: #ffffff;
  --popover-foreground: #243430;
  --primary: #15835d;
  --primary-foreground: #f4fdf9;
  --secondary: #eef3f0;
  --secondary-foreground: #243430;
  --muted: #eef3f0;
  --muted-foreground: #677873;
  --accent: #eef3f0;
  --accent-foreground: #243430;
  --destructive: #dc4d3f;
  --border: #dde6e1;
  --input: #dde6e1;
  --ring: #15835d;
  --sidebar: #f0f5f2;
  --sidebar-foreground: #243430;
  --sidebar-border: #dfe8e3;
  --type-folder-bg: #fef9c3;
  --type-folder-fg: #ca8a04;
  --type-pdf-bg: #fee2e2;
  --type-pdf-fg: #dc2626;
  --type-image-bg: #f3e8ff;
  --type-image-fg: #9333ea;
  --type-doc-bg: #dbeafe;
  --type-doc-fg: #2563eb;
  --type-xls-bg: #dcfce7;
  --type-xls-fg: #16a34a;
  --type-video-bg: #fce7f3;
  --type-video-fg: #db2777;
  --hero-from: #12835d;
  --hero-to: #094f3b;
  --hero-fg: #f1faf5;
  --brand-from: #1a9c6a;
  --brand-to: #0b5c43;
}

.dark {
  --background: #161e1a;
  --foreground: #ecf2ef;
  --card: #1c2622;
  --card-foreground: #ecf2ef;
  --popover: #1c2622;
  --popover-foreground: #ecf2ef;
  --primary: #3cba88;
  --primary-foreground: #131a17;
  --secondary: #212b27;
  --secondary-foreground: #ecf2ef;
  --muted: #212b27;
  --muted-foreground: #93a39d;
  --accent: #212b27;
  --accent-foreground: #ecf2ef;
  --destructive: #e06a5c;
  --border: #2d3833;
  --input: #2d3833;
  --ring: #3cba88;
  --sidebar: #121815;
  --sidebar-foreground: #ecf2ef;
  --sidebar-border: #29332f;
  --type-folder-bg: #3a3416;
  --type-folder-fg: #facc15;
  --type-pdf-bg: #3a1c1c;
  --type-pdf-fg: #f87171;
  --type-image-bg: #2e1f3e;
  --type-image-fg: #c084fc;
  --type-doc-bg: #1c2a44;
  --type-doc-fg: #60a5fa;
  --type-xls-bg: #14321f;
  --type-xls-fg: #4ade80;
  --type-video-bg: #3a1f30;
  --type-video-fg: #f472b6;
  --hero-from: #10805b;
  --hero-to: #0a5640;
  --hero-fg: #eefaf4;
  --brand-from: #1fae77;
  --brand-to: #0c6b4e;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
}
```

If `shadcn init` added `tw-animate-css` under another name, keep whatever `@import` line it generated in place of the second line.

- [ ] **Step 8: Providers and root layout**

`src/components/theme-provider.tsx`:

```tsx
'use client';

import { ThemeProvider as NextThemes } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
```

`src/components/i18n-provider.tsx`:

```tsx
'use client';

import { createContext, useContext } from 'react';
import { DICT, type Dict, type Lang } from '@/lib/i18n';

const I18nContext = createContext<{ lang: Lang; ui: Dict } | null>(null);

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ lang, ui: DICT[lang] }}>{children}</I18nContext.Provider>;
}

export function useI18n(): { lang: Lang; ui: Dict } {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
```

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { getPrefs } from '@/lib/prefs-server';
import './globals.css';

const plexThai = IBM_Plex_Sans_Thai({ subsets: ['latin', 'thai'], weight: ['400', '500', '600', '700'], variable: '--font-plex-thai' });

export const metadata: Metadata = { title: 'CashflowKub', description: 'Personal cashflow — กระแสเงินสดส่วนตัว' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getPrefs();
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={plexThai.variable}>
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Delete the starter page: `rm src/app/page.tsx`. The dashboard becomes `src/app/(app)/page.tsx` in Task 10.

- [ ] **Step 9: Motif components**

`src/components/cfk/icon.tsx`:

```tsx
// Renders a lucide icon by the kebab-case name stored in the data (e.g. "shopping-bag").
// A static map keeps the client bundle to the icons we actually use.
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Bike, BookOpen, Briefcase, Calendar, CalendarClock, Car,
  ChartColumn, ChartPie, Check, ChevronLeft, ChevronRight, Circle, CircleHelp, Clapperboard, ClipboardList, Clock3,
  Cloud, Coins, CreditCard, Delete, Droplet, Gift, Globe, GraduationCap, HeartPulse, House, Landmark, LayoutDashboard,
  LogOut, Menu, Monitor, Moon, Music, Package, Pencil, PenTool, PiggyBank, Plane, Plus, Receipt, Scale, Settings, Shield,
  ShieldCheck, ShoppingBag, ShowerHead, SlidersHorizontal, Smartphone, Sun, Target, TentTree, Trash2, TrendingDown,
  TrendingUp, TriangleAlert, Utensils, Wallet, Wifi, X, Zap, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  'arrow-down-left': ArrowDownLeft, 'arrow-left-right': ArrowLeftRight, 'arrow-up-right': ArrowUpRight, banknote: Banknote,
  bike: Bike, 'book-open': BookOpen, briefcase: Briefcase, calendar: Calendar, 'calendar-clock': CalendarClock, car: Car,
  'bar-chart-3': ChartColumn, 'pie-chart': ChartPie, check: Check, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  circle: Circle, 'circle-help': CircleHelp, clapperboard: Clapperboard, 'clipboard-list': ClipboardList, 'clock-3': Clock3,
  cloud: Cloud, coins: Coins, 'credit-card': CreditCard, delete: Delete, droplet: Droplet, gift: Gift, globe: Globe,
  'graduation-cap': GraduationCap, 'heart-pulse': HeartPulse, house: House, landmark: Landmark, 'layout-dashboard': LayoutDashboard,
  'log-out': LogOut, menu: Menu, monitor: Monitor, moon: Moon, music: Music, package: Package, pencil: Pencil, 'pen-tool': PenTool,
  'piggy-bank': PiggyBank, plane: Plane, plus: Plus, receipt: Receipt, scale: Scale, settings: Settings, shield: Shield,
  'shield-check': ShieldCheck, 'shopping-bag': ShoppingBag, 'shower-head': ShowerHead, 'sliders-horizontal': SlidersHorizontal,
  smartphone: Smartphone, sun: Sun, target: Target, 'tent-tree': TentTree, 'trash-2': Trash2, 'trending-down': TrendingDown,
  'trending-up': TrendingUp, 'triangle-alert': TriangleAlert, utensils: Utensils, wallet: Wallet, wifi: Wifi, x: X, zap: Zap,
};

export function Icon({ name, size = 18, className, strokeWidth = 1.75 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const Comp = ICONS[name] ?? Circle;
  return <Comp size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
```

If `pnpm typecheck` reports that one of these names isn't exported by the installed `lucide-react`, look up the current name on lucide.dev, import that instead, and keep the same map key.

`src/components/cfk/tint.ts`:

```ts
// The six "file-type" accent tints: the only chromatic product chrome.
export const TINT_KEYS = ['folder', 'pdf', 'image', 'doc', 'xls', 'video'] as const;
export type TintKey = (typeof TINT_KEYS)[number];

const isTint = (v: string): v is TintKey => (TINT_KEYS as readonly string[]).includes(v);

// Literal class names so Tailwind can see them.
const CLASSES: Record<TintKey, string> = {
  folder: 'bg-type-folder-bg text-type-folder-fg',
  pdf: 'bg-type-pdf-bg text-type-pdf-fg',
  image: 'bg-type-image-bg text-type-image-fg',
  doc: 'bg-type-doc-bg text-type-doc-fg',
  xls: 'bg-type-xls-bg text-type-xls-fg',
  video: 'bg-type-video-bg text-type-video-fg',
};

export function tintClass(key: string | undefined): string {
  return CLASSES[key && isTint(key) ? key : 'doc'];
}

/** CSS color for SVG strokes/fills; follows light/dark automatically. */
export function tintFg(key: string | undefined): string {
  return `var(--type-${key && isTint(key) ? key : 'doc'}-fg)`;
}
```

`src/components/cfk/tile.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { Icon } from './icon';
import { tintClass } from './tint';

/** Rounded, tinted square holding an icon: the app's core motif. */
export function Tile({ icon, tint, size = 38, className }: { icon: string; tint?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-[11px]', tintClass(tint), className)}
      style={{ width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.46)} />
    </span>
  );
}
```

`src/components/cfk/progress.tsx`:

```tsx
import { clamp01 } from '@/lib/format';
import { cn } from '@/lib/utils';

const FILL = { primary: 'bg-primary', danger: 'bg-destructive', success: 'bg-type-xls-fg' } as const;

export function Progress({ value, tone = 'primary', className }: { value: number; tone?: keyof typeof FILL; className?: string }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-secondary', className)}>
      <div className={cn('h-full rounded-full', FILL[tone])} style={{ width: `${clamp01(value) * 100}%` }} />
    </div>
  );
}

/** Two-segment bar, e.g. assets vs liabilities. */
export function SplitBar({ left }: { left: number }) {
  const l = clamp01(left) * 100;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
      <div className="h-full bg-type-xls-fg" style={{ width: `${l}%` }} />
      <div className="h-full bg-destructive" style={{ width: `${100 - l}%` }} />
    </div>
  );
}
```

`src/components/cfk/list-row.tsx`:

```tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Icon } from './icon';
import { Tile } from './tile';

export interface ListRowProps {
  icon?: string;
  tint?: string;
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  rightSub?: React.ReactNode;
  href?: string;
  className?: string;
}

/** Tile + title/subtitle + right-aligned value. Becomes a link when href is set. */
export function ListRow({ icon, tint, leading, title, subtitle, right, rightSub, href, className }: ListRowProps) {
  const body = (
    <>
      {leading ?? (icon ? <Tile icon={icon} tint={tint} /> : null)}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        {typeof right === 'string' ? <span className="text-sm font-bold tabular-nums">{right}</span> : right}
        {typeof rightSub === 'string' ? <span className="text-xs text-muted-foreground tabular-nums">{rightSub}</span> : rightSub}
      </div>
      {href ? <Icon name="chevron-right" size={16} className="text-muted-foreground" /> : null}
    </>
  );
  const cls = cn('flex items-center gap-3 py-2.5', className);
  return href ? (
    <Link href={href} className={cn(cls, 'hover:opacity-80')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
```

`src/components/cfk/hero.tsx`:

```tsx
import { cn } from '@/lib/utils';

/** Large emerald gradient panel used for headline numbers. */
export function Hero({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[20px] bg-linear-to-br from-(--hero-from) to-(--hero-to) p-6 text-(--hero-fg)', className)}>
      {children}
    </section>
  );
}

export function HeroPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold">{children}</span>;
}
```

`src/components/cfk/tone-badge.tsx`:

```tsx
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'primary';

const TONE: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  success: 'bg-type-xls-bg text-type-xls-fg',
  danger: 'bg-type-pdf-bg text-type-pdf-fg',
  warning: 'bg-type-folder-bg text-type-folder-fg',
  info: 'bg-type-doc-bg text-type-doc-fg',
  primary: 'bg-primary text-primary-foreground',
};

export function ToneBadge({ label, tone = 'neutral', className }: { label: string; tone?: Tone; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', TONE[tone], className)}>{label}</span>;
}
```

`src/components/cfk/segmented-links.tsx`:

```tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Segmented control whose options are links (state lives in the URL, so it works server-side). */
export function SegmentedLinks({ options, value, hrefFor }: { options: { key: string; label: string }[]; value: string; hrefFor: (key: string) => string }) {
  return (
    <nav className="flex rounded-xl bg-secondary p-1">
      {options.map((o) => (
        <Link
          key={o.key}
          href={hrefFor(o.key)}
          scroll={false}
          aria-current={o.key === value ? 'page' : undefined}
          className={cn(
            'flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors',
            o.key === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
```

`src/components/cfk/page-title.tsx`:

```tsx
import Link from 'next/link';
import { Icon } from './icon';

export function PageTitle({ title, back, children }: { title: string; back?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {back ? (
        <Link href={back} aria-label="Back" className="flex size-9 items-center justify-center rounded-lg border bg-secondary hover:opacity-80">
          <Icon name="chevron-left" size={20} />
        </Link>
      ) : null}
      <h1 className="flex-1 truncate text-2xl font-bold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}
```

`src/components/cfk/stat-card.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Tile } from './tile';

export function StatCard({ icon, tint, label, value, positive }: { icon: string; tint: string; label: string; value: string; positive?: boolean }) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <Tile icon={icon} tint={tint} size={34} />
        <span className="truncate text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums', positive && 'text-type-xls-fg')}>{value}</p>
    </Card>
  );
}
```

`src/components/cfk/tx-row.tsx`:

```tsx
import type { Category } from '@/generated/prisma/client';
import { signed } from '@/lib/format';
import type { TxView } from '@/server/transaction/logic';
import { cn } from '@/lib/utils';
import { ListRow } from './list-row';

export function TxRow({ tx, cat, className }: { tx: TxView; cat?: Category; className?: string }) {
  return (
    <ListRow
      icon={cat?.icon ?? 'circle'}
      tint={cat?.tint}
      title={tx.name}
      subtitle={tx.acct}
      right={<span className={cn('text-sm font-bold tabular-nums', tx.amount >= 0 && 'text-type-xls-fg')}>{signed(tx.amount)}</span>}
      href={`/transactions/${tx.id}`}
      className={className}
    />
  );
}
```

`src/components/cfk/charts.tsx`:

```tsx
// Dependency-free charts: bars are divs, donut and trend are inline SVG. Colors are CSS vars so they follow the theme.
import { donutArcs, trendPoints } from './charts-math';

export function CashflowBars({ data, height = 150 }: { data: { month: string; income: number; expense: number }[]; height?: number }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  return (
    <div className="flex items-end gap-2.5" style={{ height }}>
      {data.map((d) => (
        <div key={d.month} className="flex h-full flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end justify-center gap-1">
            <div className="w-2.5 rounded-sm bg-type-xls-fg" style={{ height: `${(d.income / max) * 100}%` }} />
            <div className="w-2.5 rounded-sm bg-foreground" style={{ height: `${(d.expense / max) * 100}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniBars({ values, height = 54 }: { values: number[]; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {values.map((v, i) => (
        <div key={i} className="flex h-full flex-1 items-end justify-center">
          <div className="w-[70%] max-w-3.5 rounded-t-sm bg-primary" style={{ height: `${(v / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, size = 132, stroke = 18, centerLabel, centerValue, trackColor = 'var(--secondary)' }: {
  segments: { value: number; color: string }[];
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerValue?: string;
  trackColor?: string;
}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const arcs = donutArcs(segments.map((s) => s.value), r);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerValue}>
        <g transform={`rotate(-90 ${c} ${c})`}>
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} style={{ stroke: trackColor }} />
          {arcs.map((a, i) => (
            <circle key={i} cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} style={{ stroke: segments[i].color }}
              strokeDasharray={`${a.length} ${a.circumference - a.length}`} strokeDashoffset={-a.offset} />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerLabel ? <span className="text-[10px] text-muted-foreground">{centerLabel}</span> : null}
        {centerValue ? <span className="text-base font-bold tabular-nums">{centerValue}</span> : null}
      </div>
    </div>
  );
}

export function TrendChart({ values, labels, height = 120 }: { values: number[]; labels?: string[]; height?: number }) {
  const w = 320;
  const { line, area } = trendPoints(values, w, height, 6);
  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img">
        <polygon points={area} style={{ fill: 'var(--primary)' }} fillOpacity={0.12} />
        <polyline points={line} fill="none" style={{ stroke: 'var(--primary)' }} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {labels ? (
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 10: App shell**

`src/components/app-shell/nav.ts`:

```ts
// The app's screens: i18n nav key, route, icon. Used by the sidebar and the mobile sheet.
export const NAV_ITEMS = [
  { key: 'dashboard', href: '/', icon: 'layout-dashboard' },
  { key: 'bills', href: '/bills', icon: 'calendar-clock' },
  { key: 'transactions', href: '/transactions', icon: 'arrow-left-right' },
  { key: 'debts', href: '/debts', icon: 'trending-down' },
  { key: 'networth', href: '/networth', icon: 'scale' },
  { key: 'budgets', href: '/budgets', icon: 'wallet' },
  { key: 'accounts', href: '/accounts', icon: 'landmark' },
  { key: 'reports', href: '/reports', icon: 'bar-chart-3' },
  { key: 'goals', href: '/goals', icon: 'target' },
  { key: 'plan', href: '/plan', icon: 'clipboard-list' },
  { key: 'setup', href: '/setup', icon: 'sliders-horizontal' },
  { key: 'settings', href: '/settings', icon: 'settings' },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]['key'];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}
```

`src/components/app-shell/app-nav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { cn } from '@/lib/utils';
import { isActive, NAV_ITEMS } from './nav';

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-4">
      <span className="flex size-8 items-center justify-center rounded-[9px] bg-linear-to-br from-(--brand-from) to-(--brand-to) text-[15px] font-extrabold text-white">C</span>
      <span className="text-base font-bold">CashflowKub</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { ui } = useI18n();
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive(pathname, item.href) ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
          )}>
          <Icon name={item.icon} size={17} />
          {ui.nav[item.key]}
        </Link>
      ))}
    </nav>
  );
}

/** Fixed sidebar on md+; a sheet opened from the header on small screens. */
export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <Brand />
      <NavLinks />
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { ui } = useI18n();
  return (
    <>
      <button type="button" aria-label={ui.menu} onClick={() => setOpen(true)} className="flex size-9 items-center justify-center rounded-lg border bg-secondary md:hidden">
        <Icon name="menu" size={17} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{ui.menu}</SheetTitle>
          </SheetHeader>
          <Brand />
          <NavLinks onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
```

`src/components/app-shell/pref-controls.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { writePrefCookie } from '@/lib/pref-cookie';
import { LANG_COOKIE, stepYear, YEAR_COOKIE, YEARS } from '@/lib/prefs';
import { cn } from '@/lib/utils';

const box = 'flex h-9 items-center justify-center rounded-lg border bg-secondary text-xs font-semibold hover:opacity-80';

export function YearStepper({ year }: { year: number }) {
  const router = useRouter();
  const set = (y: number) => {
    writePrefCookie(YEAR_COOKIE, String(y));
    router.refresh();
  };
  return (
    <div className="flex h-9 items-center overflow-hidden rounded-lg border bg-secondary">
      <button type="button" aria-label="Previous year" disabled={year <= YEARS[0]} onClick={() => set(stepYear(year, -1))} className="px-2 disabled:opacity-30">
        <Icon name="chevron-left" size={15} />
      </button>
      <span className="text-xs font-bold tabular-nums">{year}</span>
      <button type="button" aria-label="Next year" disabled={year >= YEARS[YEARS.length - 1]} onClick={() => set(stepYear(year, 1))} className="px-2 disabled:opacity-30">
        <Icon name="chevron-right" size={15} />
      </button>
    </div>
  );
}

export function LangToggle() {
  const router = useRouter();
  const { lang } = useI18n();
  return (
    <button type="button" className={cn(box, 'min-w-9 px-2.5')} onClick={() => { writePrefCookie(LANG_COOKIE, lang === 'en' ? 'th' : 'en'); router.refresh(); }}>
      {lang === 'en' ? 'EN' : 'TH'}
    </button>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button type="button" aria-label="Toggle theme" className={cn(box, 'w-9')} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      <span className="dark:hidden"><Icon name="moon" size={17} /></span>
      <span className="hidden dark:inline"><Icon name="sun" size={17} /></span>
    </button>
  );
}
```

`src/components/app-shell/add-transaction-dialog.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { Account, Category } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/cfk/icon';
import { Tile } from '@/components/cfk/tile';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { localized } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type TxType = 'expense' | 'income';

export function AddTransactionDialog({ categories, accounts }: { categories: Category[]; accounts: Account[] }) {
  const { ui, lang } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [catKey, setCatKey] = useState('food');
  const [acct, setAcct] = useState(accounts[0]?.name ?? '');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const value = Math.round(Number(amount));
  const valid = Number.isFinite(value) && value > 0 && acct !== '';

  const save = () => {
    const cat = type === 'income' ? 'income' : catKey;
    const name = categories.find((c) => c.key === cat)?.label ?? 'Transaction';
    startTransition(async () => {
      try {
        await apiFetch('/transactions', { method: 'POST', body: { name, cat, acct, amount: type === 'income' ? value : -value, note } });
        setOpen(false);
        setAmount('');
        setNote('');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} />
        <span className="hidden sm:inline">{ui.add}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ui.addTx}</DialogTitle>
          </DialogHeader>
          <div className="flex rounded-xl bg-secondary p-1">
            {(['expense', 'income'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={cn('flex-1 rounded-lg py-2 text-sm font-semibold', type === t ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                {t === 'expense' ? ui.expense : ui.income}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tx-amount">{ui.amount} (฿)</Label>
            <Input id="tx-amount" inputMode="numeric" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)}
              className="h-14 text-center text-3xl font-extrabold tabular-nums" autoFocus />
          </div>
          {type === 'expense' ? (
            <div className="grid gap-2">
              <Label>{ui.category}</Label>
              <div className="grid grid-cols-4 gap-2">
                {expenseCats.map((c) => (
                  <button key={c.key} type="button" onClick={() => setCatKey(c.key)}
                    className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-2.5', c.key === catKey ? 'border-primary bg-secondary' : 'border-border')}>
                    <Tile icon={c.icon} tint={c.tint} size={34} />
                    <span className="truncate text-[10px] font-medium">{localized(lang, c.short, c.th)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="tx-account">{ui.account}</Label>
            <select id="tx-account" value={acct} onChange={(e) => setAcct(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tx-note">{ui.note}</Label>
            <Input id="tx-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!valid || pending} onClick={save}>{ui.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

`src/components/app-shell/app-header.tsx`:

```tsx
import type { Account, Category } from '@/generated/prisma/client';
import { AddTransactionDialog } from './add-transaction-dialog';
import { MobileNav } from './app-nav';
import { LangToggle, ThemeToggle, YearStepper } from './pref-controls';

export function AppHeader({ year, categories, accounts }: { year: number; categories: Category[]; accounts: Account[] }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur">
      <MobileNav />
      <div className="flex-1" />
      <YearStepper year={year} />
      <LangToggle />
      <ThemeToggle />
      <AddTransactionDialog categories={categories} accounts={accounts} />
    </header>
  );
}
```

`src/app/(app)/layout.tsx`:

```tsx
import { AppSidebar } from '@/components/app-shell/app-nav';
import { AppHeader } from '@/components/app-shell/app-header';
import { I18nProvider } from '@/components/i18n-provider';
import { getPrefs } from '@/lib/prefs-server';
import { listResource } from '@/server/reference/service';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ lang, year }, categories, accounts] = await Promise.all([getPrefs(), listResource('categories'), listResource('accounts')]);
  return (
    <I18nProvider lang={lang}>
      <div className="flex min-h-svh">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader year={year} categories={categories} accounts={accounts} />
          <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </I18nProvider>
  );
}
```

- [ ] **Step 11: Verify**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: PASS and clean. (`pnpm build` is checked in Task 10, once a page exists under `(app)`.)

- [ ] **Step 12: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): theme tokens, i18n, app shell, motifs and charts"
```

---

### Task 10: Dashboard + Transactions screens

**Files:**
- Create: `src/app/(app)/page.tsx`, `src/app/(app)/transactions/page.tsx`, `src/app/(app)/transactions/[id]/page.tsx`, `src/app/(app)/transactions/[id]/delete-button.tsx`, `src/lib/search-params.ts`, `src/lib/load-or-404.ts`
- Modify: `tests/e2e/pages.test.ts` (add rows)
- Test: `tests/unit/search-params.test.ts`, e2e rows

**Interfaces:**
- Consumes: `getDashboard` (Task 8), `listTransactions`, `getTransaction` (Task 7), `listResource` (Task 6), Task 9 motifs and `getI18n`.
- Produces: `type SearchParams = Promise<Record<string, string | string[] | undefined>>`, `firstParam(sp, key): string | undefined`, `byKey(categories): Map<string, Category>` from `@/lib/search-params`; `loadOr404<T>(load: () => Promise<T>): Promise<T>` from `@/lib/load-or-404` (a 400/404 `HttpError` renders the not-found page).

- [ ] **Step 1: Write the failing tests**

`tests/unit/search-params.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { byKey, firstParam } from '@/lib/search-params';
import { category } from '../fixtures';

describe('search params helpers', () => {
  it('firstParam takes the first value of repeated params', () => {
    expect(firstParam({ type: ['income', 'expense'] }, 'type')).toBe('income');
    expect(firstParam({ type: 'expense' }, 'type')).toBe('expense');
    expect(firstParam({}, 'type')).toBeUndefined();
  });
  it('byKey indexes categories by slug', () => {
    expect(byKey([category({ key: 'food' })]).get('food')?.label).toBe('Food');
  });
});
```

Append to `PAGES` in `tests/e2e/pages.test.ts`:

```ts
  ['/', 'Net worth', 'มูลค่าสุทธิ'],
  ['/transactions', 'Monthly Salary', 'ธุรกรรม'],
  ['/transactions/1', 'Acme Co. payroll', 'บันทึก'],
```

- [ ] **Step 2: Run the unit test and see it fail**

Run: `pnpm test:unit tests/unit/search-params.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the helpers**

`src/lib/search-params.ts`:

```ts
import type { Category } from '@/generated/prisma/client';

export type SearchParamsRecord = Record<string, string | string[] | undefined>;
export type SearchParams = Promise<SearchParamsRecord>;

export function firstParam(sp: SearchParamsRecord, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export function byKey(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((c) => [c.key, c]));
}
```

- [ ] **Step 4: Dashboard page**

`src/app/(app)/page.tsx`:

```tsx
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { CashflowBars, Donut, MiniBars } from '@/components/cfk/charts';
import { Hero, HeroPill } from '@/components/cfk/hero';
import { Icon } from '@/components/cfk/icon';
import { Progress } from '@/components/cfk/progress';
import { StatCard } from '@/components/cfk/stat-card';
import { Tile } from '@/components/cfk/tile';
import { tintFg } from '@/components/cfk/tint';
import { ToneBadge } from '@/components/cfk/tone-badge';
import { TxRow } from '@/components/cfk/tx-row';
import { compact, fmt, signed } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { byKey } from '@/lib/search-params';
import { getDashboard } from '@/server/analytics/service';
import { listResource } from '@/server/reference/service';
import { listTransactions } from '@/server/transaction/service';

function SectionHead({ title, href, viewAll }: { title: string; href?: string; viewAll: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-bold">{title}</h2>
      {href ? (
        <Link href={href} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {viewAll}
          <Icon name="chevron-right" size={14} />
        </Link>
      ) : null}
    </div>
  );
}

function Legend({ income, expenses }: { income: string; expenses: string }) {
  return (
    <div className="flex gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-type-xls-fg" />{income}</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-foreground" />{expenses}</span>
    </div>
  );
}

export default async function DashboardPage() {
  const { ui, lang } = await getI18n();
  const [d, recent, budgets, categories] = await Promise.all([getDashboard(), listTransactions({ limit: 5 }), listResource('budgets'), listResource('categories')]);
  const cats = byKey(categories);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{ui.greeting}</h1>
        <p className="text-sm text-muted-foreground">{ui.today}</p>
      </div>

      <Hero>
        <p className="text-[13px] font-semibold uppercase tracking-wider opacity-70">{ui.netWorth}</p>
        <p className="mt-2 text-4xl font-extrabold tabular-nums">{fmt(d.netWorth)}</p>
        <div className="mt-3"><HeroPill><Icon name="trending-up" size={15} />{signed(d.month.net)} {ui.thisMonth}</HeroPill></div>
      </Hero>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon="arrow-down-left" tint="xls" label={ui.income} value={fmt(d.month.income)} positive />
        <StatCard icon="arrow-up-right" tint="pdf" label={ui.expenses} value={fmt(d.month.expense)} />
        <StatCard icon="wallet" tint="doc" label={`${ui.net} · ${ui.thisMonth}`} value={signed(d.month.net)} positive />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold">{ui.cashflow}</h2>
            <span className="text-xs text-muted-foreground">{ui.last6}</span>
          </div>
          <CashflowBars data={d.cashflow} />
          <Legend income={ui.income} expenses={ui.expenses} />
        </Card>
        <Card className="gap-4 p-5">
          <h2 className="text-base font-bold">{ui.spending}</h2>
          <div className="flex items-center gap-5">
            <Donut segments={d.spending.map((s) => ({ value: s.spent, color: tintFg(s.tint) }))} centerLabel={ui.spent} centerValue={compact(d.spendTotal)} />
            <ul className="flex flex-1 flex-col gap-2.5">
              {d.spending.map((s) => (
                <li key={s.cat} className="flex items-center gap-2 text-[13px]">
                  <span className="size-2.5 rounded-sm" style={{ background: tintFg(s.tint) }} />
                  <span className="flex-1 truncate">{localized(lang, s.label, s.th)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.round(s.pct)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {d.nextBill ? (
        <Link href="/bills" className="block">
          <Card className="flex-row items-center gap-3.5 p-4 hover:opacity-90">
            <Tile icon={d.nextBill.icon} tint={d.nextBill.tint} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.nextBill}</p>
              <div className="flex items-center gap-2">
                <span className="truncate font-bold">{localized(lang, d.nextBill.name, d.nextBill.th)}</span>
                <ToneBadge label={d.nextBill.status === 'overdue' ? ui.overdue : ui.dueSoon} tone={d.nextBill.status === 'overdue' ? 'danger' : 'warning'} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold tabular-nums">{fmt(d.nextBill.amount)}</p>
              <p className="text-xs text-muted-foreground">{ui.dueOn} {d.nextBill.dueDay}</p>
            </div>
          </Card>
        </Link>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3.5 p-5">
          <SectionHead title={ui.nav.debts} href="/debts" viewAll={ui.viewAll} />
          <div className="flex items-center gap-4">
            <Donut size={86} stroke={11} segments={[{ value: d.debt.progress, color: 'var(--primary)' }]} centerValue={`${Math.round(d.debt.progress * 100)}%`} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.totalDebt}</p>
              <p className="text-2xl font-extrabold tabular-nums">{fmt(d.debt.remaining)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{ui.of} {fmt(d.debt.original)}</p>
            </div>
          </div>
          {d.debt.focus ? (
            <Link href={`/debts/${d.debt.focus.id}`} className="flex items-center gap-3 rounded-xl bg-secondary p-3 hover:opacity-90">
              <Tile icon={d.debt.focus.icon} tint={d.debt.focus.tint} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.payFirst} · {d.debt.focus.apr}% {ui.apr}</p>
                <p className="truncate text-[13px] font-semibold">{localized(lang, d.debt.focus.name, d.debt.focus.th)}</p>
              </div>
              <span className="text-[13px] font-bold tabular-nums">{fmt(d.debt.focus.remaining)}</span>
            </Link>
          ) : null}
        </Card>
        <Card className="gap-3.5 p-5">
          <SectionHead title={ui.netWorth} href="/networth" viewAll={ui.viewAll} />
          <p className="text-3xl font-extrabold tabular-nums">{fmt(d.netWorth)}</p>
          <div className="flex gap-4 text-xs font-semibold">
            <span className="text-type-xls-fg">+{fmt(d.totalAssets)} {ui.assets}</span>
            <span className="text-destructive">-{fmt(d.totalLiab)} {ui.liabilities}</span>
          </div>
          <MiniBars values={d.netWorthHist.map((p) => p.value)} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3 p-5">
          <SectionHead title={ui.budgetsTitle} href="/budgets" viewAll={ui.viewAll} />
          {budgets.slice(0, 4).map((b) => {
            const cat = cats.get(b.cat);
            return (
              <div key={b.id} className="grid gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold">{cat ? localized(lang, cat.label, cat.th) : b.cat}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmt(b.spent)} / {fmt(b.limit)}</span>
                </div>
                <Progress value={b.limit ? b.spent / b.limit : 0} tone={b.spent > b.limit ? 'danger' : 'primary'} />
              </div>
            );
          })}
        </Card>
        <Card className="gap-1 px-5 py-3">
          <div className="py-2"><SectionHead title={ui.recent} href="/transactions" viewAll={ui.viewAll} /></div>
          {recent.map((t) => <TxRow key={t.id} tx={t} cat={cats.get(t.cat)} className="border-t" />)}
        </Card>
      </div>

      <Card className="gap-3 p-5">
        <SectionHead title={ui.goalsTitle} href="/goals" viewAll={ui.viewAll} />
        {d.goals.map((g) => {
          const ratio = g.target ? g.saved / g.target : 0;
          return (
            <div key={g.id} className="grid gap-1.5">
              <div className="flex items-center gap-2.5">
                <Tile icon={g.icon} tint="xls" size={32} />
                <span className="flex-1 text-sm font-semibold">{localized(lang, g.name, g.th)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(ratio * 100)}%</span>
              </div>
              <Progress value={ratio} />
              <span className="text-xs text-muted-foreground tabular-nums">{fmt(g.saved)} {ui.of} {fmt(g.target)}</span>
            </div>
          );
        })}
      </Card>
    </>
  );
}
```

- [ ] **Step 5: Transactions list, detail and delete**

`src/app/(app)/transactions/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { TxRow } from '@/components/cfk/tx-row';
import { getI18n } from '@/lib/prefs-server';
import { byKey, firstParam, type SearchParams } from '@/lib/search-params';
import { listResource } from '@/server/reference/service';
import type { TxView } from '@/server/transaction/logic';
import { listTransactions } from '@/server/transaction/service';

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui } = await getI18n();
  const raw = firstParam(await searchParams, 'type');
  const type = raw === 'income' || raw === 'expense' ? raw : undefined;
  const [txs, categories] = await Promise.all([listTransactions({ type }), listResource('categories')]);
  const cats = byKey(categories);

  const groups: { label: string; items: TxView[] }[] = [];
  for (const t of txs) {
    const last = groups.at(-1);
    if (last?.label === t.group) last.items.push(t);
    else groups.push({ label: t.group, items: [t] });
  }

  return (
    <>
      <PageTitle title={ui.nav.transactions} />
      <SegmentedLinks
        value={type ?? 'all'}
        options={[{ key: 'all', label: ui.all }, { key: 'income', label: ui.income }, { key: 'expense', label: ui.expenses }]}
        hrefFor={(k) => (k === 'all' ? '/transactions' : `/transactions?type=${k}`)}
      />
      {groups.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">—</p> : null}
      {groups.map((g) => (
        <section key={g.label} className="grid gap-2">
          <h2 className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h2>
          <Card className="gap-0 px-4 py-1">
            {g.items.map((t, i) => <TxRow key={t.id} tx={t} cat={cats.get(t.cat)} className={i > 0 ? 'border-t' : undefined} />)}
          </Card>
        </section>
      ))}
    </>
  );
}
```

`src/app/(app)/transactions/[id]/delete-button.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';

export function DeleteTransactionButton({ id }: { id: number }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="flex-1 text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`${ui.delete}?`)) return;
        startTransition(async () => {
          try {
            await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
            router.push('/transactions');
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        });
      }}>
      <Icon name="trash-2" size={16} />
      {ui.delete}
    </Button>
  );
}
```

`src/app/(app)/transactions/[id]/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Tile } from '@/components/cfk/tile';
import { signed } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { loadOr404 } from '@/lib/load-or-404';
import { getI18n } from '@/lib/prefs-server';
import { cn } from '@/lib/utils';
import { parseId } from '@/server/http';
import { listResource } from '@/server/reference/service';
import { getTransaction } from '@/server/transaction/service';
import { DeleteTransactionButton } from './delete-button';

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { ui, lang } = await getI18n();
  const { id } = await params;
  const [tx, categories] = await Promise.all([loadOr404(async () => getTransaction(parseId(id))), listResource('categories')]);
  const cat = categories.find((c) => c.key === tx.cat);
  const rows: [string, string][] = [
    [ui.category, cat ? localized(lang, cat.label, cat.th) : tx.cat],
    [ui.account, tx.acct],
    [ui.date, tx.date],
    [ui.note, tx.note || '—'],
  ];

  return (
    <>
      <PageTitle title={tx.group} back="/transactions" />
      <div className="flex flex-col items-center gap-3 py-4">
        <Tile icon={cat?.icon ?? 'circle'} tint={cat?.tint} size={56} />
        <h2 className="text-xl font-bold">{tx.name}</h2>
        <p className={cn('text-3xl font-extrabold tabular-nums', tx.amount >= 0 && 'text-type-xls-fg')}>{signed(tx.amount)}</p>
      </div>
      <Card className="gap-0 bg-secondary p-0">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between border-b px-4 py-3 text-sm last:border-0">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </Card>
      <div className="flex gap-2.5">
        <DeleteTransactionButton id={tx.id} />
      </div>
    </>
  );
}
```

`src/lib/load-or-404.ts` (also used by Task 11):

```ts
import { notFound } from 'next/navigation';
import { HttpError } from '@/server/errors';

/** Runs a service call; a 400/404 HttpError renders the Next.js not-found page. */
export async function loadOr404<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
}
```

- [ ] **Step 6: Build and run the e2e check**

```bash
pnpm test:unit && pnpm typecheck && pnpm build
pnpm start &
pnpm test:e2e
kill %1
```

Expected: build succeeds; the e2e rows for `/`, `/transactions`, `/transactions/1` and the garbage-cookie test PASS.

Then check by hand in the browser at `http://localhost:3000` (with `pnpm dev`):
- add an expense from the header; it shows up under "Today" in Transactions;
- delete it from its detail page;
- toggle EN/TH and light/dark; both survive a reload.

- [ ] **Step 7: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): dashboard and transactions screens"
```

---

### Task 11: Bills + Debts screens

**Files:**
- Create: `src/app/(app)/bills/page.tsx`, `src/app/(app)/bills/bill-check.tsx`, `src/app/(app)/bills/bills-calendar.tsx`
- Create: `src/app/(app)/debts/page.tsx`, `src/app/(app)/debts/[id]/page.tsx`, `src/app/(app)/debts/[id]/pay-button.tsx`
- Modify: `tests/e2e/pages.test.ts`

**Interfaces:**
- Consumes: `getBillSummary`, `listBills` (Task 7); `listDebts`, `getDebt`, `getDebtSchedule`; `parseStrategy`, `sortByStrategy` (Task 4); `PATCH /bills/:id/pay`, `POST /debts/:id/pay`; `loadOr404`, `firstParam` (Task 10).
- Produces: `<BillCheck id paid />` and `<BillsCalendar bills={BillView[]} />` (client); `<PayDebtButton id />` (client). Plan 2 replaces `PayDebtButton`.

- [ ] **Step 1: Add the failing e2e rows**

Append to `PAGES`:

```ts
  ['/bills', 'KTC Credit Card', 'บิลเดือนนี้'],
  ['/bills?view=calendar', 'Bills this month', 'ปฏิทิน'],
  ['/debts', 'KrungThai Personal', 'กรุงไทยใจป้ำ'],
  ['/debts?strategy=snowball', 'Pay smallest balance first', 'จ่ายยอดน้อยก่อน'],
  ['/debts/2', 'Reducing balance', 'ลดต้นลดดอก'],
  ['/debts/2?tab=schedule', 'Total interest', 'ดอกเบี้ยรวม'],
```

- [ ] **Step 2: Bills**

`src/app/(app)/bills/bill-check.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function BillCheck({ id, paid, onDone }: { id: number; paid: boolean; onDone?: () => void }) {
  const router = useRouter();
  const { ui } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={paid}
      aria-label={paid ? ui.undo : ui.markPaid}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await apiFetch(`/bills/${id}/pay`, { method: 'PATCH', body: { paid: !paid } });
            router.refresh();
            onDone?.();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        })
      }
      className={cn('flex size-6 shrink-0 items-center justify-center rounded-md border disabled:opacity-50', paid ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
      {paid ? <Icon name="check" size={14} /> : null}
    </button>
  );
}
```

`src/app/(app)/bills/bills-calendar.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tile } from '@/components/cfk/tile';
import { useI18n } from '@/components/i18n-provider';
import { fmt } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { BillView } from '@/server/views';
import { BillCheck } from './bill-check';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// June 2026 starts on a Monday: one leading blank, 30 days.
const LEAD_PAD = 1;
const MONTH_DAYS = 30;

export function BillsCalendar({ bills }: { bills: BillView[] }) {
  const { ui, lang } = useI18n();
  const [day, setDay] = useState<number | null>(null);
  const byDay = new Map<number, BillView[]>();
  for (const b of bills) byDay.set(b.dueDay, [...(byDay.get(b.dueDay) ?? []), b]);
  const cells: (number | null)[] = [...Array(LEAD_PAD).fill(null), ...Array.from({ length: MONTH_DAYS }, (_, i) => i + 1)];
  const dayBills = day ? (byDay.get(day) ?? []) : [];

  return (
    <Card className="gap-2 p-4">
      <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase text-muted-foreground">
        {DOW.map((d, i) => <span key={i} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`pad-${i}`} />;
          const list = byDay.get(d);
          const overdue = list?.some((b) => b.status === 'overdue');
          return (
            <button key={d} type="button" disabled={!list} onClick={() => setDay(d)}
              className={cn('flex aspect-square flex-col items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums', list ? 'bg-secondary hover:opacity-80' : 'cursor-default')}>
              {d}
              {list ? <span className={cn('mt-1 size-1.5 rounded-full', overdue ? 'bg-destructive' : 'bg-primary')} /> : null}
            </button>
          );
        })}
      </div>
      <Dialog open={day !== null} onOpenChange={(o) => !o && setDay(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ui.dueOn} {lang === 'th' ? `${day} มิถุนายน 2026` : `June ${day}, 2026`}</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-2xl bg-secondary">
            {dayBills.map((b) => (
              <div key={b.id} className="flex items-center gap-3 border-b px-3.5 py-3 last:border-0">
                <BillCheck id={b.id} paid={b.paid} />
                <Tile icon={b.icon} tint={b.tint} size={34} />
                <span className={cn('flex-1 truncate text-sm font-semibold', b.paid && 'text-muted-foreground line-through')}>{localized(lang, b.name, b.th)}</span>
                <span className="text-sm font-bold tabular-nums">{fmt(b.amount)}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
```

The dialog's checkboxes call `router.refresh()`. That re-renders the page with fresh `bills` props, so the open dialog updates in place.

`src/app/(app)/bills/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { ToneBadge, type Tone } from '@/components/cfk/tone-badge';
import { fmt } from '@/lib/format';
import { localized, type Dict } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { cn } from '@/lib/utils';
import { getBillSummary, listBills } from '@/server/bill/service';
import type { BillStatus } from '@/server/views';
import { BillCheck } from './bill-check';
import { BillsCalendar } from './bills-calendar';

const STATUS_ORDER: BillStatus[] = ['overdue', 'dueToday', 'dueSoon', 'upcoming', 'paid'];
const STATUS_TONE: Record<BillStatus, Tone> = { overdue: 'danger', dueToday: 'warning', dueSoon: 'warning', upcoming: 'neutral', paid: 'success' };
const statusLabel = (s: BillStatus, ui: Dict): string =>
  ({ overdue: ui.overdue, dueToday: ui.dueToday, dueSoon: ui.dueSoon, upcoming: ui.upcoming, paid: ui.billsPaid })[s];

export default async function BillsPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const view = firstParam(await searchParams, 'view') === 'calendar' ? 'calendar' : 'list';
  const [summary, bills] = await Promise.all([getBillSummary(), listBills()]);

  return (
    <>
      <PageTitle title={ui.nav.bills} />
      <Card className="gap-3 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.billsTotal}</p>
        <p className="text-4xl font-extrabold tabular-nums">{fmt(summary.total)}</p>
        <div className="flex gap-6">
          <div><p className="text-xs text-muted-foreground">{ui.billsPaid}</p><p className="font-bold text-type-xls-fg tabular-nums">{fmt(summary.paid)}</p></div>
          <div><p className="text-xs text-muted-foreground">{ui.billsRemaining}</p><p className="font-bold text-destructive tabular-nums">{fmt(summary.remaining)}</p></div>
        </div>
        <Progress value={summary.total ? summary.paid / summary.total : 0} tone="success" className="h-2.5" />
      </Card>

      <SegmentedLinks value={view} options={[{ key: 'list', label: ui.viewList }, { key: 'calendar', label: ui.viewCalendar }]} hrefFor={(k) => `/bills?view=${k}`} />

      {view === 'calendar' ? (
        <BillsCalendar bills={bills} />
      ) : (
        STATUS_ORDER.map((status) => {
          const items = bills.filter((b) => b.status === status);
          if (items.length === 0) return null;
          return (
            <section key={status} className="grid gap-2">
              <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{statusLabel(status, ui)}</span>
                <span className="tabular-nums">{items.length}</span>
              </div>
              <Card className="gap-0 overflow-hidden p-0">
                {items.map((b, i) => (
                  <div key={b.id} className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t')}>
                    <BillCheck id={b.id} paid={b.paid} />
                    <Tile icon={b.icon} tint={b.tint} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-semibold', b.paid && 'text-muted-foreground line-through')}>{localized(lang, b.name, b.th)}</p>
                      <p className="text-xs text-muted-foreground">{ui.dueOn} {b.dueDay}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold tabular-nums">{fmt(b.amount)}</span>
                      <ToneBadge label={statusLabel(b.status, ui)} tone={STATUS_TONE[b.status]} />
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          );
        })
      )}
    </>
  );
}
```

- [ ] **Step 3: Debts list**

`src/app/(app)/debts/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { Donut } from '@/components/cfk/charts';
import { Hero, HeroPill } from '@/components/cfk/hero';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { ToneBadge } from '@/components/cfk/tone-badge';
import { fmt } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { parseStrategy, sortByStrategy } from '@/server/debt/logic';
import { listDebts } from '@/server/debt/service';

export default async function DebtsPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const strategy = parseStrategy(firstParam(await searchParams, 'strategy'));
  const [active, paid] = await Promise.all([listDebts('active'), listDebts('paid')]);
  const totalRemaining = active.reduce((s, d) => s + d.remaining, 0);
  const totalOriginal = active.reduce((s, d) => s + d.original, 0);
  const progress = totalOriginal > 0 ? active.reduce((s, d) => s + d.paid, 0) / totalOriginal : 0;

  return (
    <>
      <PageTitle title={ui.nav.debts} />
      <Hero>
        <div className="flex items-center gap-5">
          <Donut size={96} stroke={12} trackColor="rgb(255 255 255 / 0.18)" segments={[{ value: progress, color: 'var(--hero-fg)' }]} centerValue={`${Math.round(progress * 100)}%`} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{ui.totalDebt}</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums">{fmt(totalRemaining)}</p>
            <p className="text-sm opacity-75 tabular-nums">{ui.of} {fmt(totalOriginal)}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2.5">
          <HeroPill><span className="tabular-nums">{active.length}</span> {ui.active}</HeroPill>
          <HeroPill><span className="tabular-nums">{paid.length}</span> {ui.paidOff}</HeroPill>
        </div>
      </Hero>

      <Card className="gap-3 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.strategy}</p>
        <SegmentedLinks
          value={strategy}
          options={[{ key: 'avalanche', label: ui.avalanche }, { key: 'snowball', label: ui.snowball }, { key: 'custom', label: ui.custom }]}
          hrefFor={(k) => `/debts?strategy=${k}`}
        />
        <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{ui.strategyTip[strategy]}</p>
      </Card>

      <Card className="gap-1 px-5 py-3">
        <div className="flex justify-between py-2">
          <h2 className="font-bold">{ui.active}</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{active.length}</span>
        </div>
        {sortByStrategy(active, strategy).map((d) => (
          <ListRow
            key={d.id}
            icon={d.icon}
            tint={d.tint}
            title={localized(lang, d.name, d.th)}
            subtitle={`${ui.apr} ${d.apr}% · ${ui.minMonthly} ${fmt(d.monthly)}`}
            right={fmt(d.remaining)}
            rightSub={localized(lang, d.payoff, d.payoffTh)}
            href={`/debts/${d.id}`}
            className="border-t"
          />
        ))}
      </Card>

      {paid.length > 0 ? (
        <Card className="gap-3 p-5">
          <h2 className="font-bold text-type-xls-fg">{ui.paidOff}</h2>
          {paid.map((d) => (
            <div key={d.id} className="flex items-center gap-3 opacity-70">
              <ToneBadge label="✓" tone="success" />
              <span className="flex-1 truncate text-sm font-semibold line-through">{localized(lang, d.name, d.th)}</span>
              <span className="text-sm font-bold tabular-nums">{fmt(d.original)}</span>
            </div>
          ))}
        </Card>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Debt detail**

`src/app/(app)/debts/[id]/pay-button.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';

export function PayDebtButton({ id, disabled }: { id: number; disabled?: boolean }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="h-11 flex-1"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await apiFetch(`/debts/${id}/pay`, { method: 'POST' });
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        })
      }>
      <Icon name="arrow-down-left" size={16} />
      {ui.payNow}
    </Button>
  );
}
```

`src/app/(app)/debts/[id]/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { fmt, pct } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { loadOr404 } from '@/lib/load-or-404';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { parseId } from '@/server/http';
import { getDebtSchedule } from '@/server/debt/service';
import { PayDebtButton } from './pay-button';

export default async function DebtDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const { id } = await params;
  const tab = firstParam(await searchParams, 'tab') === 'schedule' ? 'schedule' : 'overview';
  const { debt: d, schedule, totalInterest } = await loadOr404(async () => getDebtSchedule(parseId(id)));
  const method = d.calc === 'reducing' ? ui.calcReducing : ui.calcFlat;
  const payoff = localized(lang, d.payoff, d.payoffTh);

  return (
    <>
      <PageTitle title={localized(lang, d.name, d.th)} back="/debts" />
      <div className="flex items-center gap-3">
        <Tile icon={d.icon} tint={d.tint} size={48} />
        <p className="text-sm text-muted-foreground">{ui.apr} {d.apr}% · {method}</p>
      </div>

      <Card className="gap-3.5 bg-secondary p-5">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.balance}</p>
            <p className="text-3xl font-extrabold tabular-nums">{fmt(d.remaining)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{ui.of} {fmt(d.original)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.payoff}</p>
            <p className="text-lg font-bold">{payoff}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{d.monthsLeft} {ui.monthsLeftLbl}</p>
          </div>
        </div>
        <Progress value={d.progress} />
        <div className="flex justify-between text-xs font-semibold text-muted-foreground tabular-nums">
          <span>{fmt(d.paid)} {ui.paidOff}</span>
          <span>{pct(d.progress)}</span>
        </div>
      </Card>

      <SegmentedLinks value={tab} options={[{ key: 'overview', label: ui.overview }, { key: 'schedule', label: ui.schedule }]} hrefFor={(k) => `/debts/${d.id}?tab=${k}`} />

      {tab === 'overview' ? (
        <>
          <Card className="gap-0 bg-secondary p-0">
            {([
              [ui.apr, `${d.apr}%`],
              [ui.calcMethod, method],
              [ui.minMonthly, fmt(d.monthly)],
              [ui.originalDebt, fmt(d.original)],
              [ui.payoff, payoff],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between border-b px-4 py-3 text-sm last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </Card>
          <div className="flex gap-2.5">
            <PayDebtButton id={d.id} disabled={d.done} />
          </div>
        </>
      ) : (
        <>
          <Card className="gap-0 overflow-x-auto bg-secondary p-0">
            <table className="w-full text-xs tabular-nums">
              <thead className="bg-background text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-2.5 text-left">#</th>
                  <th className="px-2 text-left">{ui.amount}</th>
                  <th className="px-2 text-left">{ui.principal}</th>
                  <th className="px-2 text-left">{ui.interest}</th>
                  <th className="px-3.5 text-right">{ui.remaining}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.slice(0, 24).map((r) => (
                  <tr key={r.month} className="border-t">
                    <td className="px-3.5 py-2.5 font-semibold text-muted-foreground">{r.month}</td>
                    <td className="px-2 font-semibold">{fmt(r.payment)}</td>
                    <td className="px-2">{fmt(r.principal)}</td>
                    <td className="px-2 text-destructive">{fmt(r.interest)}</td>
                    <td className="px-3.5 text-right font-semibold">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex justify-between px-1 text-sm">
            <span className="text-muted-foreground">{ui.totalInterest}</span>
            <span className="font-bold text-destructive tabular-nums">{fmt(totalInterest)}</span>
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 5: Build and run the e2e checks**

```bash
pnpm typecheck && pnpm build
pnpm start &
pnpm test:e2e
kill %1
```

Expected: all rows PASS.

Then check by hand:
- tick the KTC bill; it moves to "Paid", and the dashboard's "Next bill due" becomes MEA Water;
- open a calendar day with bills and tick one from the dialog;
- on `/debts/4`, click "Pay this month" until SPEC 3 closes; it moves to "Paid off".

Run `pnpm db:seed` afterwards to restore the demo data.

- [ ] **Step 6: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): bills and debts screens"
```

---

### Task 12: Net worth, Budgets, Accounts, Goals, Reports screens

**Files:**
- Create: `src/app/(app)/networth/page.tsx`, `src/app/(app)/budgets/page.tsx`, `src/app/(app)/accounts/page.tsx`, `src/app/(app)/goals/page.tsx`, `src/app/(app)/reports/page.tsx`
- Modify: `tests/e2e/pages.test.ts`

**Interfaces:**
- Consumes: `getNetWorth`, `getReports` (Task 8); `listResource` (Task 6); Task 9 motifs.
- Produces: pages only.

- [ ] **Step 1: Add the failing e2e rows**

```ts
  ['/networth', 'Net worth trend', 'แนวโน้มมูลค่าสุทธิ'],
  ['/networth?tab=liabilities', 'Student Loan', 'กยศ'],
  ['/budgets', 'Total budget', 'งบรวม'],
  ['/accounts', 'Kasikorn Savings', 'บัญชี'],
  ['/goals', 'Japan Trip', 'เที่ยวญี่ปุ่น'],
  ['/reports', 'Central Ladprao', 'ร้านค้ายอดนิยม'],
```

- [ ] **Step 2: Implement the pages**

`src/app/(app)/networth/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { TrendChart } from '@/components/cfk/charts';
import { Hero } from '@/components/cfk/hero';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { SplitBar } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { fmt } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { getNetWorth } from '@/server/analytics/service';

export default async function NetWorthPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const tab = firstParam(await searchParams, 'tab') === 'liabilities' ? 'liabilities' : 'assets';
  const nw = await getNetWorth();
  const gross = nw.totalAssets + nw.totalLiab;

  return (
    <>
      <PageTitle title={ui.nav.networth} />
      <Hero>
        <p className="text-[13px] font-semibold uppercase tracking-wider opacity-70">{ui.netWorth}</p>
        <p className="mt-2 text-4xl font-extrabold tabular-nums">{fmt(nw.netWorth)}</p>
      </Hero>
      <Card className="gap-3 p-5">
        <SplitBar left={gross ? nw.totalAssets / gross : 0} />
        <div className="flex justify-between text-[13px] font-semibold tabular-nums">
          <span className="text-type-xls-fg">+{fmt(nw.totalAssets)} {ui.assets}</span>
          <span className="text-destructive">-{fmt(nw.totalLiab)} {ui.liabilities}</span>
        </div>
      </Card>
      <Card className="gap-4 p-5">
        <h2 className="font-bold">{ui.networthTrend}</h2>
        <TrendChart values={nw.history.map((p) => p.value)} labels={nw.history.map((p) => localized(lang, p.month, p.monthTh))} />
      </Card>
      <SegmentedLinks value={tab} options={[{ key: 'assets', label: ui.assets }, { key: 'liabilities', label: ui.liabilities }]} hrefFor={(k) => `/networth?tab=${k}`} />
      <Card className="gap-0 px-5 py-1">
        {tab === 'assets'
          ? nw.assets.map((a, i) => (
              <ListRow key={a.id} icon={a.icon} tint={a.tint} title={localized(lang, a.name, a.th)} right={fmt(a.value)}
                rightSub={`${nw.totalAssets ? Math.round((a.value / nw.totalAssets) * 100) : 0}%`} className={i > 0 ? 'border-t' : undefined} />
            ))
          : nw.liabilities.map((d, i) => (
              <ListRow key={d.id} icon={d.icon} tint={d.tint} title={localized(lang, d.name, d.th)} subtitle={`${ui.apr} ${d.apr}%`}
                right={<span className="text-sm font-bold text-destructive tabular-nums">-{fmt(d.remaining)}</span>}
                href={`/debts/${d.id}`} className={i > 0 ? 'border-t' : undefined} />
            ))}
      </Card>
    </>
  );
}
```

`src/app/(app)/budgets/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { Tile } from '@/components/cfk/tile';
import { fmt } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { byKey } from '@/lib/search-params';
import { cn } from '@/lib/utils';
import { listResource } from '@/server/reference/service';

export default async function BudgetsPage() {
  const { ui, lang } = await getI18n();
  const [budgets, categories] = await Promise.all([listResource('budgets'), listResource('categories')]);
  const cats = byKey(categories);
  const spent = budgets.reduce((s, b) => s + b.spent, 0);
  const limit = budgets.reduce((s, b) => s + b.limit, 0);

  return (
    <>
      <PageTitle title={ui.nav.budgets} />
      <Card className="gap-2.5 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.totalBudget}</p>
        <p className="text-3xl font-extrabold tabular-nums">
          {fmt(spent)} <span className="text-lg font-medium text-muted-foreground">{ui.of} {fmt(limit)}</span>
        </p>
        <Progress value={limit ? spent / limit : 0} tone={spent > limit ? 'danger' : 'primary'} />
        <p className={cn('text-[13px] font-semibold tabular-nums', spent > limit ? 'text-destructive' : 'text-type-xls-fg')}>
          {spent > limit ? `${fmt(spent - limit)} ${ui.over}` : `${fmt(limit - spent)} ${ui.left}`}
        </p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {budgets.map((b) => {
          const cat = cats.get(b.cat);
          const over = b.spent > b.limit;
          return (
            <Card key={b.id} className="gap-3 p-4">
              <div className="flex items-center gap-2.5">
                <Tile icon={cat?.icon ?? 'circle'} tint={cat?.tint} />
                <span className="flex-1 truncate font-semibold">{cat ? localized(lang, cat.label, cat.th) : b.cat}</span>
                <span className="text-sm font-bold tabular-nums">{fmt(b.spent)} / {fmt(b.limit)}</span>
              </div>
              <Progress value={b.limit ? b.spent / b.limit : 0} tone={over ? 'danger' : 'primary'} />
              <p className={cn('text-xs font-semibold tabular-nums', over && 'text-destructive')}>
                {over ? `${fmt(b.spent - b.limit)} ${ui.over}` : `${fmt(b.limit - b.spent)} ${ui.left}`}
              </p>
            </Card>
          );
        })}
      </div>
    </>
  );
}
```

`src/app/(app)/accounts/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { ToneBadge, type Tone } from '@/components/cfk/tone-badge';
import { fmt } from '@/lib/format';
import { getI18n } from '@/lib/prefs-server';
import { cn } from '@/lib/utils';
import { listResource } from '@/server/reference/service';

const KIND_TONE: Record<string, Tone> = { bank: 'info', cash: 'success', ewallet: 'primary', credit: 'danger' };

export default async function AccountsPage() {
  const { ui } = await getI18n();
  const accounts = await listResource('accounts');
  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <PageTitle title={ui.nav.accounts} />
      <Card className="gap-1 p-6">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.totalBalance}</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums">{fmt(total)}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{accounts.length} {ui.accountsLower}</p>
      </Card>
      <Card className="gap-0 px-5 py-1">
        {accounts.map((a, i) => (
          <ListRow key={a.id} icon={a.icon} tint={a.tint} title={a.name} subtitle={a.sub} className={i > 0 ? 'border-t' : undefined}
            right={<span className={cn('font-bold tabular-nums', a.balance < 0 && 'text-destructive')}>{a.balance < 0 ? `-${fmt(a.balance)}` : fmt(a.balance)}</span>}
            rightSub={<ToneBadge label={a.kind} tone={KIND_TONE[a.kind] ?? 'neutral'} />} />
        ))}
      </Card>
    </>
  );
}
```

`src/app/(app)/goals/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { Tile } from '@/components/cfk/tile';
import { fmt } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { listResource } from '@/server/reference/service';

export default async function GoalsPage() {
  const { ui, lang } = await getI18n();
  const goals = await listResource('goals');

  return (
    <>
      <PageTitle title={ui.nav.goals} />
      <div className="grid gap-3 sm:grid-cols-2">
        {goals.map((g) => {
          const ratio = g.target ? g.saved / g.target : 0;
          return (
            <Card key={g.id} className="gap-3.5 p-5">
              <div className="flex items-center gap-3">
                <Tile icon={g.icon} tint="xls" />
                <span className="flex-1 truncate font-bold">{localized(lang, g.name, g.th)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(ratio * 100)}%</span>
              </div>
              <Progress value={ratio} />
              <p className="text-xs text-muted-foreground tabular-nums">{fmt(g.saved)} {ui.of} {fmt(g.target)}</p>
              <div className="flex justify-between text-[13px]">
                <span className="font-semibold text-type-xls-fg tabular-nums">{fmt(g.monthly)}{ui.perMonth}</span>
                <span className="text-muted-foreground">{ui.by} {g.by}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
```

`src/app/(app)/reports/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { CashflowBars, Donut } from '@/components/cfk/charts';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { tintFg } from '@/components/cfk/tint';
import { compact, fmt } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { byKey } from '@/lib/search-params';
import { getReports } from '@/server/analytics/service';
import { listResource } from '@/server/reference/service';

export default async function ReportsPage() {
  const { ui, lang } = await getI18n();
  const [r, categories] = await Promise.all([getReports(), listResource('categories')]);
  const cats = byKey(categories);

  return (
    <>
      <PageTitle title={ui.nav.reports} />
      <Card className="gap-4 p-5">
        <h2 className="font-bold">{ui.breakdown}</h2>
        <div className="flex flex-wrap items-center gap-5">
          <Donut segments={r.breakdown.map((b) => ({ value: b.spent, color: tintFg(b.tint) }))} centerLabel={ui.spent} centerValue={compact(r.spendTotal)} />
          <ul className="flex min-w-48 flex-1 flex-col gap-2.5">
            {r.breakdown.map((b) => (
              <li key={b.cat} className="flex items-center gap-2 text-[13px]">
                <span className="size-2.5 rounded-sm" style={{ background: tintFg(b.tint) }} />
                <span className="flex-1 truncate">{localized(lang, b.label, b.th)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{fmt(b.spent)} · {Math.round(b.pct)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <Card className="gap-0 px-5 py-3">
        <h2 className="py-2 font-bold">{ui.topMerchants}</h2>
        {r.topMerchants.map((m) => {
          const cat = cats.get(m.cat);
          return <ListRow key={m.name} icon={cat?.icon ?? 'circle'} tint={cat?.tint} title={m.name} right={fmt(m.total)} className="border-t" />;
        })}
      </Card>
      <Card className="gap-4 p-5">
        <h2 className="font-bold">{ui.cashflow}</h2>
        <CashflowBars data={r.monthly} />
      </Card>
    </>
  );
}
```

- [ ] **Step 3: Build and run the e2e checks**

```bash
pnpm typecheck && pnpm build
pnpm start &
pnpm test:e2e
kill %1
```

Expected: all rows PASS.

- [ ] **Step 4: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): net worth, budgets, accounts, goals and reports screens"
```

---

### Task 13: Plan, Setup, Settings screens

**Files:**
- Create: `src/app/(app)/plan/page.tsx`, `src/app/(app)/setup/page.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/(app)/settings/preferences.tsx`
- Modify: `tests/e2e/pages.test.ts`

**Interfaces:**
- Consumes: `getPlan`, `getSnapshots` (Task 8), `getSetup` (Task 8), `CURRENT_MONTH`, `YearStepper` and the pref cookie helpers (Task 9).
- Produces: pages only.

- [ ] **Step 1: Add the failing e2e rows**

```ts
  ['/plan', 'Income plan', 'แผนรายรับ'],
  ['/plan?tab=summary', 'Net variance', 'ผลต่างรวม'],
  ['/plan?tab=assets', 'Last updated', 'อัพเดตล่าสุด'],
  ['/setup', 'Expense items', 'หมวด'],
  ['/setup?tab=goals', 'Retirement', 'เกษียณ'],
  ['/settings', 'Preferences', 'การตั้งค่า'],
```

- [ ] **Step 2: Plan page**

`src/app/(app)/plan/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { Donut, TrendChart } from '@/components/cfk/charts';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { CURRENT_MONTH } from '@/lib/clock';
import { fmt, signed } from '@/lib/format';
import { localized, type Dict, type Lang } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { cn } from '@/lib/utils';
import type { PlanGroup } from '@/server/plan/logic';
import { getPlan, getSnapshots } from '@/server/plan/service';

const GROUP_META: Record<string, { label: keyof Dict; icon: string; tint: string }> = {
  bank: { label: 'bankAcctsGroup', icon: 'landmark', tint: 'doc' },
  savings: { label: 'savingsGroup', icon: 'piggy-bank', tint: 'xls' },
  invest: { label: 'investmentsGroup', icon: 'trending-up', tint: 'folder' },
  other: { label: 'otherAssetsGroup', icon: 'package', tint: 'image' },
};

function PlanSection({ title, group, expense, ui, lang }: { title: string; group: PlanGroup; expense?: boolean; ui: Dict; lang: Lang }) {
  return (
    <Card className="gap-0 px-5 py-3">
      <h2 className="py-1 font-bold">{title}</h2>
      {group.items.map((it) => (
        <div key={it.id} className="grid gap-1.5 border-t py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 truncate text-sm font-semibold">{localized(lang, it.name, it.th)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{ui.planned} {fmt(it.planned)} · {ui.actualLbl} {fmt(it.actual)}</span>
          </div>
          <Progress value={it.planned ? it.actual / it.planned : 0} tone={expense && it.actual > it.planned ? 'danger' : 'primary'} />
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t pt-3 text-sm tabular-nums">
        <span className="text-muted-foreground">{ui.totalPlanned} {fmt(group.totalPlanned)}</span>
        <span className="font-bold">{ui.totalActual} {fmt(group.totalActual)}</span>
      </div>
    </Card>
  );
}

function RatioDonut({ label, ratio }: { label: string; ratio: number }) {
  const r = Math.max(0, ratio);
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <Donut size={96} stroke={12} segments={[{ value: r, color: 'var(--primary)' }, { value: Math.max(0, 100 - r), color: 'var(--secondary)' }]} centerValue={`${Math.round(r)}%`} />
      <span className="text-center text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default async function PlanPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const raw = firstParam(await searchParams, 'tab');
  const tab = raw === 'summary' || raw === 'assets' ? raw : 'monthly';
  const plan = await getPlan(CURRENT_MONTH);

  return (
    <>
      <PageTitle title={ui.nav.plan} />
      <SegmentedLinks
        value={tab}
        options={[{ key: 'monthly', label: ui.planTabMonthly }, { key: 'summary', label: ui.planTabSummary }, { key: 'assets', label: ui.planTabAssets }]}
        hrefFor={(k) => `/plan?tab=${k}`}
      />
      {tab === 'monthly' ? (
        <>
          <PlanSection title={ui.incomeplan} group={plan.income} ui={ui} lang={lang} />
          <PlanSection title={ui.expenseplan} group={plan.expense} expense ui={ui} lang={lang} />
          <PlanSection title={ui.savingsplan} group={plan.savings} ui={ui} lang={lang} />
        </>
      ) : null}
      {tab === 'summary' ? (
        <>
          <Card className="gap-4 p-5">
            <h2 className="font-bold">{ui.achievement}</h2>
            <div className="flex gap-3">
              <RatioDonut label={ui.incomeRatio} ratio={plan.summary.incomeRatio} />
              <RatioDonut label={ui.expenseUsage} ratio={plan.summary.expenseUsage} />
              <RatioDonut label={ui.savingsplan} ratio={plan.summary.savingsRatio} />
            </div>
          </Card>
          <Card className="gap-3 p-5">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">{ui.plannedNet}</span><span className="font-bold tabular-nums">{fmt(plan.summary.plannedNet)}</span></div>
            <div className="flex justify-between border-t pt-3"><span className="text-sm text-muted-foreground">{ui.actualLbl} {ui.net}</span><span className="font-bold tabular-nums">{fmt(plan.summary.actualNet)}</span></div>
            <div className="flex justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">{ui.netVariance}</span>
              <span className={cn('text-lg font-extrabold tabular-nums', plan.summary.netVariance >= 0 ? 'text-type-xls-fg' : 'text-destructive')}>{signed(plan.summary.netVariance)}</span>
            </div>
          </Card>
        </>
      ) : null}
      {tab === 'assets' ? <AssetsTab ui={ui} lang={lang} /> : null}
    </>
  );
}

async function AssetsTab({ ui, lang }: { ui: Dict; lang: Lang }) {
  const data = await getSnapshots();
  return (
    <>
      <Card className="gap-3 p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.lastUpdated}</p>
          <p className="text-sm font-semibold">{data.labels.lastUpdate}</p>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <div><p className="text-xs text-muted-foreground">{localized(lang, data.labels.prev, data.labels.prevTh)}</p><p className="text-lg font-extrabold tabular-nums">{fmt(data.prev)}</p></div>
          <span className="text-muted-foreground">→</span>
          <div className="text-right"><p className="text-xs text-muted-foreground">{localized(lang, data.labels.curr, data.labels.currTh)}</p><p className="text-lg font-extrabold tabular-nums">{fmt(data.curr)}</p></div>
        </div>
        <p className={cn('text-sm font-bold tabular-nums', data.delta >= 0 ? 'text-type-xls-fg' : 'text-destructive')}>{signed(data.delta)}</p>
      </Card>
      {data.groups.map((g) => {
        const meta = GROUP_META[g.group] ?? { label: undefined, icon: 'circle', tint: 'doc' };
        return (
          <Card key={g.group} className="gap-0 px-5 py-3">
            <div className="flex items-center gap-3 py-1">
              <Tile icon={meta.icon} tint={meta.tint} size={32} />
              <h2 className="flex-1 truncate font-bold">{meta.label ? String(ui[meta.label]) : g.group}</h2>
            </div>
            {g.items.map((it) => {
              const delta = it.curr - it.prev;
              return (
                <div key={it.id} className="flex items-center gap-3 border-t py-2.5">
                  <Tile icon={it.icon} tint={it.tint} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{localized(lang, it.name, it.th)}</span>
                  <div className="text-right">
                    <p className="text-[13px] font-bold tabular-nums">{fmt(it.prev)} → {fmt(it.curr)}</p>
                    <p className={cn('text-xs tabular-nums', delta >= 0 ? 'text-type-xls-fg' : 'text-destructive')}>{signed(delta)}</p>
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}
      <Card className="gap-4 p-5">
        <h2 className="font-bold">{ui.netWorthHist}</h2>
        <TrendChart values={data.history.map((p) => p.value)} labels={data.history.map((p) => localized(lang, p.month, p.monthTh))} />
      </Card>
    </>
  );
}
```

- [ ] **Step 3: Setup page**

`src/app/(app)/setup/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { ToneBadge } from '@/components/cfk/tone-badge';
import { fmt } from '@/lib/format';
import { localized, type Dict, type Lang } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import type { SetupGoalRow } from '@/server/setup/logic';
import { getSetup } from '@/server/setup/service';
import type { DebtView } from '@/server/views';

const TABS = ['categories', 'channels', 'accounts', 'debts', 'goals'] as const;
type Tab = (typeof TABS)[number];

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 px-5 py-3">
      <div className="py-2">
        <h2 className="font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      {children}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 flex-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-bold tabular-nums">{value}</p>
    </div>
  );
}

function GoalCard({ goal, ui, lang }: { goal: SetupGoalRow; ui: Dict; lang: Lang }) {
  const retire = goal.kind === 'retirement';
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-center gap-3">
        <Tile icon={goal.icon} tint={goal.tint} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{localized(lang, goal.name, goal.th)}</p>
          <p className="text-xs text-muted-foreground">
            {localized(lang, goal.startDate, goal.startTh)}
            {goal.endDate ? ` → ${localized(lang, goal.endDate, goal.endTh)}` : ''}
          </p>
        </div>
      </div>
      {retire && goal.currentAge != null ? (
        <div className="flex gap-2">
          {([[ui.currentAge, goal.currentAge], [ui.retireAge, goal.retireAge], [ui.useUntilAge, goal.useUntilAge]] as const).map(([label, v]) => (
            <div key={label} className="flex-1 rounded-xl bg-secondary py-2.5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-lg font-extrabold">{v}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 border-t pt-3">
        {retire ? <Fact label={ui.monthlyRetire} value={fmt(goal.monthlyNeed ?? 0)} /> : <Fact label={ui.targetAmt} value={fmt(goal.target)} />}
        <Fact label={ui.openingBal} value={fmt(goal.opening)} />
        <Fact label={ui.inflation} value={`${goal.inflation}%`} />
      </div>
      {goal.channels.length ? (
        <div className="grid gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.channels2} · {ui.allocation}</p>
          <div className="flex flex-wrap gap-2">
            {goal.channels.map((ch) => <ToneBadge key={ch.id} label={`${localized(lang, ch.name, ch.th)} ${ch.pct}%`} />)}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function DebtRows({ debts, ui, lang }: { debts: DebtView[]; ui: Dict; lang: Lang }) {
  return debts.map((d) => (
    <ListRow key={d.id} icon={d.icon} tint={d.tint} title={localized(lang, d.name, d.th)} subtitle={`${ui.apr} ${d.apr}% · ${ui.minPay} ${fmt(d.monthly)}`}
      right={<span className="font-bold text-destructive tabular-nums">{fmt(d.remaining)}</span>} href={`/debts/${d.id}`} className="border-t" />
  ));
}

export default async function SetupPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const raw = firstParam(await searchParams, 'tab');
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'categories';
  const s = await getSetup();
  const subLabel = (sub: string) => (sub === 'main' ? ui.subMain : sub === 'side' ? ui.subSide : ui.subPassive);

  return (
    <>
      <PageTitle title={ui.nav.setup} />
      <p className="text-sm text-muted-foreground">{ui.setupSub}</p>
      <SegmentedLinks
        value={tab}
        options={[
          { key: 'categories', label: ui.tabCats }, { key: 'channels', label: ui.tabChannels }, { key: 'accounts', label: ui.tabAccountsCfg },
          { key: 'debts', label: ui.tabDebtsCfg }, { key: 'goals', label: ui.tabGoalsCfg },
        ]}
        hrefFor={(k) => `/setup?tab=${k}`}
      />
      {tab === 'categories' ? (
        <>
          <Section title={ui.incomeCats} sub={ui.incomeCatsSub}>
            {s.incomeSources.map((x) => <ListRow key={x.id} icon={x.icon} tint={x.tint} title={localized(lang, x.name, x.th)} right={<ToneBadge label={subLabel(x.sub)} tone="info" />} className="border-t" />)}
          </Section>
          <Section title={ui.expenseCats} sub={ui.expenseCatsSub}>
            {s.expenseCategories.map((c) => (
              <ListRow key={c.id} icon={c.icon} tint={c.tint} title={localized(lang, c.label, c.th)} className="border-t"
                right={<ToneBadge label={c.sub === 'need' ? ui.subNeed : ui.subWant} tone={c.sub === 'need' ? 'success' : 'warning'} />} />
            ))}
          </Section>
        </>
      ) : null}
      {tab === 'channels' ? (
        <Section title={ui.savingsCh} sub={ui.savingsChSub}>
          {s.channels.map((ch) => (
            <ListRow key={ch.id} icon={ch.icon} tint={ch.tint} title={localized(lang, ch.name, ch.th)} className="border-t"
              subtitle={`${ch.kind} · ${ui.startDate} ${localized(lang, ch.startDate, ch.startTh)}`} right={fmt(ch.opening)} />
          ))}
        </Section>
      ) : null}
      {tab === 'accounts' ? (
        <Section title={ui.bankAccts} sub={ui.bankAcctsSub}>
          {s.accounts.map((a) => <ListRow key={a.id} icon={a.icon} tint={a.tint} title={a.name} subtitle={a.sub} right={fmt(a.balance)} rightSub={<ToneBadge label={a.kind} />} className="border-t" />)}
        </Section>
      ) : null}
      {tab === 'debts' ? (
        <>
          <Section title={ui.closingDebts} sub={ui.closingDebtsSub}><DebtRows debts={s.debts.closing} ui={ui} lang={lang} /></Section>
          <Section title={ui.revolvingDebts} sub={ui.revolvingDebtsSub}><DebtRows debts={s.debts.revolving} ui={ui} lang={lang} /></Section>
        </>
      ) : null}
      {tab === 'goals' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[s.goals.emergency, s.goals.stocks, s.goals.retirement, ...s.goals.custom]
            .filter((g): g is SetupGoalRow => g !== null)
            .map((g) => <GoalCard key={g.id} goal={g} ui={ui} lang={lang} />)}
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Settings page**

`src/app/(app)/settings/preferences.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { YearStepper } from '@/components/app-shell/pref-controls';
import { useI18n } from '@/components/i18n-provider';
import { writePrefCookie } from '@/lib/pref-cookie';
import { LANG_COOKIE } from '@/lib/prefs';
import { cn } from '@/lib/utils';

function Segmented({ value, options, onChange }: { value: string; options: { key: string; label: string }[]; onChange: (k: string) => void }) {
  return (
    <div className="flex w-40 rounded-lg bg-secondary p-1">
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          className={cn('flex-1 rounded-md py-1.5 text-xs font-semibold', o.key === value ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PreferencesRows({ year }: { year: number }) {
  const { ui, lang } = useI18n();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const row = 'flex items-center gap-3 border-t py-3';
  return (
    <>
      <div className={row}>
        <span className="flex-1 text-sm">{ui.language}</span>
        <Segmented value={lang} options={[{ key: 'en', label: 'EN' }, { key: 'th', label: 'TH' }]}
          onChange={(k) => { writePrefCookie(LANG_COOKIE, k); router.refresh(); }} />
      </div>
      <div className={row}>
        <span className="flex-1 text-sm">{ui.appearance}</span>
        <Segmented value={resolvedTheme ?? 'light'} options={[{ key: 'light', label: ui.light }, { key: 'dark', label: ui.dark }]} onChange={setTheme} />
      </div>
      <div className={row}>
        <span className="flex-1 text-sm">{ui.yearScope}</span>
        <YearStepper year={year} />
      </div>
    </>
  );
}
```

`src/app/(app)/settings/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { getI18n, getPrefs } from '@/lib/prefs-server';
import { PreferencesRows } from './preferences';

export default async function SettingsPage() {
  const [{ ui }, { year }] = await Promise.all([getI18n(), getPrefs()]);
  return (
    <>
      <PageTitle title={ui.nav.settings} />
      <Card className="flex-row items-center gap-4 p-5">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-2xl font-bold">P</span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{ui.settingsProfile}</p>
          <p className="truncate text-sm text-muted-foreground">{ui.settingsEmail}</p>
        </div>
      </Card>
      <Card className="gap-0 px-5 py-3">
        <p className="py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.preferences}</p>
        <PreferencesRows year={year} />
        <div className="flex items-center gap-3 border-t py-3">
          <span className="flex-1 text-sm">{ui.currency}</span>
          <span className="text-sm text-muted-foreground">{ui.currencyValue}</span>
        </div>
      </Card>
    </>
  );
}
```

`resolvedTheme` is `undefined` during SSR, so the Segmented shows "light" until hydration. That's acceptable; it matches next-themes guidance.

- [ ] **Step 5: Build and run the e2e checks**

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm start &
pnpm test:e2e
kill %1
```

Expected: every row PASS.

- [ ] **Step 6: Commit**

```bash
git add cashflowkub
git commit -m "feat(web): plan, setup and settings screens"
```

---

### Task 14: Remove `api/` and `mobile/`, document the new app

**Files:**
- Delete: `api/`, `mobile/`
- Modify: `README.md` (repo root)
- Create: `cashflowkub/README.md`

**Interfaces:**
- Consumes: everything above. After this task the repo contains only `cashflowkub/`, `docs/` and the root README.

- [ ] **Step 1: Prove the new app is complete before deleting anything**

```bash
cd /Users/akkaraponph/Workspaces/codespaces/cashflowkub/cashflowkub
pnpm test && pnpm typecheck && pnpm lint && pnpm build
pnpm start &
pnpm test:e2e
kill %1
```

Expected: all green. **Do not continue if anything fails.**

Check that every mobile screen has a counterpart:

```bash
ls ../mobile/src/app ../mobile/src/app/'(tabs)'
find src/app/'(app)' -name page.tsx | sort
```

Expected mapping:

| Mobile | Web |
|---|---|
| `(tabs)/index` | `/` |
| `(tabs)/bills` | `/bills` |
| `(tabs)/debts` | `/debts` |
| `(tabs)/networth` | `/networth` |
| `transactions` | `/transactions` |
| `tx/[id]` | `/transactions/[id]` |
| `debt/[id]` | `/debts/[id]` |
| `day/[day]` | calendar dialog on `/bills?view=calendar` |
| `add` | header dialog |
| `menu` | sidebar / mobile sheet |
| `budgets`, `accounts`, `goals`, `reports`, `plan`, `setup`, `settings` | same paths |

- [ ] **Step 2: Delete the old apps**

```bash
cd /Users/akkaraponph/Workspaces/codespaces/cashflowkub
git rm -r -q api mobile
rm -rf api mobile   # removes untracked leftovers (node_modules, .expo, build output)
```

Leave the `cfk_db` database alone; the user can drop it when they choose.

- [ ] **Step 3: Write `cashflowkub/README.md`**

````markdown
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
````

- [ ] **Step 4: Rewrite the root `README.md`**

````markdown
# CashflowKub

A bilingual (EN / ไทย) personal-finance manager, implemented from the
[CashflowKub design](https://claude.ai/design/p/fbc1b8d4-42f4-41a5-99b8-2391260cd947)
as a single full-stack **Next.js** app in [`cashflowkub/`](cashflowkub/README.md).

| Layer    | Stack                                              |
| -------- | -------------------------------------------------- |
| UI       | Next.js 16 App Router · shadcn/ui · Tailwind v4    |
| API      | Next.js Route Handlers (`/api/v1`)                 |
| Data     | Prisma 7 · PostgreSQL                              |

Screens: Dashboard · Transactions · Bills (list + calendar) · Debts (+ schedule, avalanche/snowball) ·
Net Worth · Budgets · Accounts · Reports · Goals · Plan · Setup · Settings, with light/dark theme and EN/TH.

See [`cashflowkub/README.md`](cashflowkub/README.md) to run it.

> The earlier Go API (`api/`) and Expo app (`mobile/`) were replaced by this app. They are in git history before this commit.
````

- [ ] **Step 5: Re-verify from a clean tree and commit**

```bash
cd cashflowkub && pnpm test && pnpm build && cd ..
git add -A
git commit -m "chore: replace Go api and Expo mobile app with the Next.js app"
```

Expected: tests and build pass with `api/` and `mobile/` gone. Nothing in `cashflowkub/` imports from them; `prisma/seed-data.ts` is already a self-contained port.

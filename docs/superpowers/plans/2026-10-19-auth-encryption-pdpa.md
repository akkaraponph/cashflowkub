# Login, Data Encryption, Account Deletion and PDPA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn CashflowKub from an open single-user localhost app into a multi-user app where each person logs in, sees only their own data, has their free-text financial notes encrypted at rest, can export and permanently delete everything, and is covered by the basics of Thailand's PDPA.

**Architecture:** [Better Auth](https://www.better-auth.com) (email + password, database sessions) owns the `user`, `session`, `auth_account` and `verification` tables. Every app table gets a `user_id` foreign key with `ON DELETE CASCADE`. A request-scoped user context (`AsyncLocalStorage`, falling back to the session cookie in server components) feeds a Prisma client extension that adds `userId` to every query and write, so the ~95 existing Prisma call sites stay as they are and a missing user fails closed. The same extension encrypts a short list of free-text columns with AES-256-GCM on write and decrypts them on read.

**Tech Stack:** Next.js 16.4 App Router, Prisma 7.10 (`prisma-client` generator, `@prisma/adapter-pg`), PostgreSQL, zod 4, Vitest 5, Playwright, `better-auth` (new dependency), `node:crypto` and `node:async_hooks` (no other new dependencies).

**Spec:** none was written. This plan comes from the 2026-10-19 conversation ("plan feature login for me and encrypt data and allow user delete it also doing about PDPA"), and the decisions below are the spec. Domain background: `docs/knowledge/spreadsheet-planner.md`.

## Design decisions (the spec this plan argues from)

| # | Decision | Why |
| --- | --- | --- |
| D1 | **Multi-user, one private data set per user.** No sharing or households. | PDPA and "let the user delete it" only make sense if other people use the app. |
| D2 | **Email + password through Better Auth.** No social login, no email verification, no password reset by email in this plan. | Reset and verification need an email provider, which is the owner's choice (see "Not in this plan"). Better Auth gives hashing, sessions, rate limiting and account deletion without hand-written crypto. |
| D3 | **Tenancy is enforced in one place:** a Prisma extension with a fail-closed user context. Services do not pass `userId` around. | It's the only practical way to cover ~95 call sites, and forgetting a filter throws instead of leaking. |
| D4 | **Encryption = TLS in transit + disk encryption from the database host + application-level AES-256-GCM for free text that is never queried:** `Transaction.name`, `Transaction.note`, `DebtPayment.note`, `Debt.lender`. Amounts, dates and item/account names stay plaintext, because the app filters, sums and matches on them in SQL. | Encrypting queried columns would break every report. Free-text notes are where people write the sensitive details ("ยืมแม่", "ค่าหมอ"). |
| D5 | **Deletion is a hard delete,** cascading from `user`, behind password re-entry plus typing `DELETE` / `ลบบัญชี`. No soft delete or grace period. | PDPA right to erasure (s.33). Simple and verifiable. |
| D6 | **Export is one JSON file** with every row the user owns, encrypted fields decrypted. | PDPA rights of access and portability (s.30–31). |
| D7 | **The lawful basis is contract (PDPA s.24(3)), not consent.** Sign-up records that the user *acknowledged* privacy notice version `PRIVACY_VERSION`, with a timestamp. No marketing, no analytics, no third-party cookies, so no cookie banner. Financial data is not "sensitive data" under s.26. | Keeps the legal model honest and minimal. Only the owner (the data controller) can finalise the legal text. |
| D8 | **Existing data is kept.** The migration assigns every existing row to a placeholder user `legacy-owner`, and a script hands it to a real account by email. | The owner's dev data must not be lost. |

## Global Constraints

- New JSON request and response fields are `snake_case` (AGENTS.md). Existing row shapes returned by the API keep their current keys.
- Every new user-facing string exists in both `en` and `th` in `src/lib/i18n.ts`.
- No fallback defaults for secrets. `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `DATA_ENCRYPTION_KEY` (base64 of exactly 32 bytes) must be set, or the code that needs them throws. The seed's demo password comes from `SEED_DEMO_PASSWORD`, which has no default.
- The only new runtime dependency is `better-auth`, pinned to an exact version (no `^`).
- Minimum password length is 10.
- `PRIVACY_VERSION = '2026-10-19'`.
- Demo user: email `demo@cashflowkub.local`, name `Ploy` (the name the design comp's greeting uses).
- Whenever domain behaviour, models or APIs change, update `docs/knowledge/`. The folder is `docs/knowledge/`; AGENTS.md says `docs/knowledgebase/`, so fix that line in Task 8.
- New or changed endpoints go into `docs/postman-collections/` (create it; it doesn't exist yet).

## Review Focus

1. **User B reaches user A's row by id** (GET, PATCH, DELETE on `/transactions/:id`, `/debts/:id/payments/:paymentId`, `/bills/:id/pay`, `/plan/:id`, `/accounts/:id`). Expect 404, never the row and never 403. → Task 3 `isolation.test.ts`.
2. **Name-uniqueness checks leak across users.** User B creating an account named `Cash` while user A has one must succeed, not 409 `accountNameTaken`. → Task 3.
3. **A child row is reached through a key, not through its parent:** `billPayment.findUnique({ where: { billId_month } })`, or a debt payment by `paymentId`. The extension must still add `userId`, so B ticking A's bill or deleting A's payment gets 404 and A's rows are unchanged. Nested `create` (only the seed's `setupGoal … channels: { create }` today) must carry `userId` or fail the NOT NULL constraint. → Task 3.
4. **`DATA_ENCRYPTION_KEY` is missing or the wrong length.** Writes must throw, never store plaintext silently. A row whose ciphertext was tampered with must fail to read with an error, not return garbage. → Task 5.
5. **Account deletion while a second browser is signed in.** The second session must stop working at once, and the other user's data must be untouched. → Task 7.

---

## File map

| File | Responsibility |
| --- | --- |
| `cashflowkub/src/server/auth/auth.ts` (new) | Better Auth instance and config, plus the `PRIVACY_VERSION` check |
| `cashflowkub/src/lib/auth-client.ts` (new) | Browser client: `signIn`, `signUp`, `signOut`, `deleteUser` |
| `cashflowkub/src/app/api/auth/[...all]/route.ts` (new) | Mounts Better Auth's handler |
| `cashflowkub/src/lib/user-context.ts` (new) | `runAsUser`, `runAsSystem`, `requireUserId` |
| `cashflowkub/src/server/tenancy.ts` (new) | Pure `scopeArgs` and the `OWNED_MODELS` list |
| `cashflowkub/src/server/crypto/fields.ts` (new) | `encryptField`, `decryptField`, `decryptDeep`, `ENCRYPTED_FIELDS` |
| `cashflowkub/src/lib/db.ts` (modify) | Exports `basePrisma` (raw) and `prisma` (scoped + encrypted) |
| `cashflowkub/src/server/http.ts` (modify) | `route()` authenticates; new `publicRoute()` |
| `cashflowkub/src/server/me/service.ts` (new) | `exportUserData`, `defaultDataFor` |
| `cashflowkub/src/app/api/v1/me/export/route.ts` (new) | Export download |
| `cashflowkub/src/app/(auth)/login/page.tsx`, `signup/page.tsx`, `auth-form.tsx` (new) | Login and sign-up |
| `cashflowkub/src/app/privacy/page.tsx` (new) | Public bilingual privacy notice |
| `cashflowkub/src/app/(app)/settings/your-data.tsx` (new) | Export, sign out, delete account |
| `cashflowkub/scripts/claim-legacy-data.ts` (new) | Hands `legacy-owner` rows to a real user and encrypts their old plaintext |
| `docs/knowledge/auth-and-privacy.md` (new) | Knowledge doc, PDPA record of processing, breach runbook |

---

### Task 1: Better Auth foundation (auth tables, handler, privacy acknowledgement)

**Files:**
- Modify: `cashflowkub/package.json`, `cashflowkub/prisma/schema.prisma`, `cashflowkub/.env.example`, `cashflowkub/tests/setup/env.ts`
- Create: `cashflowkub/prisma/migrations/20261019000000_auth/migration.sql`, `cashflowkub/src/server/auth/auth.ts`, `cashflowkub/src/lib/auth-client.ts`, `cashflowkub/src/app/api/auth/[...all]/route.ts`
- Test: `cashflowkub/tests/api/auth.test.ts`

**Interfaces:**
- Produces: `auth` (Better Auth instance); `PRIVACY_VERSION: '2026-10-19'`; `getSession(headers: Headers): Promise<{ user: { id: string; email: string; name: string } } | null>` (wraps `auth.api.getSession`); `authClient` with `signIn.email`, `signUp.email`, `signOut`, `deleteUser`; Prisma models `User`, `Session`, `AuthAccount` (`@@map("auth_accounts")`), `Verification`. `User` has the extra columns `privacyVersion String @map("privacy_version")` and `privacyAcceptedAt DateTime @map("privacy_accepted_at")`.

- [ ] **Step 1: Install and confirm the API.** Run `pnpm add better-auth@<latest stable, exact>`. Check against the installed version's docs that these exist under the names this plan uses: `betterAuth`, `prismaAdapter` (`better-auth/adapters/prisma`), `toNextJsHandler` (`better-auth/next-js`), `createAuthClient` (`better-auth/react`), `hashPassword` (`better-auth/crypto`), the options `account.modelName`, `user.additionalFields`, `user.deleteUser.enabled`, `databaseHooks.user.create.before`, `emailAndPassword.minPasswordLength`. If a name differs, use the real one and write the difference into this plan before you continue.
- [ ] **Step 2: Add the models.** Run `pnpm dlx @better-auth/cli generate` to get the auth models into `schema.prisma`. Rename its `Account` model to `AuthAccount` with `@@map("auth_accounts")`, since the app already has an `Account` model. Map the tables `users`, `sessions` and `verifications`. Add the two privacy columns to `User`. Create the migration with `pnpm prisma migrate dev --create-only --name auth` and rename its folder to `20261019000000_auth`.
- [ ] **Step 3: Write the failing tests** in `tests/api/auth.test.ts`. They call `auth.handler(new Request('http://test/api/auth/sign-up/email', …))`:
  - `signs up with a 10-char password and the current privacy version` → 200; the `users` row has `privacy_version = '2026-10-19'` and `privacy_accepted_at` within 5 s of now.
  - `rejects a 9-char password` → 400.
  - `rejects sign-up without privacyVersion or with '2020-01-01'` → 400 or 422 (whatever the hook's thrown `APIError` produces), and no row is created.
  - `signs in and returns a session cookie` → the `set-cookie` header includes the session token cookie.
- [ ] **Step 4: Run them.** `pnpm test:api tests/api/auth.test.ts` → FAIL (module not found).
- [ ] **Step 5: Implement `src/server/auth/auth.ts`.**
  - Use `prismaAdapter(basePrisma, { provider: 'postgresql' })`. `basePrisma` is today's `prisma` export, renamed in Task 3. Until then, import `prisma`.
  - Set `emailAndPassword: { enabled: true, minPasswordLength: 10 }`, `account: { modelName: 'authAccount' }`, `user.additionalFields.privacyVersion` (string, required, input), `user.deleteUser: { enabled: true }`, `secret` / `baseURL` from env (throw when unset), and `rateLimit: { enabled: true }`.
  - `databaseHooks.user.create.before` rejects any `privacyVersion !== PRIVACY_VERSION` and sets `privacyAcceptedAt: new Date()`.
  - The route file is `export const { GET, POST } = toNextJsHandler(auth)`.
  - Add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`, `DATA_ENCRYPTION_KEY` and `SEED_DEMO_PASSWORD` to `.env.example`, each with a one-line comment (`openssl rand -base64 32` for the two secrets). `tests/setup/env.ts` sets fixed test values for all four.
- [ ] **Step 6: Run them again.** `pnpm test:api tests/api/auth.test.ts` → PASS. Then `pnpm test` → the whole existing suite still passes, because app tables are untouched so far.
- [ ] **Step 7: Commit:** `feat(auth): email and password sign-up with privacy acknowledgement`

### Task 2: User context and query scoping (pure)

**Files:**
- Create: `cashflowkub/src/lib/user-context.ts`, `cashflowkub/src/server/tenancy.ts`
- Test: `cashflowkub/tests/unit/tenancy.test.ts`, `cashflowkub/tests/unit/user-context.test.ts`

**Interfaces:**
- Produces:
  - `runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T>`
  - `runAsSystem<T>(fn: () => Promise<T>): Promise<T>`
  - `currentScope(): { kind: 'user'; userId: string } | { kind: 'system' } | null`
  - `requireUserId(): Promise<string>`: the ALS user if set; under `runAsSystem`, throws `Error('system scope has no user')`; with no ALS store, reads the session via `headers()` from `next/headers` (wrapped in React `cache`) and calls `redirect('/login')` from `next/navigation` when there is none.
  - `OWNED_MODELS: ReadonlySet<string>`: every app model in `schema.prisma` except the four auth models (20 names, PascalCase as Prisma passes them).
  - `COMPOSITE_KEYS: Record<string, string> = { Category: 'key', Setting: 'key' }`.
  - `scopeArgs(model: string, operation: string, args: Record<string, unknown>, userId: string): Record<string, unknown>`

- [ ] **Step 1: Write the failing tests** in `tenancy.test.ts`:
  - `findMany adds userId to where`: `scopeArgs('Transaction','findMany',{ where:{ activity:'pay' } },'u1')` → `{ where:{ activity:'pay', userId:'u1' } }`.
  - `findMany with no where`: `{}` → `{ where:{ userId:'u1' } }`.
  - `findUnique by id keeps the id and adds userId` → `{ where:{ id:5, userId:'u1' } }`.
  - `findUnique on Category by key becomes the compound key`: `{ where:{ key:'food' } }` → `{ where:{ userId_key:{ userId:'u1', key:'food' } } }`.
  - `upsert on Setting`: `{ where:{ key:'k' }, create:{ key:'k', value:'1' }, update:{ value:'2' } }` → where `userId_key`, and create gains `userId:'u1'`.
  - `create adds userId to data`; `createMany maps every row`; `createManyAndReturn` the same.
  - `update/updateMany/delete/deleteMany/count/aggregate/groupBy add userId to where`.
  - `a userId already in data or where that differs throws` (`scopeArgs('Goal','create',{ data:{ userId:'u2' } },'u1')` → throws).
  - `an unowned model is returned unchanged` (`'User'`).
  - `an unknown operation on an owned model throws` (`'findRaw'`).

  In `user-context.test.ts`: `runAsUser` exposes the id inside `fn`, including after an `await`; nested `runAsSystem` reports system; outside both, `currentScope()` is `null`.
- [ ] **Step 2: Run them.** `pnpm test:unit` → FAIL (modules missing).
- [ ] **Step 3: Implement both files.** `user-context.ts` uses one `AsyncLocalStorage`. `scopeArgs` is a `switch` on `operation`, with no Prisma import.
- [ ] **Step 4: Run them again.** `pnpm test:unit` → PASS.
- [ ] **Step 5: Commit:** `feat(tenancy): request user context and query scoping rules`

### Task 3: Every row belongs to a user

**Files:**
- Modify: `cashflowkub/prisma/schema.prisma` (all 20 app models), `cashflowkub/src/lib/db.ts`, `cashflowkub/src/server/http.ts`, `cashflowkub/src/app/api/health/route.ts`, `cashflowkub/src/server/auth/auth.ts`, `cashflowkub/prisma/seed-lib.ts`, `cashflowkub/prisma/seed-data.ts` (export `DEFAULT_CATEGORIES`), `cashflowkub/tests/api/helpers.ts`, (no service has a nested `create` today; only the seed does)
- Create: `cashflowkub/prisma/migrations/20261019010000_tenancy/migration.sql`, `cashflowkub/src/server/me/service.ts` (`defaultDataFor` only)
- Test: `cashflowkub/tests/api/isolation.test.ts`, plus every existing `tests/api/*.test.ts`, unchanged

**Interfaces:**
- Consumes: `scopeArgs`, `OWNED_MODELS`, `currentScope`, `requireUserId` (Task 2); `auth`, `getSession` (Task 1).
- Produces:
  - `basePrisma: PrismaClient` (unscoped; for auth, scripts and the seed)
  - `prisma` (scoped extended client, same delegate API)
  - `type Db = typeof prisma`: use it wherever code typed a `PrismaClient` or a transaction client
  - `route(fn)`: resolves the session from `req.headers`, answers 401 `{ error:'not signed in', code:'unauthorized' }` when there is none, and otherwise runs `fn` inside `runAsUser`
  - `publicRoute(fn)`: today's `route` behaviour, with no auth
  - `defaultDataFor(userId: string): Promise<void>`: inserts `DEFAULT_CATEGORIES` for a new user
  - `DEMO_EMAIL = 'demo@cashflowkub.local'` and `demoCookie(): Promise<string>` in `tests/api/helpers.ts`; `call()` gains `cookie?: string | null`, defaulting to `demoCookie()`, where `null` sends none

- [ ] **Step 1: Change the schema.**
  - Every app model gets `userId String @map("user_id")`, `user User @relation(fields:[userId], references:[id], onDelete: Cascade)` and `@@index([userId])`. The children (`DebtPayment`, `BillPayment`, `SetupGoalChannel`) get it too.
  - `Category.key @unique` becomes `@@unique([userId, key])`.
  - `Setting` becomes `@@id([userId, key])`.
- [ ] **Step 2: Write the migration.** Create it with `--create-only`, then hand-edit it, in order:
  1. Insert a placeholder user (`id 'legacy-owner'`, email `legacy-owner@localhost`, name `Legacy owner`, `privacy_version '2026-10-19'`, both timestamps `now()`). It has no `auth_accounts` row, so nobody can sign in as it.
  2. Add each `user_id` column `NOT NULL DEFAULT 'legacy-owner'`, then `DROP DEFAULT`.
  3. Add the FKs, indexes and the new composite keys.

  Run `pnpm prisma migrate deploy` against the dev DB and confirm with `psql` that `SELECT count(*) FROM transactions WHERE user_id='legacy-owner'` equals the old row count.
- [ ] **Step 3: Write the failing tests** in `tests/api/isolation.test.ts`. They sign up a second user `b@test.local` through `auth.handler` and pass B's cookie:
  - `a new user starts with the default categories and nothing else` → `GET /categories` returns the `DEFAULT_CATEGORIES` length; `/transactions`, `/accounts`, `/debts`, `/bills` and `/goals` return `data: []`.
  - `B gets 404 for A's rows`: for each route in Review Focus 1, using a seeded demo row id, GET, PATCH (a valid body) and DELETE all return 404. A's row is unchanged afterwards (re-read with the demo cookie).
  - `B can reuse A's names`: `POST /accounts { name:'Cash' }` as B → 201.
  - `no cookie gets 401 on a /api/v1 route`: `call(GET, { cookie: null })` → 401 with `code:'unauthorized'`.
  - `health stays public` → 200 with no cookie.
  - `B cannot tick A's bill or delete A's debt payment` → 404, and A's `bill_payments` and `debt_payments` counts are unchanged.
  - `the seed's setup-goal channels belong to the demo user`: every `basePrisma.setupGoalChannel` row has `userId` = the demo id.
- [ ] **Step 4: Run them.** `pnpm test:api` → the new file FAILS. Existing files also fail now, because there's no cookie and no user.
- [ ] **Step 5: Implement.**
  - **`db.ts`:** `basePrisma` is the current client. `prisma = basePrisma.$extends({ query: { $allModels: { $allOperations } } })`. For models in `OWNED_MODELS`, it reads `currentScope()`: with a user, `scopeArgs`; with system, it passes through; with none, it awaits `requireUserId()`.
  - **Typing:** change the type annotations that break to `Db`.
  - **Auth hook and seed:** in `auth.ts`, add `databaseHooks.user.create.after` → `runAsUser(user.id, () => defaultDataFor(user.id))`. `seedDatabase` now:
    1. truncates the four auth tables too;
    2. inside `runAsSystem`, creates the demo user with `basePrisma.user.create` plus `authAccount.create({ providerId:'credential', accountId:<user id>, password: await hashPassword(process.env.SEED_DEMO_PASSWORD) })` (throw when the env var is unset);
    3. inserts all seed data with `userId` set, categories from `DEFAULT_CATEGORIES`.
  - **Routes:** switch `health` to `publicRoute`.
- [ ] **Step 6: Run the suites.** `pnpm test:api` → PASS for every existing file, unchanged apart from `helpers.ts`, plus `isolation.test.ts`. Then `pnpm typecheck` → no errors.
- [ ] **Step 7: Commit:** `feat(tenancy): every row belongs to a user`

### Task 4: Login and sign-up screens, a protected app shell, and a privacy notice

**Files:**
- Create: `cashflowkub/src/app/(auth)/layout.tsx`, `(auth)/login/page.tsx`, `(auth)/signup/page.tsx`, `(auth)/auth-form.tsx`, `cashflowkub/src/app/privacy/page.tsx`
- Modify: `cashflowkub/src/app/(app)/layout.tsx`, `src/components/app-shell/app-header.tsx` (greeting and initial from the user's name), `src/app/(app)/settings/page.tsx` (profile card shows the real name and email), `src/lib/i18n.ts`, `tests/playwright/fixtures.ts`
- Test: `cashflowkub/tests/playwright/auth.spec.ts`, `cashflowkub/tests/e2e/pages.test.ts` (it hits pages without a cookie, so it now expects the redirect)

**Interfaces:**
- Consumes: `authClient` and `PRIVACY_VERSION` (Task 1); `getSession` and `requireUserId` (Tasks 1–2).
- Produces: `/login` and `/signup` (public); `/privacy` (public); `ui.auth.*` and `ui.privacy.*` strings in en and th. The Playwright `test` fixture is signed in as the demo user by default; the `signedIn: false` option opts out.

- [ ] **Step 1: Write the failing Playwright specs** in `auth.spec.ts`:
  - `signed-out visit to / goes to /login`.
  - `sign up → lands on dashboard with empty data and own name in the header`. The form needs email, name, a password of at least 10 characters and the privacy checkbox; with the checkbox unticked, the submit button is disabled.
  - `wrong password shows the translated error and stays on /login` (en, then th with `lang: 'th'`).
  - `sign out from settings returns to /login, and back-navigation does not show data`.
  - `/privacy renders in th with the controller contact`.
- [ ] **Step 2: Run them.** `pnpm test:pw tests/playwright/auth.spec.ts` → FAIL.
- [ ] **Step 3: Implement.**
  - **`(app)/layout.tsx`:** calls `getSession(await headers())` and `redirect('/login')` when null, then passes `user.name` / `user.email` into the shell.
  - **`auth-form.tsx`:** a client component, `mode: 'login' | 'signup'`. Sign-up sends `privacyVersion: PRIVACY_VERSION`. Better Auth's own endpoints keep its camelCase field names; that is the one exception to the snake_case rule, and it is recorded in the knowledge doc. Errors are mapped to i18n strings, never raw server text.
  - **`/privacy`:** a server page in both languages with these sections: who the controller is (`PRIVACY_CONTROLLER_NAME` and `PRIVACY_CONTACT_EMAIL` env vars; throw at render when unset), what is collected, why (to provide the service; lawful basis contract), retention (until account deletion), security (D4 in plain words), rights (access, export, correction, deletion, objection, complaint to the PDPC), cookies (strictly necessary only: session and language/theme), and the version and date.
  - **Playwright fixture:** sign in once per test through `/api/auth/sign-in/email` with `request`, then reuse the context's cookies.
- [ ] **Step 4: Run the e2e suites.** `pnpm test:pw` → PASS, existing specs included. Then `pnpm test:e2e` → PASS.
- [ ] **Step 5: Commit:** `feat(auth): login, sign-up, protected shell and privacy notice`

### Task 5: Encrypt free-text fields at rest

**Files:**
- Create: `cashflowkub/src/server/crypto/fields.ts`, `cashflowkub/scripts/claim-legacy-data.ts`
- Modify: `cashflowkub/src/lib/db.ts`, `cashflowkub/package.json` (script `"db:claim": "tsx scripts/claim-legacy-data.ts"`)
- Test: `cashflowkub/tests/unit/crypto-fields.test.ts`, `cashflowkub/tests/api/encryption.test.ts`

**Interfaces:**
- Produces:
  - `ENCRYPTED_FIELDS: Record<string, readonly string[]> = { Transaction: ['name','note'], DebtPayment: ['note'], Debt: ['lender'] }`
  - `encryptField(plain: string): string`: returns `''` for `''`, otherwise `enc:v1:<iv b64url>:<tag b64url>:<ciphertext b64url>`, with a 12-byte random IV
  - `decryptField(value: string): string`: passes through values without the `enc:v1:` prefix (legacy plaintext); throws on a bad tag
  - `decryptDeep<T>(value: T): T`: decrypts every string with the prefix anywhere in a result tree, including `Decimal` and `Date` siblings, without mangling them
  - `encryptData(model: string, data: Record<string, unknown>): Record<string, unknown>`
  - CLI `pnpm db:claim --email <email>`

- [ ] **Step 1: Write the failing unit tests:**
  - `round-trips Thai text 'ยืมแม่ 5,000 ค่าหมอ'`.
  - `the same input encrypts to different ciphertexts`.
  - `empty string stays empty`.
  - `plaintext without the prefix passes through decryptField`.
  - `a flipped ciphertext byte throws`.
  - `a missing key throws 'DATA_ENCRYPTION_KEY is not set'`, and `a 16-byte key throws 'DATA_ENCRYPTION_KEY must be 32 bytes'`. The key is read on each call, so tests can change `process.env`.
  - `decryptDeep handles arrays, nested includes ({ payments: [...] }), Dates and Prisma Decimals unchanged`.
- [ ] **Step 2: Write the failing API tests:**
  - `POST /transactions` with note `ค่าหมอ` → the response has `note:'ค่าหมอ'`. The raw `basePrisma.$queryRaw` value of `note` starts with `enc:v1:` and does not contain `ค่าหมอ`.
  - The same for a debt payment note and a debt `lender`.
  - `the transaction list returns decrypted names`.
- [ ] **Step 3: Run them.** `pnpm test:unit tests/unit/crypto-fields.test.ts && pnpm test:api tests/api/encryption.test.ts` → FAIL.
- [ ] **Step 4: Implement.** Use `createCipheriv('aes-256-gcm')`. In the `db.ts` extension, apply `encryptData` to `data` (and to `create`/`update` for upserts, and to each row for createMany) before `query`, and `decryptDeep` to the result.

  `claim-legacy-data.ts`: inside `runAsSystem`, find the user by `--email` (exit 1 when absent), reassign every owned table's `legacy-owner` rows to them in one transaction, re-encrypt any plaintext value in `ENCRYPTED_FIELDS` for those rows, delete the `legacy-owner` user, and print the row counts per table.
- [ ] **Step 5: Run them again.** `pnpm test` → PASS. Then on the dev DB: sign up the owner, run `pnpm db:claim --email <owner>`, sign in, and check that the dashboard shows the old data.
- [ ] **Step 6: Commit:** `feat(privacy): encrypt transaction and debt free text at rest`

### Task 6: Export my data

**Files:**
- Create: `cashflowkub/src/app/api/v1/me/export/route.ts`, `cashflowkub/src/app/(app)/settings/your-data.tsx`
- Modify: `cashflowkub/src/server/me/service.ts`, `cashflowkub/src/app/(app)/settings/page.tsx`, `src/lib/i18n.ts`
- Test: `cashflowkub/tests/api/export.test.ts`

**Interfaces:**
- Produces:
  - `exportUserData(): Promise<UserExport>`, where `UserExport = { format: 'cashflowkub-export', version: 1, exported_at: string, privacy: { version: string; accepted_at: string }, user: { email: string; name: string; created_at: string }, data: Record<string, unknown[]> }` and `data` is keyed by table name (`transactions`, `debt_payments`, …), one key per owned model (20)
  - `GET /api/v1/me/export` → 200 `application/json` with `Content-Disposition: attachment; filename="cashflowkub-export-YYYY-MM-DD.json"`

- [ ] **Step 1: Write the failing tests:**
  - `export contains every owned table key` (20 keys).
  - `rows match what the API lists` (compare `data.transactions.length` with the DB count).
  - `notes are decrypted`.
  - `there is no password, session token, auth_accounts or verification anywhere`: `JSON.stringify(result)` matches neither `/password|token/i` nor `/\$argon|scrypt|:[0-9a-f]{32}/`.
  - `B's export contains none of A's rows`.
- [ ] **Step 2: Run them.** `pnpm test:api tests/api/export.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `exportUserData` runs each owned model's `findMany` through the scoped `prisma`. `your-data.tsx` is a "Your data / ข้อมูลของคุณ" card with a "Download my data" link (`<a href download>`) and a short line on what it includes.
- [ ] **Step 4: Run them again.** `pnpm test:api tests/api/export.test.ts` → PASS.
- [ ] **Step 5: Commit:** `feat(privacy): export all of my data as JSON`

### Task 7: Delete my account

**Files:**
- Modify: `cashflowkub/src/app/(app)/settings/your-data.tsx`, `src/lib/i18n.ts`
- Create: `cashflowkub/src/app/(app)/settings/delete-account-dialog.tsx`
- Test: `cashflowkub/tests/api/delete-account.test.ts`, `cashflowkub/tests/playwright/delete-account.spec.ts`

**Interfaces:**
- Consumes: `authClient.deleteUser({ password })` (Task 1; Better Auth's `POST /api/auth/delete-user`).
- Produces: the settings "Delete account / ลบบัญชี" dialog. No new app endpoint.

- [ ] **Step 1: Write the failing API tests.** They sign up B, create one row in each of transactions, debts with payments, bills with payments and setup goals with channels, then sign in a *second* session for B:
  - `wrong password` → error, and nothing is deleted.
  - `correct password deletes B` → for every owned table and the four auth tables, `basePrisma.<model>.count({ where: { userId: B } })` is 0 (`id: B` for `user`).
  - `B's second session now gets 401 on /api/v1/transactions`.
  - `the demo user's row counts are unchanged`.
- [ ] **Step 2: Write the failing Playwright test:** `delete account requires typing DELETE (en) / ลบบัญชี (th) and the password, then lands on /login with a toast`. The confirm button stays disabled until both are filled in.
- [ ] **Step 3: Run them.** `pnpm test:api tests/api/delete-account.test.ts && pnpm test:pw tests/playwright/delete-account.spec.ts` → FAIL.
- [ ] **Step 4: Implement the dialog.** It explains what goes (everything, at once, and it can't be undone) and suggests downloading the export first, with a link. Deletion relies on the `ON DELETE CASCADE` from Task 3. If Better Auth's delete runs outside the user context, nothing in the app scope runs, so no extra hook is needed. Confirm this with the test.
- [ ] **Step 5: Run them again.** Both suites → PASS.
- [ ] **Step 6: Commit:** `feat(privacy): permanently delete my account and data`

### Task 8: PDPA housekeeping and documentation

**Files:**
- Modify: `cashflowkub/src/app/(app)/layout.tsx`, `cashflowkub/src/server/auth/auth.ts`, `cashflowkub/README.md`, `README.md`, `AGENTS.md` (the `docs/knowledgebase/` → `docs/knowledge/` fix), `docs/knowledge/spreadsheet-planner.md` §14 (add `User` and `user_id`)
- Create: `cashflowkub/src/app/(auth)/privacy-update/page.tsx`, `cashflowkub/src/app/api/v1/me/privacy/route.ts`, `docs/knowledge/auth-and-privacy.md`, `docs/postman-collections/cashflowkub.openapi.yaml`, `docs/postman-collections/cashflowkub.postman_collection.json`
- Test: `cashflowkub/tests/api/privacy.test.ts`

**Interfaces:**
- Produces: `POST /api/v1/me/privacy { privacy_version }` → 200 `{ privacy_version, privacy_accepted_at }`, or 400 when the version is not `PRIVACY_VERSION`. The app layout redirects to `/privacy-update` when `user.privacyVersion !== PRIVACY_VERSION`.

- [ ] **Step 1: Write the failing tests:**
  - `accepting the current version updates both columns`.
  - `an old version is rejected`.
  - `a user with an old version is redirected` (Playwright, added to `auth.spec.ts`: set the column to `'2020-01-01'` with `psql` through the reseed, visit `/`, expect `/privacy-update`, accept, land on `/`).
- [ ] **Step 2: Run them, then implement until they pass.** `pnpm test:api tests/api/privacy.test.ts && pnpm test:pw`
- [ ] **Step 3: Write `docs/knowledge/auth-and-privacy.md`.** Cover:
  - the user model and the `user_id` scope (D3), including how to run code as system;
  - the encrypted-field list and the key's format and rotation note (`v1` prefix; a future `v2` re-encrypts on read);
  - export and deletion;
  - a PDPA **record of processing** table: data category, purpose, lawful basis, retention, where it is stored;
  - a **breach runbook**: assess, notify the PDPC within 72 hours when there's a risk to rights, notify users without delay when the risk is high, keep a log;
  - the deployment requirements: TLS only, the database host's disk encryption on, `sslmode=require`, backups encrypted, and backup retention stated in the privacy notice;
  - what is still open (below).

  Replace the README's "no authentication" warning with the new env vars and the `db:claim` step.
- [ ] **Step 4: Write the OpenAPI and Postman docs.** In `docs/postman-collections/`, document `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/sign-out`, `/api/auth/delete-user`, `/api/v1/me/export`, `/api/v1/me/privacy`, the session-cookie security scheme on all `/api/v1/*`, and the 401 `unauthorized` response.
- [ ] **Step 5: Run the full verification.** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:pw` → all pass.
- [ ] **Step 6: Commit:** `docs(privacy): PDPA record, breach runbook, API collection`

---

## Not in this plan (owner decisions, raise them before going public)

- **Password reset and email verification.** These need an email provider (e.g. Resend, Amazon SES, or Cloudflare Email). Until then, a forgotten password means a lost account, so don't open public sign-up before this lands.
- **The final legal text of `/privacy`.** It needs the controller's real identity, and a review by someone qualified in Thai law. The page structure is built here, but the wording is a draft.
- **A shared rate-limit store.** Better Auth's default rate limiting is in memory, which is fine for one server instance and not for several.
- **Two-factor login, a session list, and "sign out everywhere".**
- **Whether to retire the Flutter `app/`.** It can't log in against this API.

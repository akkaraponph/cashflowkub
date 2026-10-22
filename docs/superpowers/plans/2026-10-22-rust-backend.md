# Rust Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run CashflowKub's finance backend from a private Rust service in top-level `backend/` while keeping the Next.js UI, Better Auth, existing database, and public API contracts.

**Architecture:** Next.js remains the authenticated public gateway and server renderer. It forwards finance requests to Rust with a private service token and verified user ID; Rust owns finance SQL, validation, encryption, and calculations. Cut over one domain at a time, with Rust and Next.js both reading the existing PostgreSQL schema during transition.

**Tech Stack:** Rust, Axum, Tokio, SQLx/PostgreSQL, Serde, rust_decimal, AES-256-GCM; existing Next.js 16, Better Auth, Prisma migration tooling, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-rust-backend-design.md`

## Global Constraints

- Create the service in repository-root `backend/`; keep the web app in `cashflowkub/`.
- Keep Better Auth and `/api/auth/*` in Next.js; do not write Better Auth tables from Rust.
- Preserve public `/api/v1` paths, JSON/status/error shapes, existing PostgreSQL rows, `enc:v1` ciphertext, and the four encrypted columns named in the spec.
- Use `snake_case` for new JSON request/response fields and JSONB object keys; preserve existing public compatibility exceptions.
- Keep Prisma migrations as schema owner in this project; do not introduce a second production migration history.
- Update `docs/knowledge/` for every architecture, domain, API, database, messaging, or platform change; update both files in `docs/postman-collections/` for every added or modified endpoint.
- Run all database integration tests only with `TEST_DATABASE_URL` pointing at a disposable database; never run the destructive seed against production data.

## Review Focus

1. Forged browser `x-cfk-user-id` or `Authorization`: gateway replaces both; Rust rejects direct calls with an invalid service token (Task 1 tests).
2. An ID belonging to another user in a read, update, delete, nested payment, or batch operation: return 404 or skip as the current endpoint does, with no cross-user mutation (Tasks 2, 3, 5 tests).
3. Existing `enc:v1` data, legacy plaintext, tampered ciphertext, and empty text: preserve compatible reads/writes, reject tampering (Task 1 tests).
4. Date-only input around UTC/local midnight and decimal money with two places: retain the same calendar date and exact amount (Task 3 tests).
5. A partial failure in transaction/bill/debt linked writes: roll back every affected row and derived balance (Tasks 3–5 tests).

---

## File map and ownership

| Files | Responsibility |
| --- | --- |
| `backend/Cargo.toml`, `backend/src/{lib,main,app,config}.rs` | Rust dependencies, testable library, startup, routing, required configuration |
| `backend/src/auth.rs`, `backend/src/error.rs`, `backend/src/db.rs`, `backend/src/crypto.rs` | Private caller authentication, current user, error mapping, PostgreSQL pool, compatible field encryption |
| `backend/src/{reference,transactions,bills,plan,debts,tax,analytics,export}.rs` | One finance domain per module; each owns its routes, SQL, validation, and calculations |
| `backend/tests/{boundary,reference,transactions,bills,plan,debts,tax_analytics,export}.rs` | HTTP and database behavior using disposable PostgreSQL fixtures |
| `cashflowkub/src/server/backend/client.ts` | Server-only backend reads and authenticated public route proxy |
| `cashflowkub/src/app/api/v1/**/route.ts` | Existing paths switch by domain from local service calls to `proxyToBackend` |
| `cashflowkub/src/app/(app)/**`, `cashflowkub/src/components/app-shell/shell-data.tsx` | Server rendering obtains finance data through typed backend client |
| `cashflowkub/src/server/auth/auth.ts`, `cashflowkub/src/app/(app)/layout.tsx` | Keep Better Auth; move default-data repair to a private Rust operation at final cutover |
| `docs/knowledge/rust-backend.md`, `docs/knowledge/auth-and-privacy.md`, both `docs/postman-collections/*`, READMEs | Source of truth for deployed boundary, endpoint contracts, and running both services |

### Task 1: Private service boundary and compatible storage primitives

**Files:** Create `backend/Cargo.toml`, `backend/src/{lib,main,app,config,auth,error,db,crypto}.rs`, `backend/tests/boundary.rs`, `cashflowkub/src/server/backend/client.ts`, `cashflowkub/tests/api/backend-boundary.test.ts`, `docs/knowledge/rust-backend.md`; modify root `README.md`, `cashflowkub/.env.example`, `docs/knowledge/auth-and-privacy.md`, both API contract files, and root `.gitignore`.

**Interfaces:** Produce Rust `app(state: AppState) -> Router`, `AuthUser { id: String }`, `AppState { pool: PgPool, service_token: SecretString, encryption_key: [u8; 32] }`, `encrypt_field(value: &str, key: &[u8; 32]) -> Result<String, CryptoError>`, `decrypt_field(value: &str, key: &[u8; 32]) -> Result<String, CryptoError>`; TypeScript `backendJson<T>(path: string, init?: RequestInit): Promise<T>` and `proxyToBackend(req: Request, path: string): Promise<Response>`. Both TypeScript functions resolve the Better Auth session and set replacement service headers. Rust `GET /internal/health` checks process health without user data; protected routes require both service token and user ID.

- [ ] Write boundary tests: direct Rust request with missing/wrong token is 401; missing user ID is 401; Next.js proxy given forged inbound identity headers forwards only the verified session user; a signed-out request returns existing `401 { error: "not signed in", code: "unauthorized" }`.
- [ ] Write crypto tests for `enc:v1` round-trip, legacy plaintext pass-through, empty string, wrong key length at startup, and tampered ciphertext error.
- [ ] Run `cargo test --manifest-path backend/Cargo.toml --test boundary` and `pnpm --dir cashflowkub test:api`; verify new tests fail for missing implementation.
- [ ] Implement config, SQLx pool, Axum router, `AuthUser` extractor, error envelope, crypto compatibility, Next.js server client/proxy, and env/run documentation. Set `Cache-Control: no-store` for authenticated responses; do not forward browser-supplied service headers.
- [ ] Run the same tests plus `cargo fmt --manifest-path backend/Cargo.toml --check`, `cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings`, and `pnpm --dir cashflowkub typecheck`; require all pass.
- [ ] Commit this boundary slice.

### Task 2: Reference resources and settings

**Files:** Create `backend/src/reference.rs`, `backend/tests/reference.rs`; modify `backend/src/app.rs`, `cashflowkub/src/app/api/v1/[resource]/{route.ts,[id]/route.ts}`, `cashflowkub/src/app/api/v1/settings/route.ts`, `cashflowkub/src/app/(app)/{accounts,budgets,goals}/page.tsx`, `cashflowkub/src/app/(app)/layout.tsx`, `cashflowkub/src/components/app-shell/shell-data.tsx`, `cashflowkub/tests/setup/global-setup.ts`, `docs/knowledge/rust-backend.md`, both API contract files.

**Interfaces:** Consume `AuthUser`, `AppState`, `backendJson`, `proxyToBackend`; produce Rust routes for `accounts`, `categories`, `budgets`, `goals`, `assets`, `channels`, `income-categories` (existing GET/POST collection and GET/PUT/PATCH/DELETE item methods), plus GET/PUT `/api/v1/settings`. TypeScript readers `getBackendResource<T>(name: ResourceName): Promise<T[]>` and `getBackendSettings(): Promise<AppSettings>`.

- [x] Write tests using the existing `RESOURCE_SCHEMAS` and `src/server/reference/service.ts` cases as fixtures: list envelope, create/update/delete, category `(user_id,key)` uniqueness, linked name rename, cross-user ID 404, and setting `monthlyIncome` validation.
- [x] Run `cargo test --manifest-path backend/Cargo.toml --test reference`; confirm red.
- [x] Implement SQLx queries scoped by `user_id`; use transactions for renames that update dependent rows. Switch the corresponding route handlers and Server Components to Rust client calls; preserve old route status codes and JSON shapes.
- [x] Start the Rust service against `TEST_DATABASE_URL` from API-test global setup and stop it during teardown so the existing route tests exercise the real gateway.
- [x] Update `docs/knowledge/rust-backend.md`, OpenAPI schemas and Postman requests for the cutover behavior; run Rust test, `pnpm --dir cashflowkub test:api`, typecheck, and `pnpm --dir cashflowkub test:pw accounts settings goals setup` against a disposable test DB; require pass.
- [x] Commit the reference/settings slice.

### Task 3: Transactions and batch operations

**Files:** Create `backend/src/transactions.rs`, `backend/tests/transactions.rs`; modify `backend/src/app.rs`, `cashflowkub/src/app/api/v1/transactions/{route.ts,[id]/route.ts,batch/route.ts}`, `cashflowkub/src/app/(app)/transactions/{page.tsx,[id]/page.tsx}`, `cashflowkub/src/components/app-shell/add-transaction-dialog.tsx` only if its data source changes, `cashflowkub/tests/api/encryption.test.ts`, `docs/knowledge/rust-backend.md`, both API contract files.

**Interfaces:** Produce GET/POST `/api/v1/transactions`, GET/PUT/PATCH/DELETE `/api/v1/transactions/{id}`, POST/DELETE `/api/v1/transactions/batch`, and protected GET `/internal/v1/transactions/page?page=&size=&from=&to=&type=` returning `{ rows: TxView[], total: number, page: number }`; TypeScript `getTransactionPage(filter: TxPageFilter): Promise<TxPage>` and `getBackendTransaction(id: number): Promise<TxView>`.

- [x] Write parity tests for six activities, signed amount rules, reference checks, filters and paging, batch delete limit of 1–500 positive IDs, cross-user batch skip, decimal `-45.50` retained without rounding error (the JSON number may render as `-45.5`), local-midnight date, encrypted name/note, and atomic rollback on a failed multi-row create.
- [x] Run `cargo test --manifest-path backend/Cargo.toml --test transactions`; confirm red.
- [x] Implement exact decimal parsing and SQL transactions; switch transaction route handlers and both transaction pages to Rust reads. Preserve the current `TxView` fields and date grouping behavior.
- [x] Update knowledge, OpenAPI, and Postman (including the private paging endpoint); run Rust test, Next.js API tests, typecheck, and `pnpm --dir cashflowkub test:pw transactions quick-add`; require pass.
- [x] Commit the transaction slice.

### Task 4: Bills, plan, setup, and snapshots

**Files:** Create `backend/src/{bills,plan}.rs`, `backend/tests/{bills,plan}.rs`; modify their corresponding route files in `cashflowkub/src/app/api/v1/{bills,plan,setup}/`, `cashflowkub/src/app/(app)/{bills,plan,setup}/page.tsx`, `backend/src/app.rs`, `docs/knowledge/rust-backend.md`, both API contract files.

**Interfaces:** Produce existing bill list/create/update/delete/pay/summary routes; plan list/create/update/delete/snapshots routes; GET `/api/v1/setup`. The Rust outputs retain current `BillView`, `BillSummary`, `PlanView`, `SnapshotsView`, and `SetupView` shapes; TypeScript domain readers use `backendJson<T>`.

- [ ] Write bill tests for recurrence, month/status filtering, payment toggle, due-day edge cases, and rollback when a bill payment write fails. Write plan/setup tests for invalid month, group totals, snapshot ordering, and tenant isolation.
- [ ] Run `cargo test --manifest-path backend/Cargo.toml --test bills --test plan`; confirm red.
- [ ] Implement the Rust routes and calculations; cut over each corresponding Next.js route and page after its parity test passes.
- [ ] Update knowledge, OpenAPI, and Postman; run both Rust tests, Next.js API tests, typecheck, and `pnpm --dir cashflowkub test:pw bills plan setup`; require pass.
- [ ] Commit this slice.

### Task 5: Debts, payments, schedules, and planning

**Files:** Create `backend/src/debts.rs`, `backend/tests/debts.rs`; modify `backend/src/app.rs`, all `cashflowkub/src/app/api/v1/debts/**/route.ts`, `cashflowkub/src/app/(app)/debts/**/page.tsx`, `cashflowkub/src/app/(app)/transactions/page.tsx` for debt names, `docs/knowledge/rust-backend.md`, both API contract files.

**Interfaces:** Produce all current `/api/v1/debts` methods including payments, schedule, strategy, and DSR, plus protected `/internal/v1/debts/{id}/detail` returning `DebtDetail` and `/internal/v1/debts/names` returning `{ name: string, done: boolean }[]`. TypeScript `getBackendDebtDetail(id: number): Promise<DebtDetail>` and `getBackendDebtNames(): Promise<DebtName[]>`.

- [ ] Write golden parity tests from existing `tests/unit/debt-*.test.ts` and API payment tests: fee → interest → principal allocation, excess, reopening after payment deletion, closed debt 409, different-user payment ID 404, due-day/grace cases, schedule never-pays-off, avalanche/snowball/custom ordering, DSR target range, and rollback on failed payment write.
- [ ] Run `cargo test --manifest-path backend/Cargo.toml --test debts`; confirm red.
- [ ] Implement scoped SQL, atomic payment/paid/done updates, and finance rules in Rust; cut over debt handlers and pages. Keep TypeScript client-only what-if presentation calculations until a separate UI change is justified.
- [ ] Update knowledge, OpenAPI, and Postman (including private endpoints); run Rust test, Next.js API tests, typecheck, and `pnpm --dir cashflowkub test:pw debts`; require pass.
- [ ] Commit the debt slice.

### Task 6: Tax and aggregate reads

**Files:** Create `backend/src/{tax,analytics}.rs`, `backend/tests/tax_analytics.rs`; modify `backend/src/app.rs`, routes for `/api/v1/{tax,dashboard,networth,reports}`, pages in `cashflowkub/src/app/(app)/{tax,reports,networth}/page.tsx` and `cashflowkub/src/app/(app)/page.tsx`, `docs/knowledge/rust-backend.md`, both API contract files.

**Interfaces:** Produce the existing tax GET/PUT shape `{ year, rulesYear, assumed, saved, input, result }` and dashboard/networth/reports shapes. Keep 2025 Thai tax rules pinned and mark other years `assumed: true`.

- [ ] Write parity tests for tax bracket boundaries, invalid year, assumed-year response, tenant-scoped dashboard/report totals, encrypted merchant-name handling, and empty-account aggregates.
- [ ] Run `cargo test --manifest-path backend/Cargo.toml --test tax_analytics`; confirm red.
- [ ] Implement Rust tax rules and aggregate queries; switch routes and Server Components to Rust calls.
- [ ] Update knowledge, OpenAPI, and Postman; run Rust test, Next.js API tests, typecheck, and `pnpm --dir cashflowkub test:pw tax overview`; require pass.
- [ ] Commit the tax/analytics slice.

### Task 7: Export, sign-up defaults, and removal of finance Prisma access

**Files:** Create `backend/src/export.rs`, `backend/tests/export.rs`; modify `backend/src/app.rs`, `cashflowkub/src/app/api/v1/me/export/route.ts`, `cashflowkub/src/server/auth/auth.ts`, `cashflowkub/src/app/(app)/layout.tsx`, `cashflowkub/src/server/me/service.ts`, remaining finance service imports, `docs/knowledge/{auth-and-privacy,rust-backend}.md`, both API contract files.

**Interfaces:** Produce GET `/api/v1/me/export` with existing file name/header/data format and protected POST `/internal/v1/me/default-data` that idempotently creates new-user defaults for the verified user. Keep `POST /api/v1/me/privacy` and `POST /api/auth/delete-user` in Next.js.

- [ ] Write export tests for all 20 owned tables, no `userId`, decrypted four fields, no password/session, same download header, and one user's data only. Write default-data retry test and an account-deletion cascade test for rows written by Rust.
- [ ] Run `cargo test --manifest-path backend/Cargo.toml --test export`; confirm red.
- [ ] Implement export and default-data operation; change Better Auth after-hook and app-layout repair to call Rust. Remove request-path Prisma access to owned finance tables after `rg` confirms no remaining imports; retain Prisma for Better Auth, migrations, and explicit admin scripts.
- [ ] Update knowledge, OpenAPI, and Postman; run all Rust tests, all Next.js unit/API tests, typecheck, and `pnpm --dir cashflowkub test:pw`; require pass.
- [ ] Commit the final cutover slice.

### Task 8: Deployment and rollback verification

**Files:** Create `scripts/smoke-rust-backend.sh`, `backend/README.md`, `backend/.env.example`; modify root `README.md`, `cashflowkub/README.md`, `cashflowkub/.env.example`, `docs/knowledge/{auth-and-privacy,rust-backend}.md`; modify deployment configuration only if one already exists in the target environment.

**Interfaces:** `cargo run --manifest-path backend/Cargo.toml` starts the private service; `pnpm --dir cashflowkub dev` starts the public web app; readiness checks confirm DB and both processes. Existing Prisma `db:deploy` remains the only schema deployment command.

- [ ] Write a smoke script/check that starts both processes against `TEST_DATABASE_URL`, signs in through Better Auth, calls one read and one write through public `/api/v1`, checks Rust rejects a direct uncredentialed call, and verifies a second user cannot read the first user's data.
- [ ] Run it before documentation changes and capture the missing configuration or failure.
- [ ] Document startup order, required secrets, private bind/network, TLS proxy, encrypted backups, token rotation, per-domain rollback to the previous Next.js handler revision, and the fact that account deletion still runs through Better Auth.
- [ ] Run the smoke check, `cargo test --manifest-path backend/Cargo.toml`, `pnpm --dir cashflowkub test`, `pnpm --dir cashflowkub typecheck`, and `pnpm --dir cashflowkub test:pw` against a disposable database; require pass. Review `rg -n 'from .@/server/.*/service|@/lib/db' 'cashflowkub/src/app/(app)' cashflowkub/src/app/api/v1` and resolve remaining owned-data access.
- [ ] Commit deployment documentation and verification.

## Self-review notes

- All existing finance route groups are assigned to Tasks 2–7; Better Auth and privacy acknowledgement remain deliberately with Next.js.
- The three private read routes and default-data route are assigned to owning tasks and must appear in both API contract files.
- Task tests cover the five failure classes in Review Focus. Each slice has a failing test, implementation, passing verification, and commit gate.
- This plan makes an architectural call about auth ownership; review the design spec's explicit calls before implementation.

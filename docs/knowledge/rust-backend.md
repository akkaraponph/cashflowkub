# Rust backend boundary and rollout

## Backend architecture status

The runtime composition now has explicit inbound HTTP and outbound PostgreSQL adapter modules: `backend/src/adapters/inbound/http.rs` owns Axum router composition, `backend/src/adapters/outbound/postgres.rs` owns pool creation, and `backend/src/application/startup.rs` builds runtime state and selects those adapters. This is the composition shell for a hexagonal architecture.

The finance feature modules (`reference`, `transactions`, `bills`, `plan`, `debts`, `tax`, `analytics`, and `export`) still combine Axum handlers, application rules, and SQLx queries. They are not fully hexagonal yet because use cases do not call domain repository ports. New feature work must put transport mapping in inbound adapters, behavior in application/domain modules, and SQL in outbound repository adapters. Existing features require migration before the backend can be considered fully hexagonal.

The Rust service lives at repository-root `backend/`. It uses Axum and SQLx with the existing PostgreSQL schema. Prisma remains responsible for migrations and Better Auth's four tables; Rust owns finance SQL and rules as each domain is moved.

## Request boundary

Next.js remains the public origin. Browser calls keep their `/api/v1` URLs and pass through authenticated Next.js route handlers. The gateway resolves the Better Auth session, discards caller supplied `Authorization` and `x-cfk-user-id`, and sends the verified user ID with `BACKEND_SERVICE_TOKEN`. Server Components call the same Rust service through a server-only client that resolves the incoming session first. Rust checks the service token and user ID before handling protected routes. Bind Rust to a private interface and keep its port off the public network.

Better Auth continues to own sign-up, sign-in, sign-out, account deletion, sessions, and privacy acknowledgement. The only exception is the opt-in local startup seed: when `SEED_ACCOUNTS_ENABLED=true`, Rust creates or resets the two configured test credentials in `users` and `auth_accounts`, revokes their sessions, and adds default categories. This seed is disabled by default; Rust does not otherwise write `users`, `sessions`, `auth_accounts`, or `verifications`.

Every request that reaches Rust is logged to stderr as `[rust-api] METHOD /path -> STATUS in Nms`, including internal and health routes. Query parameters, headers, and bodies are omitted so filters, credentials, and personal data are not written to request logs. Next.js browser-facing finance routes use the server-only `proxyToBackend` gateway; `/api/v1/me/privacy` remains a Next.js-owned exception.

## Data rules

- Every query against an owned finance table scopes by the authenticated `user_id`, including joins, updates, deletes, nested payments, and aggregates. A row belonging to someone else responds as not found.
- Keep `Transaction.amount`, `interest`, and `fee` as exact decimal values with two decimal places; existing integer baht columns remain integers.
- Treat PostgreSQL date-only values as calendar dates and serialize them as `YYYY-MM-DD` without timezone conversion.
- Maintain AES-256-GCM `enc:v1:<iv>:<tag>:<ciphertext>` compatibility for `Transaction.name`, `Transaction.note`, `DebtPayment.note`, and `Debt.lender`. Legacy plaintext passes through on read. Tampered ciphertext fails closed. Empty strings remain empty. `DATA_ENCRYPTION_KEY` is base64 encoding exactly 32 bytes and has no fallback.
- Public responses retain their existing fields and envelopes. New JSON fields and JSONB keys use `snake_case` unless preserving an existing compatibility contract.

## Environment and rollout status

The service requires `DATABASE_URL`, `DATA_ENCRYPTION_KEY`, and `BACKEND_SERVICE_TOKEN`. Next.js reads `BACKEND_URL` and `BACKEND_SERVICE_TOKEN`; those values are server-only and never use a `NEXT_PUBLIC_` prefix. Generate the service token with `openssl rand -base64 32`, store the same value only in the private Rust and Next.js environments, and rotate both together. The web `.env.example` includes the gateway values. The accounts, categories, budgets, goals, assets, channels, income-categories, and settings endpoints now proxy to Rust. Transaction CRUD, batch operations, and the private paged reader now use Rust. Bills, bill summaries and payment toggles, plan items, and asset snapshot reads now use Rust. Debt APIs, schedules, repayment planning, DSR, debt page reads, and setup reads now use Rust behind the authenticated Next.js gateway. Gateway upstream failures return a stable 502 response and never expose the private backend URL.

For local development, configure `backend/.env` and `frontend/.env`, then run `make dev` from the repository root to launch both services. `make backend` and `make frontend` start either service independently.

The implementation plan is [Rust Backend Implementation Plan](../superpowers/plans/2026-10-22-rust-backend.md), based on [the design](../superpowers/specs/2026-10-22-rust-backend-design.md). Update this page after each domain cutover and record the endpoints that now use Rust.

Related existing constraints: [auth, tenancy, encryption and privacy](auth-and-privacy.md), [CashflowKub planner domain](spreadsheet-planner.md).

## Current cutover: reference data and settings

The following public session-authenticated routes remain at the Next.js origin and proxy to the private Rust service: `GET/POST /api/v1/{resource}`, `GET/PUT/PATCH/DELETE /api/v1/{resource}/{id}`, and `GET/PUT /api/v1/settings`. Allowed resources are `accounts`, `categories`, `budgets`, `goals`, `assets`, `channels`, and `income-categories`. Collection responses retain `{ data: [...] }`; create, get, and update return the row; delete returns 204. Fields retain the existing UI contract (including camelCase fields such as `startDate` and `monthlyIncome`). Rust validates fields and values, scopes every query to the verified user, preserves transaction references when renaming accounts/goals/channels/income categories, and rejects deleting referenced names.

Settings currently expose `monthlyIncome` as a non-negative integer. A missing value falls back to that user's latest monthly cashflow income. The Next.js session gateway overwrites identity headers and adds `Cache-Control: no-store`; callers must never call Rust directly from a browser.


## Current cutover: transactions

`/api/v1/transactions` supports filtered list/create, `/api/v1/transactions/{id}` supports read/update/delete, and `/api/v1/transactions/batch` supports atomic create and user-scoped delete. The public Next.js session gateway forwards browser calls. The transaction Server Components use Rust's `/internal/v1/transactions/page` reader for sorted, filtered pages. Rust keeps signed exact-decimal amounts, validates all six activity rules and user-owned references, encrypts `name` and `note` with the shared AES-GCM key, preserves date-only values, and performs multi-row create in one database transaction.

The desktop transactions sheet debounces valid row edits for 700 ms and sends them through the authenticated Next.js gateway to Rust. Leaving a row flushes its pending save, and deleting a row waits for its pending save first. Incomplete rows remain unsaved until the user completes them.

## Current cutover: debts and setup

The public `/api/v1/debts` collection, item, payment, schedule, DSR, and strategy routes are session-authenticated Next.js proxies to Rust. Server rendering uses private Rust readers for debt details and debt names. `/api/v1/setup` also proxies to Rust so its embedded debt view comes from the same implementation. Rust scopes reads and writes to the verified user, encrypts lender and payment note fields with the shared key, serializes repayment ledger changes in database transactions, and preserves existing payment allocation and payoff-planning behavior.

## Current cutover: tax and aggregate views

`GET/PUT /api/v1/tax` preserve the existing tax plan contract, pinned 2025 Thai rules, assumed rules for other years, validated saved inputs, and monthly income fallback. `GET /api/v1/dashboard`, `/api/v1/networth`, and `/api/v1/reports` return the existing view shapes from user-scoped SQL. Reports decrypt transaction merchant names before grouping; Next.js browser requests still use the public gateway and server-rendered pages use the authenticated server client.

## Current cutover: export and sign-up defaults

`GET /api/v1/me/export` streams the existing JSON download shape, with all 20 owned tables, no owner IDs or auth tables, and the four encrypted fields decrypted. The private `POST /internal/v1/me/default-data` inserts the nine standard categories with per-user unique-key conflict handling; Better Auth remains responsible for creating and deleting user records.

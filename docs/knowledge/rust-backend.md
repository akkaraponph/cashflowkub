# Rust backend boundary and rollout

The Rust service lives at repository-root `backend/`. It uses Axum and SQLx with the existing PostgreSQL schema. Prisma remains responsible for migrations and Better Auth's four tables; Rust owns finance SQL and rules as each domain is moved.

## Request boundary

Next.js remains the public origin. Browser calls keep their `/api/v1` URLs and pass through authenticated Next.js route handlers. The gateway resolves the Better Auth session, discards caller supplied `Authorization` and `x-cfk-user-id`, and sends the verified user ID with `BACKEND_SERVICE_TOKEN`. Server Components call the same Rust service through a server-only client that resolves the incoming session first. Rust checks the service token and user ID before handling protected routes. Bind Rust to a private interface and keep its port off the public network.

Better Auth continues to own sign-up, sign-in, sign-out, account deletion, sessions, and privacy acknowledgement. Rust must not write `users`, `sessions`, `auth_accounts`, or `verifications` except reading the verified user ID's foreign key relationship through the finance schema.

## Data rules

- Every query against an owned finance table scopes by the authenticated `user_id`, including joins, updates, deletes, nested payments, and aggregates. A row belonging to someone else responds as not found.
- Keep `Transaction.amount`, `interest`, and `fee` as exact decimal values with two decimal places; existing integer baht columns remain integers.
- Treat PostgreSQL date-only values as calendar dates and serialize them as `YYYY-MM-DD` without timezone conversion.
- Maintain AES-256-GCM `enc:v1:<iv>:<tag>:<ciphertext>` compatibility for `Transaction.name`, `Transaction.note`, `DebtPayment.note`, and `Debt.lender`. Legacy plaintext passes through on read. Tampered ciphertext fails closed. Empty strings remain empty. `DATA_ENCRYPTION_KEY` is base64 encoding exactly 32 bytes and has no fallback.
- Public responses retain their existing fields and envelopes. New JSON fields and JSONB keys use `snake_case` unless preserving an existing compatibility contract.

## Environment and rollout status

The service requires `DATABASE_URL`, `DATA_ENCRYPTION_KEY`, and `BACKEND_SERVICE_TOKEN`. Next.js reads `BACKEND_URL` and `BACKEND_SERVICE_TOKEN`. Generate the service token with `openssl rand -base64 32`, store the same value only in the private Rust and Next.js environments, and rotate both together. The web `.env.example` includes the gateway values. The accounts, categories, budgets, goals, assets, channels, income-categories, and settings endpoints now proxy to Rust. Transactions and debt endpoints remain on their Next.js services until their planned cutovers.

The implementation plan is [Rust Backend Implementation Plan](../superpowers/plans/2026-10-22-rust-backend.md), based on [the design](../superpowers/specs/2026-10-22-rust-backend-design.md). Update this page after each domain cutover and record the endpoints that now use Rust.

Related existing constraints: [auth, tenancy, encryption and privacy](auth-and-privacy.md), [CashflowKub planner domain](spreadsheet-planner.md).

## Current cutover: reference data and settings

The following public session-authenticated routes remain at the Next.js origin and proxy to the private Rust service: `GET/POST /api/v1/{resource}`, `GET/PUT/PATCH/DELETE /api/v1/{resource}/{id}`, and `GET/PUT /api/v1/settings`. Allowed resources are `accounts`, `categories`, `budgets`, `goals`, `assets`, `channels`, and `income-categories`. Collection responses retain `{ data: [...] }`; create, get, and update return the row; delete returns 204. Fields retain the existing UI contract (including camelCase fields such as `startDate` and `monthlyIncome`). Rust validates fields and values, scopes every query to the verified user, preserves transaction references when renaming accounts/goals/channels/income categories, and rejects deleting referenced names.

Settings currently expose `monthlyIncome` as a non-negative integer. A missing value falls back to that user's latest monthly cashflow income. The Next.js session gateway overwrites identity headers and adds `Cache-Control: no-store`; callers must never call Rust directly from a browser.

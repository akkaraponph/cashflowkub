# Rust backend for CashflowKub: design

## Intent

Move CashflowKub's finance API, persistence, and server-side calculations from the Next.js process into a Rust service in the repository's top-level `backend/` directory. Keep the existing Next.js UI and public URLs. The goal is a clear backend boundary without a data migration or a forced change to how users sign in.

## Current system and constraints

- The web app is in `cashflowkub/` (Next.js 16). Its `/api/v1` route handlers and Server Components both call `src/server/*/service.ts` directly. Browser mutations use `src/lib/api-client.ts` and `/api/v1`.
- PostgreSQL tables and migrations are defined by `cashflowkub/prisma/schema.prisma`. Better Auth owns users, sessions, credentials, and sign-in under `/api/auth/*`. The 20 finance tables are scoped by `user_id` through a Prisma extension.
- The existing app encrypts `Transaction.name`, `Transaction.note`, `DebtPayment.note`, and `Debt.lender` as `enc:v1:<iv>:<tag>:<ciphertext>` with `DATA_ENCRYPTION_KEY`. Existing ciphertext must remain readable and new writes must use the same format.
- The existing public JSON and error shapes, decimal/date behavior, status codes, `/api/v1` paths, export format, and EN/TH UI are compatibility requirements. JSON request/response fields and JSONB keys added by this work use `snake_case`.
- `docs/knowledge/auth-and-privacy.md`, `docs/knowledge/spreadsheet-planner.md`, and the current route handlers/services are the behavioral source of truth. `docs/agents/domain.md`, `RTK.md`, `CONTEXT.md`, and `docs/adr/` are absent in this checkout.

## Boundary

Next.js remains the public origin. Better Auth stays in Next.js and remains the only writer of its four auth tables. Every browser `/api/v1` call continues through a Next.js route handler. The handler validates the Better Auth session and forwards the request to Rust with `x-cfk-user-id` plus a private `Authorization: Bearer <BACKEND_SERVICE_TOKEN>` credential. Next.js Server Components use a server-only Rust client that performs the same session check. Rust is reachable only on a private interface/network and rejects missing or invalid service credentials before using the user ID. It never trusts a user ID or credential supplied by the browser; the gateway strips and replaces both headers. Sign-in, sign-out, sign-up, account deletion, and privacy acknowledgement remain in Next.js because they are coupled to Better Auth. Finance export moves to Rust after all finance tables move.

`BACKEND_URL` and `BACKEND_SERVICE_TOKEN` are required in Next.js after a domain is cut over. `DATABASE_URL`, `DATA_ENCRYPTION_KEY`, and `BACKEND_SERVICE_TOKEN` are required by Rust. A single shared secret is acceptable for the private, single-origin deployment in this plan; rotating it must support changing both services together. Do not expose the Rust port publicly.

## Data and contract strategy

- Rust uses Axum for HTTP and SQLx for PostgreSQL. The existing Prisma migration history remains the schema owner initially; Rust adds no parallel migration system. SQL always includes `user_id` in owned-table reads, writes, joins, updates, and deletes. Multi-row finance writes run in database transactions.
- Money in `transactions.amount`, `interest`, and `fee` uses exact decimal types with two fractional digits, matching the database. Existing integer baht fields stay integers. Dates at the API boundary are `YYYY-MM-DD`; timestamps and date-only columns must not shift with server timezone.
- Rust implements the current `/api/v1` behavior with compatibility tests derived from Next.js API tests and fixture outputs. Preserve `404` for another user's row, `401` for an unauthenticated public request, `{ "data": [...] }` for list responses, and existing error payloads.
- Public routes are cut over by domain. Each existing Next.js route file becomes a thin authenticated proxy only when its Rust endpoint and SSR consumer pass parity tests. Server Components switch from direct Prisma services to a server-only typed backend client in the same domain slice. Keep pure UI formatting code in TypeScript as needed; Rust owns authoritative finance calculations and validation.
- Add private read endpoints only where Server Components need data unavailable from current public endpoints: `GET /internal/v1/transactions/page?page=&size=&from=&to=&type=` returning `{ rows, total, page }`, `GET /internal/v1/debts/{id}/detail` returning the existing `DebtDetail` shape, and `GET /internal/v1/debts/names` returning `{ name, done }[]`. These are service-token protected and documented alongside the public API.

## Delivery order

1. Establish Rust server, private authentication boundary, database pool, errors, crypto, a server-only Next.js client, and a public gateway. Prove tenant isolation and ciphertext compatibility before moving data routes.
2. Move reference resources and settings, then transactions and batch operations, then bills and plan/setup, then debts and their payments/planning, then tax and aggregate reads. Move each domain's Next.js API handlers and Server Components together.
3. Move finance export after all 20 owned tables can be read through Rust. Keep privacy acknowledgement and account deletion in Next.js; verify deletion cascades across rows Rust creates.
4. Update knowledge base, OpenAPI, Postman, runbooks, and local/deployment startup instructions with every cutover. Remove dead Prisma service imports only after full parity and browser tests pass. Keep Prisma schema/migration tooling for schema ownership and Better Auth.

## Completion criteria

- All finance `/api/v1` endpoints and server-rendered pages obtain finance data from Rust; no Next.js request path uses Prisma for an owned finance table except the Better Auth sign-up default-data repair until that repair is moved into a Rust internal operation.
- Better Auth login and PDPA flows still work; a forged `x-cfk-user-id`, missing service token, cross-user ID, bad ciphertext, and bad/unknown transaction or debt input fail without leaking data.
- Existing unit, API, and Playwright suites pass against the cutover architecture, and Rust integration tests pass against a disposable PostgreSQL test database.
- The existing database requires no destructive reset, and the deployment can roll back one domain at a time before old handlers are removed.

## Explicit design calls to review

- Better Auth remains in Next.js; Rust owns finance data and rules, not credentials or sessions.
- The Rust service is private and trusts only a service credential plus a user ID supplied by the authenticated Next.js gateway.
- Prisma retains schema migration ownership initially to avoid simultaneous schema migration systems.
- Existing public API shapes are preserved; three private read endpoints support current Server Components.

## Implementation references

- [Axum router and shared state](https://docs.rs/axum/latest/axum/struct.Router.html)
- [SQLx PostgreSQL row mapping](https://docs.rs/sqlx/latest/sqlx/fn.query_as.html)
- [Better Auth server-side session lookup](https://better-auth.com/docs/basic-usage)

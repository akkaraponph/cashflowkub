# CashflowKub

A bilingual (EN / ไทย) personal-finance manager, implemented from the
[CashflowKub design](https://claude.ai/design/p/fbc1b8d4-42f4-41a5-99b8-2391260cd947)
as a Next.js web app in [`frontend/`](frontend/README.md) with a Rust finance service in [`backend/`](backend/README.md).

| Layer    | Stack                                              |
| -------- | -------------------------------------------------- |
| UI       | Next.js 16 App Router · shadcn/ui · Tailwind v4    |
| API      | Next.js authenticated proxy (`/api/v1`) → Axum Rust service |
| Data     | SQLx/PostgreSQL (Prisma owns schema migrations)    |
| Auth     | Better Auth (email + password) · per-user data     |

Finance APIs and data access run in the private Rust service. Next.js owns the public origin, Better Auth sessions, UI, and server-rendered pages. Browser requests never receive the Rust URL or service token. See [`docs/knowledge/rust-backend.md`](docs/knowledge/rust-backend.md) for the boundary and rollback details.

Screens: Dashboard · Transactions · Bills (list + calendar) · Debts (+ schedule, avalanche/snowball) ·
Net Worth · Budgets · Accounts · Reports · Goals · Plan · Setup · Settings, with light/dark theme and EN/TH.

Each person signs in and sees only their own data; free-text notes are encrypted at rest, and a user can export or permanently delete
everything (PDPA). See [`docs/knowledge/auth-and-privacy.md`](docs/knowledge/auth-and-privacy.md). The privacy notice is a draft and password reset
is not built yet, so do not open sign-up to the public before those are done.

Run both services with `make dev` after configuring `backend/.env` and `frontend/.env`. The command starts Rust and Next.js together; use Ctrl+C to stop both. See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md) for setup details. The app needs `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATA_ENCRYPTION_KEY`,
`SEED_DEMO_PASSWORD` and the two `PRIVACY_*` variables; existing data is handed to your account with `pnpm --dir frontend db:claim --email <your email>`.

> The earlier Go API (`api/`) and Expo app (`mobile/`) were replaced by this app. They are in git history before this commit.

## Flutter app (`app/`)

`app/` is the earlier Flutter client. It expects the Go REST API on `:8080` (`--dart-define=API_BASE_URL`),
and that Go API (`api/`) was removed when the Next.js app replaced it, so **`app/` currently has no backend**.
It has not been touched or removed. Options: restore `api/` from git history, repoint `app/` at the Next.js
API (`/api/v1`; response shapes may differ and need checking), or retire `app/`. This is a product decision
that is still open.

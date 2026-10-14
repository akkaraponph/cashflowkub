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

## Flutter app (`app/`)

`app/` is the earlier Flutter client. It expects the Go REST API on `:8080` (`--dart-define=API_BASE_URL`),
and that Go API (`api/`) was removed when the Next.js app replaced it, so **`app/` currently has no backend**.
It has not been touched or removed. Options: restore `api/` from git history, repoint `app/` at the Next.js
API (`/api/v1`; response shapes may differ and need checking), or retire `app/`. This is a product decision
that is still open.

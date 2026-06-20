# CashflowKub

A bilingual (EN / ไทย) personal-finance manager — implemented from the
[CashflowKub design](https://claude.ai/design/p/fbc1b8d4-42f4-41a5-99b8-2391260cd947)
as a **React Native (Expo)** app backed by a **Go (Fiber v3) REST API**.

| Part   | Stack                                                                   |
| ------ | ----------------------------------------------------------------------- |
| `api/`    | Go 1.26 · Fiber v3 · GORM · PostgreSQL                                |
| `mobile/` | Expo SDK 56 · Expo Router · NativeWind (Tailwind) · React Query · lucide |

> **Why NativeWind + react-native-reusables and not shadcn/Radix?** shadcn/ui and
> Radix are DOM-only and can't run in React Native. NativeWind brings the same
> Tailwind authoring model to RN, and the UI primitives in `mobile/src/components/ui`
> follow the copy-in, accessible, variant-driven philosophy of react-native-reusables.
> The design's OKLCH theme tokens are ported to `mobile/src/global.css`.

## Features

The full app — **12 screens** plus detail/overlay flows:

Dashboard · Transactions · Bills (list + calendar) · Debts (+ amortization
schedule, avalanche/snowball) · Net Worth · Budgets · Accounts · Reports ·
Goals · Plan (plan-vs-actual + asset snapshots) · Setup (categories, channels,
accounts, debts, goals) · Settings.

Light/dark theme, EN/TH language toggle, financial-year scope, add-transaction
sheet, and a Thai-baht finance dataset seeded from the design.

---

## 1. Run the API

```bash
cd api
cp .env.example .env          # default DATABASE_URL points at localhost/cfk_db
go mod tidy
go run .                      # migrate + seed + serve on :8080
```

No local Postgres? `docker compose up -d postgres` (in `api/`) starts one matching
the defaults. The server auto-migrates and seeds on boot. Verify:

```bash
curl localhost:8080/health
curl localhost:8080/api/v1/dashboard
```

See [`api/README.md`](api/README.md) for the full endpoint list.

## 2. Run the mobile app

```bash
cd mobile
npm install
npx expo start            # press i (iOS), a (Android), or w (web)
```

The app finds the API automatically:
- **iOS simulator / web** → `http://localhost:8080`
- **Physical device** → `http://<your-laptop-ip>:8080` (derived from the Metro host)
- Override anytime with `EXPO_PUBLIC_API_URL` (see `mobile/.env.example`; Android
  emulator uses `http://10.0.2.2:8080`).

> Start the API first so the device can reach it on your network.

---

## Project layout

```
cashflowkub/
├── api/                         # Go Fiber v3 + GORM + Postgres
│   ├── main.go                  # config → db → migrate → seed → serve
│   └── internal/{config,database,models,seed,handlers,routes}
└── mobile/                      # Expo app
    └── src/
        ├── app/                 # Expo Router screens (file-based)
        │   ├── (tabs)/          # Dashboard, Bills, Debts, Net Worth + tab bar
        │   ├── *.tsx            # Transactions, Budgets, Accounts, Reports, Goals, Plan, Setup, Settings
        │   ├── add / menu       # modals
        │   └── tx,debt,day/[..] # detail routes
        ├── components/          # AppHeader, TabBar, Icon, charts, ui/ primitives
        └── lib/                 # api client, hooks, i18n, store, theme, format
```

## Verify

```bash
# API
cd api && go vet ./... && go build ./...

# Mobile
cd mobile && npx tsc --noEmit && npx expo export -p ios   # type-checks + bundles
```

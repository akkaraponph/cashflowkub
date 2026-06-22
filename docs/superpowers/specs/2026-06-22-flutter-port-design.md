# CashflowKub — Flutter port (`mobile/` → `app/`)

**Date:** 2026-06-22
**Status:** Approved design, pending spec review

## Goal

Replace the Expo / React Native app (`mobile/`) with a faithful, feature-complete
Flutter app in `app/`, talking to the **same Go API** (`http://<host>:8080/api/v1`).
Same screens, same EN/TH + light/dark + financial-year scope, same visuals and
behaviour. When parity is verified: **delete `mobile/`** and rewrite the root
`README.md` for the Flutter stack.

The Go API (`api/`) is **not touched**.

## Decisions (locked)

| Area | Choice | Rationale |
| --- | --- | --- |
| State + server cache | **flutter_riverpod** | Maps cleanly to React Query (`FutureProvider` + `ref.invalidate`) and Zustand (a prefs `Notifier`). |
| HTTP | **http** package | Lean, official; mirrors the thin `fetch` wrapper. |
| Prefs persistence | **shared_preferences** | Replaces AsyncStorage for lang/theme/year. |
| Navigation | **go_router** | Shell route w/ bottom tabs + push/modal routes; replaces Expo Router. |
| Icons | **lucide_icons** package | Exact glyph parity with the lucide names used across the design/API. Fallback if rejected: hand-map to Material Icons. |
| Charts | **hand-rolled `CustomPainter`** | No chart dependency; faithful to the existing simple SVG bars/donut/trend. |
| Fonts | Platform fonts | Thai renders via system fallback; no bundled font to keep it minimal. |
| Cleanup | **Delete `mobile/`** after verified parity; rewrite root README | Explicitly requested. Recoverable from git history. |

## Source inventory (`mobile/src`, ~3,630 LOC)

### Library layer (`lib/`)
- `api.ts` — base-URL resolution + thin typed `fetch` client (`get/post/put/patch/del`, `getList`). API errors carry status + message. List endpoints wrap payloads in `{ data: [...] }`.
- `types.ts` — all response shapes (Account, Category, Transaction, Budget, Goal, Debt, Asset, Bill, Channel, IncomeCategory, PlanItem, MonthCashflow, NetWorthPoint, CategorySpend, Dashboard, NetWorth, Reports, DebtSchedule/ScheduleRow, BillsSummary, Plan/PlanGroup, AssetSnapshots/AssetSnapshotItem, Setup/SetupGoal/SetupGoalChannel).
- `hooks.ts` — React Query hooks + query keys (`qk`) per resource; 3 mutations (create transaction, toggle bill paid, pay debt) with explicit invalidation sets.
- `store.ts` — Zustand persisted prefs: `lang`, `theme`, `year` (+ `YEARS=[2024..2028]`, `CURRENT_YEAR=2026`), `hydrated`.
- `format.ts` — manual money/number formatting: `fmt`, `signed`, `compact`, `pct`, `clamp01`, comma grouping. No `Intl`.
- `theme.ts` — `TINTS` (file-type accents, per mode), `HERO`/`BRAND` gradients, `PALETTE` (semantic hexes per mode) for chart fills.
- `i18n.ts` — EN/TH dict (`DICT`), incl. nested `nav`, `strategyTip`, setup/plan strings.
- `useColors.ts`, `useI18n.ts`, `cn.ts` — small hooks/util.
- `global.css` — OKLCH→hex theme tokens (`:root` light, `.dark` dark) + radii.

### Components (`components/`)
- `AppHeader.tsx` — brand mark (or back chevron), title, **year stepper** (prev/next within YEARS), **EN/TH** toggle, **light/dark** toggle, **menu** button → `/menu`.
- `TabBar.tsx` — 4 tabs (dashboard, bills, debts, networth) + center **FAB** (gradient) → `/add`.
- `Icon.tsx` — lucide glyph by kebab name; theme-foreground default colour.
- `charts.tsx` — `CashflowBars`, `MiniBars`, `Donut` (centered label/value), `TrendChart` (filled polyline).
- `nav.ts` — `NAV_ITEMS` (12) + `TAB_KEYS` (4).
- `ui/` — `text`, `card` (+ `CARD_SHADOW`), `button`, `badge` (+ `Tone`), `tile`, `progress` (+ `SplitBar`), `segmented` (+ `SegOption`), `screen` (`Screen`, `Loading`, `ErrorState`, `Empty`), `row` (`ListRow`).

### Screens (`app/`)
Tabs: `(tabs)/index` (Dashboard), `(tabs)/bills`, `(tabs)/debts`, `(tabs)/networth`.
Stack: `transactions`, `budgets`, `accounts`, `reports`, `goals`, `plan`, `setup`, `settings`.
Modals/detail: `add` (add-transaction sheet), `menu` (More), `tx/[id]`, `debt/[id]`, `day/[day]`.

> The implementation plan will read each `mobile/src/app/*.tsx` to capture exact
> per-screen behaviour before porting, so no feature is dropped.

## Target architecture (`app/lib/`)

```
main.dart                     # ProviderScope + MaterialApp.router; theme follows prefs
src/
  core/
    api_client.dart           # ApiClient over http; ApiException(status,message); getList()
    format.dart               # fmt/signed/compact/pct/clamp01 (port of format.ts)
    palette.dart              # AppPalette per mode (hexes from theme.ts + global.css); TINTS/HERO/BRAND
    theme.dart                # ThemeData light/dark from AppPalette
    i18n.dart                 # Strings EN/TH map; lookup by key (incl. nested nav/strategyTip)
    prefs.dart                # PrefsNotifier (lang/theme/year) + shared_preferences; YEARS, CURRENT_YEAR
    nav.dart                  # NAV_ITEMS + TAB_KEYS
  models/
    models.dart               # Dart classes mirroring types.ts w/ fromJson (+ enums where typed)
  data/
    providers.dart            # apiClientProvider + FutureProviders per resource + mutation methods
  widgets/
    app_header.dart, tab_bar.dart, app_icon.dart, charts.dart
    ui/ text.dart, card.dart, button.dart, badge.dart, tile.dart,
        progress.dart, segmented.dart, screen_states.dart, list_row.dart
  router.dart                 # go_router: StatefulShellRoute (tabs) + push/modal routes
  screens/
    dashboard.dart, transactions.dart, bills.dart, debts.dart, networth.dart,
    budgets.dart, accounts.dart, reports.dart, goals.dart, plan.dart,
    setup.dart, settings.dart,
    add_transaction.dart, menu.dart, day_detail.dart, debt_detail.dart, tx_detail.dart
```

### Data layer parity (mutations → invalidations)
- **create transaction** → invalidate transactions, dashboard, accounts.
- **toggle bill paid** → invalidate bills (all filters), bills summary, dashboard.
- **pay debt** (optional extra amount) → invalidate debts, that debt, that debt's schedule, dashboard, networth.

Read providers (one per resource, parameterised where the hook is): dashboard,
transactions(filter), accounts, categories, budgets, goals, channels,
debts(status), debt(id), debtSchedule(id), bills(status), billsSummary,
networth, reports, plan, assetSnapshots, setup.

### Base-URL resolution (`api_client.dart`)
1. `--dart-define=API_BASE_URL=...` if provided (strip trailing `/`).
2. Else platform default on `:8080`: Android → `http://10.0.2.2:8080`, iOS sim /
   macOS / web / others → `http://localhost:8080`.
3. Physical devices: pass `--dart-define`. (Flutter has no Metro host to derive.)

### Theming
`AppPalette` holds the same hexes per mode (background, foreground, card, primary,
secondary, mutedForeground, destructive, border, plus TINTS/HERO/BRAND). `theme.dart`
builds `ThemeData` for each mode; `main.dart` selects light/dark from `prefsProvider`.
Charts read palette colours directly (matching `useColors`).

## Testing & verification

- `flutter analyze` clean; `dart format .`.
- Unit/widget tests:
  - `format.dart` — grouping, `fmt`, `signed`, `compact` (k/M), `pct`, `clamp01`.
  - `i18n.dart` — EN and TH expose the same key set (no missing translations).
  - `palette.dart` — both modes resolve all semantic + tint keys.
  - data layer — a provider resolves against a **fake `ApiClient`** (no network).
  - smoke — app builds; dashboard renders with stubbed providers (loading/data/error states).
- Manual/optional: run the Go API (`cd api && go run .`) and launch the app
  (`cd app && flutter run --dart-define=API_BASE_URL=http://localhost:8080`).

## Cleanup (final, only after parity verified)

**Hard gate — do NOT delete `mobile/` until ALL of these pass:**
- Every screen/modal in the source inventory has a working Dart equivalent (no stubs, no "TODO" screens).
- `flutter analyze` is clean (0 errors/warnings).
- `flutter test` is green.
- `flutter build` succeeds for at least one target (e.g. `flutter build apk --debug` or `flutter build web`).
- The app launches against the running Go API and the dashboard + tab navigation render.

Only once the above hold:

1. `git rm -r mobile/` (recoverable from history).
2. Rewrite root `README.md`: keep the API section; replace the Expo stack table
   row, "Run the mobile app" steps, and project-layout tree with the Flutter app
   (run via `flutter run`, base-URL via `--dart-define`, layout under `app/lib`).

## Out of scope

- No changes to `api/`.
- No new features beyond what `mobile/` already does (faithful port only; YAGNI).
- No CI changes, no app-store packaging, no auth (the API/app have none today).
```

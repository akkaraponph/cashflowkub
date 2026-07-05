# CashflowKub Flutter Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Expo/React Native app (`mobile/`) with a faithful, feature-complete Flutter app in `app/`, talking to the same Go API, then delete `mobile/` and rewrite the root README — only after verified parity.

**Architecture:** Riverpod for server-cache providers (replacing React Query) + a persisted prefs `Notifier` (replacing Zustand). `http` client mirrors the thin `fetch` wrapper. `go_router` shell route for bottom tabs + push/modal routes. Theme via `ThemeData` + an `AppPalette` theme-extension (same hexes as the design tokens). Charts are hand-rolled `CustomPainter`s. EN/TH from a ported dict; light/dark + financial-year scope preserved.

**Tech Stack:** Flutter 3.44 / Dart 3.12, flutter_riverpod, http, shared_preferences, go_router, lucide_icons.

## Global Constraints

- **Do NOT touch `api/`.** The Go API is the contract; the app only consumes it.
- **Faithful port, no new features.** Match `mobile/`'s behavior exactly, including its quirks (hardcoded June-2026 calendar, hardcoded English strings noted per-screen, stubbed/no-op buttons). YAGNI — do not "fix" or extend.
- **Money formatting is manual** (no `intl` number formatting): `fmt`/`signed`/`compact`/`pct`/`clamp01` ported verbatim from `mobile/src/lib/format.ts`. Currency symbol is `฿`, always integer (rounded), thousands grouped by regex.
- **Theme hexes are fixed** — copy verbatim from `mobile/src/lib/theme.ts` (PALETTE/TINTS/HERO/BRAND) and `mobile/src/global.css`. Light + dark.
- **Bilingual selection pattern**, used everywhere: `lang == 'th' ? obj.th : obj.<latinField>`.
- **API base URL** (`resolveBaseUrl`): `--dart-define=API_BASE_URL` (trailing `/` stripped) → else web/desktop/iOS = `http://localhost:8080`, Android = `http://10.0.2.2:8080`. API path prefix `/api/v1`. List endpoints unwrap `{ "data": [...] }`.
- **The pubspec package name stays `app`.** Import as `package:app/...`.
- **Verification gate before deleting `mobile/`:** every screen has a working Dart equivalent (no stubs), `flutter analyze` clean, `flutter test` green, `flutter build` succeeds for ≥1 target, and the app launches against the running Go API with dashboard + tabs rendering.

## Source → target conventions

- Source of truth for each screen's pixel-level layout is its `mobile/src/app/*.tsx` file. Each screen task below embeds the **behavior map** (sections, data, mutations, navigation, local state, logic, edge states) so nothing is dropped; read the source file alongside for exact spacing/wording.
- NativeWind class → Flutter mapping cheatsheet (apply throughout):
  - `Card` = `Container(decoration: BoxDecoration(color: card, borderRadius: 18, border: 1px border, boxShadow: CARD_SHADOW unless flat))`.
  - `rounded-lg`=18, `rounded-md`=16, `r-tile`=11, `r-xl`=20. `gap-N`=4·N px (use `Wrap`/`Column` spacing or `SizedBox`). `p-4`=16, `p-5`=20, `px-4`=16, `py-2.5`=10.
  - `text-foreground`/`text-muted-foreground` → palette `foreground`/`mutedForeground`. `tabular` → `fontFeatures: [FontFeature.tabularFigures()]`.
  - `active:opacity-70` → wrap in `InkWell`/`GestureDetector` with pressed opacity, or `Opacity` on press; simplest faithful approach: `GestureDetector` + no ripple (RN has no ripple). Acceptable to use `InkWell` without splash where convenient.
  - Pull-to-refresh `Screen` → `RefreshIndicator` + `ListView`/`SingleChildScrollView`.

## File structure (`app/lib/`)

```
main.dart                       # WidgetsFlutterBinding, load SharedPreferences, ProviderScope(overrides), CashflowKubApp
src/
  core/
    format.dart                 # fmt, signed, compact, pct, clamp01
    palette.dart                # AppPalette (ThemeExtension): colors + tints + hero + brand; .light/.dark
    theme.dart                  # buildTheme(AppPalette) -> ThemeData (+ extension)
    i18n.dart                   # dict {en,th}; stringsFor(lang); years, currentYear live in prefs.dart
    prefs.dart                  # Prefs, PrefsNotifier, prefsProvider, sharedPrefsProvider, years, currentYear
    nav.dart                    # NavItem, navItems (12), tabKeys (4)
  models/
    models.dart                 # all API model classes + fromJson (mirror types.ts)
  data/
    api_client.dart             # ApiClient, ApiException, resolveBaseUrl
    providers.dart              # apiClientProvider + FutureProviders per resource + mutation fns
  widgets/
    app_icon.dart               # AppIcon(name) -> lucide IconData via kebab map
    app_text.dart               # AppText + textStyleFor(variant) (Text variants)
    charts.dart                 # CashflowBars, MiniBars, Donut, TrendChart (CustomPainter)
    app_header.dart             # AppHeader(title, back)
    ui/
      card.dart                 # AppCard, kCardShadow
      button.dart               # AppButton (variant/size/loading)
      badge.dart                # AppBadge, BadgeTone
      tile.dart                 # AppTile(icon, tint, size, radius)
      progress.dart             # ProgressBar, SplitBar
      segmented.dart            # Segmented, SegOption
      list_row.dart             # ListRow
      screen_states.dart        # AppScreen, LoadingView, ErrorView, EmptyView
  router.dart                   # go_router: StatefulShellRoute (tabs) + push/modal routes; AppShell + bottom bar + center FAB
  screens/
    dashboard.dart bills.dart debts.dart networth.dart transactions.dart budgets.dart
    accounts.dart reports.dart goals.dart plan.dart setup.dart settings.dart
    add_transaction.dart menu.dart day_detail.dart debt_detail.dart tx_detail.dart
test/
    format_test.dart i18n_test.dart palette_test.dart api_client_test.dart
    providers_test.dart smoke_test.dart
```

---

## Phase 0 — Project setup

### Task 0: Dependencies & scaffold reset

**Files:**
- Modify: `app/pubspec.yaml`
- Replace: `app/lib/main.dart` (temporary stub), delete default counter
- Delete: `app/test/widget_test.dart`

**Interfaces:**
- Produces: dependency set; clean analyze baseline.

- [ ] **Step 1:** Edit `app/pubspec.yaml` `dependencies:` to add (keep `flutter`, `cupertino_icons`):
```yaml
  flutter_riverpod: ^2.6.1
  http: ^1.2.2
  shared_preferences: ^2.3.3
  go_router: ^14.6.2
  lucide_icons: ^0.257.0
```
- [ ] **Step 2:** Replace `app/lib/main.dart` with a minimal stub:
```dart
import 'package:flutter/material.dart';
void main() => runApp(const MaterialApp(home: Scaffold(body: Center(child: Text('CashflowKub')))));
```
- [ ] **Step 3:** Delete `app/test/widget_test.dart` (references the removed counter).
- [ ] **Step 4:** Run `cd app && flutter pub get` — Expected: resolves, no version conflicts. If `lucide_icons` version is unavailable, run `flutter pub add lucide_icons` and record the resolved version.
- [ ] **Step 5:** Run `cd app && flutter analyze` — Expected: "No issues found!"
- [ ] **Step 6:** Commit: `git add app/pubspec.yaml app/pubspec.lock app/lib/main.dart && git rm app/test/widget_test.dart && git commit -m "chore(app): add Flutter port deps, reset scaffold"`

---

## Phase 1 — Foundation (`core/`, `models/`, `data/`)

### Task 1: Money formatting (`core/format.dart`)

**Files:** Create `app/lib/src/core/format.dart`; Test `app/test/format_test.dart`
**Interfaces — Produces:** `String fmt(num)`, `String signed(num)`, `String compact(num)`, `String pct(num)`, `double clamp01(num)`.

- [ ] **Step 1:** Write `app/test/format_test.dart`:
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:app/src/core/format.dart';
void main() {
  test('fmt groups thousands, abs, no sign', () {
    expect(fmt(1234), '฿1,234');
    expect(fmt(-1234567), '฿1,234,567');
    expect(fmt(0), '฿0');
  });
  test('signed prefixes + or -', () {
    expect(signed(1234), '+฿1,234');
    expect(signed(-50), '-฿50');
    expect(signed(0), '+฿0');
  });
  test('compact k/M with one decimal trimmed', () {
    expect(compact(17700), '฿17.7k');
    expect(compact(1250000), '฿1.3M');
    expect(compact(950), '฿950');
    expect(compact(2000), '฿2k');
  });
  test('pct rounds ratio*100', () { expect(pct(0.624), '62%'); });
  test('clamp01', () { expect(clamp01(-1), 0); expect(clamp01(2), 1); expect(clamp01(0.5), 0.5); });
}
```
- [ ] **Step 2:** Run `cd app && flutter test test/format_test.dart` — Expected: FAIL (no `format.dart`).
- [ ] **Step 3:** Create `app/lib/src/core/format.dart`:
```dart
String _group(num n) => n.abs().round().toString()
    .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');

String fmt(num n) => '฿${_group(n)}';
String signed(num n) => (n < 0 ? '-' : '+') + fmt(n);

String _trim(num v) {
  final r = (v * 10).round() / 10;
  return r == r.truncateToDouble() ? r.toInt().toString() : r.toString();
}

String compact(num n) {
  final abs = n.abs();
  if (abs >= 1000000) return '฿${_trim(abs / 1000000)}M';
  if (abs >= 1000) return '฿${_trim(abs / 1000)}k';
  return '฿${_group(abs)}';
}

String pct(num ratio) => '${(ratio * 100).round()}%';
double clamp01(num v) => v < 0 ? 0 : (v > 1 ? 1 : v.toDouble());
```
- [ ] **Step 4:** Run `cd app && flutter test test/format_test.dart` — Expected: PASS.
- [ ] **Step 5:** Commit: `git add app/lib/src/core/format.dart app/test/format_test.dart && git commit -m "feat(app): money/number formatting"`

### Task 2: Palette + theme (`core/palette.dart`, `core/theme.dart`)

**Files:** Create `app/lib/src/core/palette.dart`, `app/lib/src/core/theme.dart`; Test `app/test/palette_test.dart`
**Interfaces — Produces:** `AppPalette` (`ThemeExtension<AppPalette>`) with named `Color` fields `background, foreground, card, primary, primaryForeground, secondary, secondaryForeground, mutedForeground, destructive, border, xlsFg`; `Map<String,(Color bg,Color fg)> tints`; record `hero {from,to,fg,solid}`; record `brand {from,to}`; statics `AppPalette.light`, `AppPalette.dark`; helper `(Color bg, Color fg) tint(String key)` (fallback `doc`). `ThemeData buildTheme(AppPalette p)`.

- [ ] **Step 1:** Write `app/test/palette_test.dart` asserting both palettes expose all 6 tint keys + non-null semantic colors:
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:app/src/core/palette.dart';
void main() {
  for (final p in [AppPalette.light, AppPalette.dark]) {
    for (final k in ['folder','pdf','image','doc','xls','video']) {
      test('tint $k present', () => expect(p.tints.containsKey(k), true));
    }
    test('unknown tint falls back to doc', () => expect(p.tint('nope'), p.tint('doc')));
  }
}
```
- [ ] **Step 2:** Run test — Expected: FAIL.
- [ ] **Step 3:** Create `palette.dart`. Port hexes verbatim from `mobile/src/lib/theme.ts` (`PALETTE`, `TINTS`, `HERO`, `BRAND`) — note `xlsFg` light `#16a34a` / dark `#4ade80`. Use `Color(0xFFRRGGBB)`. Implement `ThemeExtension` `copyWith`/`lerp` (lerp may return `this`). Add `tint(key)` with `doc` fallback.
- [ ] **Step 4:** Create `theme.dart`: `buildTheme(p)` returns `ThemeData(brightness: p==light?light:dark, scaffoldBackgroundColor: p.background, fontFamily: null, extensions: [p], colorScheme: ColorScheme.fromSeed(seedColor: p.primary, brightness: ...).copyWith(surface: p.card))`. Expose `context.palette` extension: `extension PaletteX on BuildContext { AppPalette get palette => Theme.of(this).extension<AppPalette>()!; }`.
- [ ] **Step 5:** Run `flutter test test/palette_test.dart` — Expected: PASS.
- [ ] **Step 6:** Commit.

### Task 3: i18n (`core/i18n.dart`)

**Files:** Create `app/lib/src/core/i18n.dart`; Test `app/test/i18n_test.dart`
**Interfaces — Produces:** `const Map<String, Map<String, dynamic>> dict` (keys `'en'`,`'th'`); helper `Map<String,dynamic> stringsFor(String lang) => dict[lang]!`. Nested values (`nav`, `strategyTip`) are `Map<String,String>`.

- [ ] **Step 1:** Write `app/test/i18n_test.dart` — EN and TH expose the identical key set (deep, including nested `nav`/`strategyTip`):
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:app/src/core/i18n.dart';
Set<String> _keys(Map m, [String p='']) => m.entries.expand((e) {
  final k = p.isEmpty ? e.key : '$p.${e.key}';
  return e.value is Map ? _keys(e.value as Map, k) : [k];
}).toSet();
void main() => test('EN/TH key parity', () =>
  expect(_keys(dict['en']!), _keys(dict['th']!)));
```
- [ ] **Step 2:** Run — Expected: FAIL.
- [ ] **Step 3:** Create `i18n.dart` porting `mobile/src/lib/i18n.ts` `DICT` verbatim (every key, EN + TH, nested `nav` & `strategyTip`). Keep `{n}` placeholders as literal strings (e.g. `daysUntil: 'in {n} days'`).
- [ ] **Step 4:** Run test — Expected: PASS. (If it fails, the port dropped/renamed a key — fix.)
- [ ] **Step 5:** Commit.

### Task 4: Prefs (`core/prefs.dart`, `core/nav.dart`)

**Files:** Create `app/lib/src/core/prefs.dart`, `app/lib/src/core/nav.dart`
**Interfaces — Produces:** `class Prefs { final String lang; final String theme; final int year; }`; `final sharedPrefsProvider = Provider<SharedPreferences>((_) => throw UnimplementedError())` (overridden in main); `final prefsProvider = NotifierProvider<PrefsNotifier, Prefs>(...)` with `setLang/toggleLang/setTheme/toggleTheme/setYear`; `const years = [2024,2025,2026,2027,2028]`; `const currentYear = 2026`. `nav.dart`: `class NavItem { final String key, route, icon; }`, `const navItems` (12, order from `mobile/src/components/nav.ts`), `const tabKeys = ['dashboard','bills','debts','networth']`.

- [ ] **Step 1:** Create `nav.dart` with the 12 `NavItem`s (key/route/icon) verbatim from `nav.ts` (dashboard `/`, bills `/bills`, transactions `/transactions`, debts `/debts`, networth `/networth`, budgets `/budgets`, accounts `/accounts`, reports `/reports`, goals `/goals`, plan `/plan`, setup `/setup`, settings `/settings`) and `tabKeys`.
- [ ] **Step 2:** Create `prefs.dart`. `PrefsNotifier extends Notifier<Prefs>`: `build()` reads `sharedPrefsProvider` JSON under key `cfk-prefs` (fields lang/theme/year), defaults `en`/`light`/`currentYear`. Each setter updates state AND writes JSON back via `ref.read(sharedPrefsProvider).setString('cfk-prefs', jsonEncode({lang,theme,year}))`. `toggleLang` swaps en/th; `toggleTheme` swaps light/dark.
- [ ] **Step 3:** Write `app/test/prefs_test.dart`: use `SharedPreferences.setMockInitialValues({})`, build a `ProviderContainer(overrides:[sharedPrefsProvider.overrideWithValue(await SharedPreferences.getInstance())])`, assert defaults and that `toggleTheme()` flips to `dark`.
- [ ] **Step 4:** Run `flutter test test/prefs_test.dart` — Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 5: Models (`models/models.dart`)

**Files:** Create `app/lib/src/models/models.dart`; Test `app/test/models_test.dart`
**Interfaces — Produces:** Dart classes (immutable, `fromJson(Map<String,dynamic>)`) mirroring **every** interface in `mobile/src/lib/types.ts`: `Account, Category, Transaction, Budget, Goal, Debt, Asset, Bill, Channel, IncomeCategory, PlanItem, MonthCashflow, NetWorthPoint, CategorySpend, Dashboard, NetWorth, Reports, ScheduleRow, DebtSchedule, BillsSummary, PlanGroup, Plan, AssetSnapshotItem, AssetSnapshots, SetupGoalChannel, SetupGoal, Setup`. Field names/types match `types.ts`; numbers → `num`/`double`/`int` (use `num` for money to avoid int/double JSON ambiguity, expose `.toDouble()` where needed), nullable where the TS marks `| null`/`?` (e.g. `Dashboard.debt.focus: Debt?`, `nextBill: Bill?`, `SetupGoal.currentAge?` etc.). Nested aggregates parse sub-objects (e.g. `Dashboard.month = MonthNet.fromJson`, `Dashboard.debt = DebtSummary.fromJson`).

- [ ] **Step 1:** Write `app/test/models_test.dart`: parse a representative JSON literal for `Transaction`, `Debt`, and a trimmed `Dashboard` (with `nextBill: null` and a non-null `debt.focus`) and assert key fields + null handling.
- [ ] **Step 2:** Run — Expected: FAIL.
- [ ] **Step 3:** Create `models.dart`. For each type: `final` fields + `const`/factory `fromJson`. Helpers: `num _n(v) => (v ?? 0) as num;` and list mapping `((j['cashflow'] ?? []) as List).map((e) => MonthCashflow.fromJson(e)).toList()`. Enums-as-strings stay `String` (e.g. `Category.type`, `Debt.calc`, `Bill.status`, `PlanItem.type`).
- [ ] **Step 4:** Run test — Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 6: API client (`data/api_client.dart`)

**Files:** Create `app/lib/src/data/api_client.dart`; Test `app/test/api_client_test.dart`
**Interfaces — Produces:** `class ApiException implements Exception { final int status; final String message; }`; `String resolveBaseUrl()`; `class ApiClient { ApiClient(this.baseUrl, {http.Client? client}); Future<dynamic> getJson(String path); Future<T> getObj<T>(String path, T Function(Map<String,dynamic>) f); Future<List<T>> getList<T>(String path, T Function(Map<String,dynamic>) f); Future<dynamic> post/put/patch(String path, [Object? body]); Future<dynamic> del(String path); }`. Errors throw `ApiException`; non-OK parses `{error}` body for the message; 204 → null. `getList` unwraps `{data:[...]}`.

- [ ] **Step 1:** Write `app/test/api_client_test.dart` using `http`'s `MockClient`: a GET returning `{"data":[{"id":1,...}]}` → `getList` yields one model; a 404 with `{"error":"nope"}` → throws `ApiException(status:404,message:'nope')`.
- [ ] **Step 2:** Run — Expected: FAIL.
- [ ] **Step 3:** Create `api_client.dart`. `resolveBaseUrl`: `const env = String.fromEnvironment('API_BASE_URL'); if (env.isNotEmpty) return env.replaceAll(RegExp(r'/$'), ''); if (kIsWeb) return 'http://localhost:8080'; if (Platform.isAndroid) return 'http://10.0.2.2:8080'; return 'http://localhost:8080';` (import `package:flutter/foundation.dart` for `kIsWeb`, `dart:io` for `Platform`, guard so web never imports… use conditional: `kIsWeb` checked first; `dart:io` import is fine but `Platform` only referenced after `!kIsWeb`). Requests hit `$baseUrl/api/v1$path` with `Content-Type: application/json`.
- [ ] **Step 4:** Run test — Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 7: Providers + mutations (`data/providers.dart`)

**Files:** Create `app/lib/src/data/providers.dart`; Test `app/test/providers_test.dart`
**Interfaces — Produces:**
- `final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(resolveBaseUrl()));`
- Read providers (mirror `qk`/hooks in `mobile/src/lib/hooks.ts`):
  `dashboardProvider` (`FutureProvider<Dashboard>`), `transactionsProvider` (`FutureProvider.family<List<Transaction>, String?>` — arg is the query string like `type=income` or `limit=5`, null = none), `accountsProvider`, `categoriesProvider`, `budgetsProvider`, `goalsProvider`, `channelsProvider`, `debtsProvider` (`family<List<Debt>, String?>` status), `debtProvider` (`family<Debt,String>`), `debtScheduleProvider` (`family<DebtSchedule,String>`), `billsProvider` (`family<List<Bill>,String?>` status), `billsSummaryProvider`, `netWorthProvider`, `reportsProvider`, `planProvider`, `assetSnapshotsProvider`, `setupProvider`, `transactionProvider` (`family<Transaction,String>` for `/transactions/{id}`).
- Mutation functions (call API then invalidate, matching hooks.ts invalidation sets):
  `Future<void> createTransaction(Ref ref, {required String name, required String cat, required String acct, required num amount, String? note, String? date})` → POST `/transactions`; invalidate transactions(all), dashboard, accounts.
  `Future<void> toggleBillPaid(Ref ref, {required int id, bool? paid})` → PATCH `/bills/$id/pay` (`{}` or `{paid}`); invalidate bills(all), billsSummary, dashboard.
  `Future<void> payDebt(Ref ref, {required int id, num? amount})` → POST `/debts/$id/pay` (`{}` or `{amount}`); invalidate debts(all), debt(id), debtSchedule(id), dashboard, netWorth.
  (Invalidating a `.family` "all" = `ref.invalidate(transactionsProvider)` invalidates every arg.)

- [ ] **Step 1:** Write `app/test/providers_test.dart`: override `apiClientProvider` with an `ApiClient` built on a `MockClient` returning canned `/dashboard` and `/accounts`; assert `await container.read(dashboardProvider.future)` parses, and that calling `createTransaction` posts to `/transactions` (MockClient records the request).
- [ ] **Step 2:** Run — Expected: FAIL.
- [ ] **Step 3:** Create `providers.dart` with all providers + mutation fns above.
- [ ] **Step 4:** Run test — Expected: PASS.
- [ ] **Step 5:** Commit.

---

## Phase 2 — Design system, chrome, router (`widgets/`, `router.dart`)

> Each widget task ports the spec from the UI-primitive map (embedded). Build them as plain `StatelessWidget`s reading colors via `context.palette`. No ripple unless noted (RN uses opacity press feedback). Verify each compiles via `flutter analyze`; a small golden/render smoke test is optional. Commit after each task.

### Task 8: Typography + icons (`widgets/app_text.dart`, `widgets/app_icon.dart`)

**Files:** Create `app/lib/src/widgets/app_text.dart`, `app/lib/src/widgets/app_icon.dart`
**Interfaces — Produces:** `TextStyle textStyleFor(BuildContext, String variant, {bool tabular})`; `AppText(String data, {String variant='body', bool tabular, int? maxLines, TextStyle? style, Color? color})`. `IconData lucideFor(String name)`; `AppIcon(String name, {double size=18, Color? color, double strokeWidth=1.75})` (strokeWidth unused by lucide_icons font glyphs — keep param for parity but ignore).

- [ ] **Step 1:** `app_text.dart` — map variants (from `ui/text.tsx` map): `body`=15/400 foreground; `h1`=22/700 letterSpacing -0.5 foreground; `h2`=18/700 -0.4 foreground; `h3`=16/600 foreground; `title`=15/600 foreground; `label`=13/600 mutedForeground; `meta`=12/400 mutedForeground; `eyebrow`=11/700 uppercase letterSpacing +0.5 mutedForeground; `amount`=15/700 foreground. `tabular` → `fontFeatures:[FontFeature.tabularFigures()]`. `AppText` renders `Text` with `overflow: ellipsis` when `maxLines!=null`, applying `color`/`style` overrides last. (Eyebrow uppercases its text.)
- [ ] **Step 2:** `app_icon.dart` — `lucideFor(name)` maps kebab names → `LucideIcons.*` (camelCase). Build a `const Map<String,IconData>` covering all names used across the app: `layout-dashboard, calendar-clock, arrow-left-right, trending-down, scale, wallet, landmark, bar-chart-3, target, clipboard-list, sliders-horizontal, settings, plus, menu, moon, sun, chevron-left, chevron-right, x, trending-up, arrow-down-left, arrow-up-right, triangle-alert, circle, calendar, inbox, check, piggy-bank, package, shopping-bag, home, search, pencil, trash-2, credit-card, building-2, banknote, bell, shield, help-circle, log-out` (extend as screens reveal more; unknown → `LucideIcons.circle`). `AppIcon` returns `Icon(lucideFor(name), size: size, color: color ?? context.palette.foreground)`.
- [ ] **Step 3:** `flutter analyze` — Expected: clean (resolve any lucide name that doesn't exist in the package to the closest available glyph; record substitutions).
- [ ] **Step 4:** Commit.

### Task 9: UI primitives (`widgets/ui/*`)

**Files:** Create `card.dart, button.dart, badge.dart, tile.dart, progress.dart, segmented.dart, list_row.dart, screen_states.dart` under `app/lib/src/widgets/ui/`
**Interfaces — Produces:**
- `AppCard({Widget child, EdgeInsets? padding, bool flat=false, Color? color, double radius=18})` + `kCardShadow` (`BoxShadow(color black .06, blur 12, offset (0,6))`). border 1px `border`, bg `card`.
- `AppButton({String? label, String variant='default', String size='md', bool loading=false, bool disabled=false, VoidCallback? onPressed, Widget? left, Widget? right})`. Variant BG/FG/border per `button.tsx` map (default=primary; secondary; outline=transparent bg, foreground text; ghost; destructive). Sizes sm=32h/12px/r16, md=40h/16px/r18, lg=… r18. Label = AppText 14/600 with variant FG. `loading` → centered small `CircularProgressIndicator`. pressed → 80% opacity; disabled → 50% opacity + ignore taps.
- `AppBadge({required String label, BadgeTone tone=BadgeTone.neutral})`. `enum BadgeTone {neutral,success,danger,warning,info,primary}`. Pill: `flex-row gap-1 self-start rounded-full px-2 py-0.5`; bg/fg per tone (neutral=secondary/secondaryFg; success=xls tint; danger=pdf tint; warning=folder tint; info=doc tint; primary=primary/primaryFg). Label 11/600.
- `AppTile({required String icon, String? tint, double size=38, double radius=11})` → square `size`, radius, bg=`tint(key).bg`, centered `AppIcon(icon, size: (size*0.46).round(), color: tint(key).fg)`. Unknown/null tint → `doc`.
- `ProgressBar({required double value, double height=8, Color? color})` → track `secondary` rounded-full, fill `clamp01(value)*100%` width, fill color `color ?? primary`. `SplitBar({required double left, double height=8, Color? leftColor, Color? rightColor})` → row of two flex segments (`clamp01(left)` / remainder), default left=xlsFg, right=destructive.
- `Segmented({required List<SegOption> options, required String value, required ValueChanged<String> onChange})`; `class SegOption{final String key,label;}`. Track: row, rounded-lg(18), border, bg secondary, p-1; each segment flex-1 centered, rounded-md(16), py-2; active → bg card + small shadow + foreground text; inactive → mutedForeground text. Label 13/600.
- `ListRow({String? icon, String? tint, Widget? leftNode, required String title, String? subtitle, Object? rightTop, Object? rightBottom, bool chevron=false, VoidCallback? onTap})`. Row `gap-3 py-2.5`; left = leftNode ?? (icon!=null ? AppTile : nothing); center `Expanded` title 14/600 ellipsis + subtitle meta ellipsis; right column `items-end`: rightTop string→14/700 tabular else widget, rightBottom string→meta tabular else widget; chevron→`chevron-right` 18 mutedForeground. onTap → pressable 70% opacity.
- `AppScreen({required List<Widget> children, Future<void> Function()? onRefresh, bool refreshing=false, double bottomPad=120})` → `RefreshIndicator`(if onRefresh) wrapping `ListView` with padding 16 + bottomPad, 16px gaps between children (insert `SizedBox(height:16)` or use `separated`). `LoadingView` (centered `CircularProgressIndicator(color: primary)`, py-24). `ErrorView({String? message, VoidCallback? onRetry})` (centered `triangle-alert` 28 + meta message (default 'Something went wrong') + optional 'Tap to retry' 13/600 primary). `EmptyView({String icon='inbox', required String label})` (centered icon 28 + meta label, py-12, not flex-1).

- [ ] **Step 1:** Implement all primitives per the specs above (each its own file). Read each `mobile/src/components/ui/*.tsx` for exact token/spacing parity.
- [ ] **Step 2:** `flutter analyze` — Expected: clean.
- [ ] **Step 3:** Optional `app/test/widgets_test.dart`: pump `AppBadge`, `ProgressBar(value:2)` (clamps), `ListRow(title:'x', rightTop:'฿1')` inside a themed `MaterialApp` and assert they render text. Run it.
- [ ] **Step 4:** Commit.

### Task 10: Charts (`widgets/charts.dart`)

**Files:** Create `app/lib/src/widgets/charts.dart`; Test `app/test/charts_test.dart` (geometry helpers)
**Interfaces — Produces:** `CashflowBars({required List<({String month,num income,num expense})> data, double height=150})`; `MiniBars({required List<num> values, Color? color, double height=54})`; `Donut({required List<({num value,Color color})> segments, double size=132, double stroke=18, String? centerLabel, String? centerValue})`; `TrendChart({required List<num> values, List<String>? labels, double height=120, Color? color})`. Implement via `CustomPaint`. Embed the exact geometry from `mobile/src/components/charts.tsx`:
- CashflowBars: `max=max(1, all income&expense)`; per month two bars width 9, radius 3, heights `(v/max)*usableHeight` (income=xlsFg, expense=foreground), label meta 11 under each; row `items-end gap-2.5`.
- Donut: `r=(size-stroke)/2; total=max(1,sumValues)`; background ring `secondary`; arcs start at `-90°`, each sweep `value/total*2π`, `strokeWidth=stroke`, butt caps; center overlay label(meta 10)+value(16/700 tabular).
- TrendChart: viewBox 320×height, pad 6, `min=min(values)`, `max=max(max(values), min+1)`, x=`pad + i*stepX`, `y=pad + (1-(v-min)/(max-min))*(height-2pad)`; filled polygon (color @12% opacity) + polyline stroke 2.5 round join; optional labels row meta 10 spaced between.

- [ ] **Step 1:** Pull `value/total` arc math and trend y-mapping into pure top-level functions (e.g. `List<double> donutSweeps(List<num>)`, `double trendY(num v, num min, num max, double h, double pad)`) and unit-test them in `charts_test.dart`.
- [ ] **Step 2:** Run — Expected: FAIL.
- [ ] **Step 3:** Implement painters + widgets reading `context.palette`.
- [ ] **Step 4:** Run `flutter test test/charts_test.dart` + `flutter analyze` — Expected: PASS/clean.
- [ ] **Step 5:** Commit.

### Task 11: Header, shell + router (`widgets/app_header.dart`, `router.dart`, `main.dart`)

**Files:** Create `app/lib/src/widgets/app_header.dart`, `app/lib/src/router.dart`; finalize `app/lib/main.dart`
**Interfaces — Produces:** `AppHeader({required String title, bool back=false})` (Consumer): brand gradient mark 30×30 r9 with white bold 'C' (or back chevron button when `back`), title h2 17 ellipsis Expanded, **year stepper** pill (chevron-left disabled at index 0, year tabular 12/700, chevron-right disabled at last; calls `prefs.setYear`), lang button (`EN`/`TH` → `toggleLang`), theme button (`moon`/`sun` → `toggleTheme`), menu button (`menu` → `context.push('/menu')`). Gradients from `palette.brand`. `router.dart`: `final router = GoRouter(...)` with a `StatefulShellRoute.indexedStack` for the 4 tabs (`/`, `/bills`, `/debts`, `/networth`) wrapped in `AppShell` (bottom bar from `tabKeys` + center FAB gradient → `context.push('/add')`), plus top-level routes `/transactions /budgets /accounts /reports /goals /plan /setup /settings` and modal routes (`pageBuilder` with `fullscreenDialog`) `/add /menu /tx/:id /debt/:id /day/:day`.

- [ ] **Step 1:** Build `AppShell` (the tab scaffold + `TabBar`-equivalent bottom bar: 4 items + center FAB, per `mobile/src/components/TabBar.tsx`; active=foreground, inactive=mutedForeground; FAB 54×54 r18 hero gradient `plus` icon, offset up -28).
- [ ] **Step 2:** Build `AppHeader` per spec.
- [ ] **Step 3:** Build `router.dart` with all routes; modal routes use `fullscreenDialog: true`.
- [ ] **Step 4:** Finalize `main.dart`:
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'src/core/prefs.dart';
import 'src/core/theme.dart';
import 'src/core/palette.dart';
import 'src/router.dart';
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final sp = await SharedPreferences.getInstance();
  runApp(ProviderScope(overrides: [sharedPrefsProvider.overrideWithValue(sp)], child: const CashflowKubApp()));
}
class CashflowKubApp extends ConsumerWidget {
  const CashflowKubApp({super.key});
  @override Widget build(BuildContext context, WidgetRef ref) {
    final dark = ref.watch(prefsProvider.select((p) => p.theme == 'dark'));
    return MaterialApp.router(
      title: 'CashflowKub',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(AppPalette.light),
      darkTheme: buildTheme(AppPalette.dark),
      themeMode: dark ? ThemeMode.dark : ThemeMode.light,
      routerConfig: router,
    );
  }
}
```
- [ ] **Step 5:** `flutter analyze` + `flutter run -d <device> --dart-define=API_BASE_URL=http://localhost:8080` smoke (tabs visible) — Expected: app boots to an (empty) dashboard shell with working tab bar. Commit.

---

## Phase 3 — Screens

> **Per-screen task shape** (apply to each below): (1) read the source `.tsx`; (2) build the screen as a `ConsumerWidget`/`ConsumerStatefulWidget` (local state → `State` fields) under `app/lib/src/screens/<name>.dart`; (3) wire to providers + widgets listed; (4) reproduce every section/logic/edge-state from the embedded map; (5) `flutter analyze` clean; (6) commit. Wire the route in `router.dart` if not already. Tabs first (they exercise the shell), then stack screens, then modals/detail.

### Task 12: Dashboard — `screens/dashboard.dart` (source: `app/(tabs)/index.tsx`)
**Consumes:** `dashboardProvider`, `transactionsProvider('limit=5')`, `budgetsProvider`, `categoriesProvider`; widgets AppHeader, AppScreen/Loading/Error, AppCard, AppTile, AppBadge, ProgressBar, CashflowBars, Donut; `fmt/signed/compact/pct`.
**Map:** 22 sections — greeting (h1 `greeting` + meta `today`); hero net-worth gradient (`HERO`, `fmt(netWorth)`, pill `signed(month.net) thisMonth`); two StatCards (income xls/`xlsFg`, expenses pdf) in a `Wrap`, then full-width net StatCard (`net · thisMonth`, value `signed`); Cashflow card (CashflowBars over `cashflow`, legend); Spending donut card (segments `spending` colored `tint(s.tint).fg`, center `spent`/`compact(spendTotal)`, legend rows with `round(pct)%`); next-bill card (only if `nextBill`; badge overdue→danger else dueSoon→warning; tap → `/bills`); debt quick card (Donut size86/stroke11 [progress,1-progress] primary/secondary; `fmt(remaining)` of `fmt(original)`; focus block hardcoded `Pay first · ${apr}% APR`; tap → `/debts`); net-worth quick card (MiniBars/Donut, tap → `/networth`); budgets preview (`budgets.slice(0,4)`, ratio spent/limit, over→destructive, tap 'View all' → `/budgets`); recent transactions (`limit=5`, income = amount>=0 → `signed` green else `-fmt`; tap → `/tx/{id}`; 'View all' → `/transactions`); goals (ratio saved/target; 'View all' → `/goals`). Edge: only dashboard query gates loading/error; secondary queries default `[]`; `catMap[key]` fallbacks. Local state: none.

### Task 13: Bills tab — `screens/bills.dart` (source: `app/(tabs)/bills.tsx`)
**Consumes:** `billsSummaryProvider`, `billsProvider(null)`, `toggleBillPaid`; Segmented, AppCard, ProgressBar, AppBadge, AppTile, ListRow.
**Map:** Summary card (total/paid/remaining, progress `paid/total` guarded). Segmented list/calendar (`view` state default `list`). List: groups in fixed `STATUS_ORDER ['overdue','dueToday','dueSoon','upcoming','paid']`, omit empty groups, header = `sectionLabel(status)` + count; rows: checkbox tap → `toggleBillPaid(id)`; tone map overdue→danger,dueToday/dueSoon→warning,upcoming→neutral,paid→success; name `lang==th?th:name`. Calendar: **hardcoded June 2026** — MONTH_DAYS=30, LEAD_PAD=1, DOW `['S','M','T','W','T','F','S']`; `byDay` bucket; day cell tappable only if has bills → `/day/{day}`; overdueUnpaid styling. Edge: only summary gates loading/error; bills default `[]`. Wire `/day/:day`.

### Task 14: Debts tab — `screens/debts.dart` (source: `app/(tabs)/debts.tsx`)
**Consumes:** `debtsProvider('active')`, `debtsProvider('paid')`, Donut; HERO gradient.
**Map:** Hero ring (Donut [progress,1-progress], white-18% remaining segment, center `round(progress*100)%`; totals `totalRemaining/Original/Paid` reduced over active; progress = totalPaid/totalOriginal guarded). Strategy Segmented (`strategy` state default `avalanche`; `sortByStrategy`: avalanche=APR desc, snowball=remaining asc, custom=original order — non-mutating copy). Active list rows → `/debt/{id}`; meta `${apr} ${apr}% · ${minMonthly} ${fmt(monthly)}`. Paid list (only if non-empty) struck-through. Edge: only active gates loading/error; paid silently `[]`.

### Task 15: Net Worth tab — `screens/networth.dart` (source: `app/(tabs)/networth.tsx`)
**Consumes:** `netWorthProvider`, SplitBar, TrendChart, Segmented, ListRow/AppTile.
**Map:** Hero net-worth `fmt(netWorth)`; SplitBar left=`totalAssets/(totalAssets+totalLiab)` (note NaN when both 0 — replicate, SplitBar clamps); TrendChart over `history` (label `lang==th?monthTh:month`); Segmented assets/liabilities (`tab` default `assets`); asset rows pct `round(value/totalAssets*100)%`; liability rows tap → `/debt/{id}`; row top-border when i>0. Edge: nw gates loading/error.

### Task 16: Transactions — `screens/transactions.dart` (source: `app/transactions.tsx`)
**Consumes:** `transactionsProvider(filter)`, `categoriesProvider`; AppHeader(back), Segmented, ListRow.
**Map:** Segmented all/income/expense (`sel` default `all`; `filter = sel=='all'?null:'type=$sel'`). Group by `t.group` preserving API order (imperative). Rows: `catMap[t.cat]` (icon fallback `circle`/doc), income=amount>=0 → `signed` green(`xlsFg`) else `-fmt` foreground; tap → `/tx/{id}`; divider i>0. Edge: tx query gates loading/error; empty groups → EmptyView. Header `back=true`.

### Task 17: Budgets — `screens/budgets.dart` (source: `app/budgets.tsx`)
**Consumes:** `budgetsProvider`, `categoriesProvider`; AppCard, ProgressBar, AppButton.
**Map:** Total card (`totalSpent`/`totalLimit`, ratio guarded, over→destructive; status `fmt(totalLimit-totalSpent) left` green always). Per-budget rows: `catMap[b.cat]` name (`th?th:label` else key), ratio spent/limit, over→destructive + status text. 'Add budget' AppButton = **no-op** (onPressed null/empty). Edge: bq gates loading/error.

### Task 18: Accounts — `screens/accounts.dart` (source: `app/accounts.tsx`)
**Consumes:** `accountsProvider`; AppHeader(back), AppCard, AppTile, AppBadge, ListRow, AppButton.
**Map:** Total hero = sum balances (incl. negatives). Rows: tile `tint(a.tint)`, name+sub, signed balance (negative → destructive + manual `-`; `fmt` abs), kind badge via `KIND_TONE {bank:info,cash:success,ewallet:primary,credit:danger, else neutral}`; divider i>0. 'Add account' = no-op. Edge: aq gates loading/error.

### Task 19: Reports — `screens/reports.dart` (source: `app/reports.tsx`)
**Consumes:** `reportsProvider`, `categoriesProvider`; Donut, CashflowBars, ListRow, Segmented.
**Map:** `period` Segmented default `6m` (decorative). Breakdown donut (segments `tint(b.tint).fg`, center `compact`); legend right `${fmt(spent)} · ${round(pct)}%` (pct already 0..100). Top merchants ListRows (rightTop `fmt(total)`, no onTap). Monthly CashflowBars + legend. Edge: rq gates loading/error.

### Task 20: Goals — `screens/goals.dart` (source: `app/goals.tsx`)
**Consumes:** `goalsProvider`; AppHeader(back), AppCard, ProgressBar, AppButton.
**Map:** Per-goal: ratio saved/target (unclamped %text, clamped bar), name `th?th:name`, `${fmt(monthly)}${perMonth}` (no space), `${by} ${g.by}`, `${fmt(saved)} ${of} ${fmt(target)}`. 'Add funds'/'New goal' = no-op. Empty list → Screen with no cards. Edge: gq gates loading/error.

### Task 21: Plan — `screens/plan.dart` (source: `app/plan.tsx`)
**Consumes:** `planProvider`, `assetSnapshotsProvider`; Donut, TrendChart, Segmented, ProgressBar, AppHeader(back).
**Map:** `tab` default `monthly` (monthly/summary/assets). Monthly: groups income/expense/savings, PlanRow ratio `actual/planned` (planned>0 else 0), over (expense only) → destructive. Summary: 3× RatioDonut size96 (ratios on 0..100 scale: segments `[r, max(0,100-r)]`), planned/actual/variance net; sign color `>=0?xlsFg:destructive`. Assets: second gate on `assetSnapshotsProvider`; net-worth TrendChart; groups via `GROUP_LABEL {bank,savings,invest,other}` + `GROUP_ICON`; per-item `itemDelta=curr-prev` `signed`. Edge: plan query gates whole body; assets tab independently gates snapshots; refresh only refetches plan.

### Task 22: Setup — `screens/setup.dart` (source: `app/setup.tsx`)
**Consumes:** `setupProvider`; Segmented(5), AppCard, AppTile, AppBadge, ListRow.
**Map:** `tab` default `categories` (categories/channels/accounts/debts/goals); only active block renders. Categories: incomeSources (sub→`subMain/subSide/subPassive`), expenseCategories (need→subNeed success / want→subWant). Channels: subtitle `${kind} · ${startDate} ${th?startTh:startDate}`. Accounts list. Debts: closing + revolving, subtitle `APR ${apr}% · ${minPay} ${fmt(monthly)}`, remaining in destructive. Goals: fixed order emergency, stocks, retirement, custom[]; GoalCard retire flag = kind=='retirement' (age pills when currentAge!=null; monthlyNeed vs target swap); date range `start (→ end)?`; channels/allocation chips when present; `${inflation}%`. Edge: sq gates loading/error.

### Task 23: Settings — `screens/settings.dart` (source: `app/settings.tsx`)
**Consumes:** `prefsProvider` (lang/theme/year + setters), `years`; AppHeader(back), AppCard, Segmented, ListRow, Switch, AppButton.
**Map:** Profile card (Edit = no-op). Preferences: language Segmented (en/th → `setLang`), appearance Segmented (light/dark → `setTheme`), year stepper (bounds via `years.indexOf`; disabled chevrons dimmed `border` color), notifications `Switch` (`notif` local state default true, **decorative**), currency (static). More list (security/connectedBanks/help = no-op ListRows) + Sign out AppButton (no-op). No async → no loading/error.

### Task 24: Add transaction (modal) — `screens/add_transaction.dart` (source: `app/add.tsx`)
**Consumes:** `categoriesProvider`, `accountsProvider`, `createTransaction`.
**Map:** Header close → `context.pop()`. State: `type` default `expense`, `amount` string default `'0'`, `catKey` default `'food'`, `acct` default `''`. Type toggle (expense/income). Category grid only when `type=='expense'` (`cats` = filter by type). Account chooser; `activeAcct = acct || accounts.first?.name || ''`. On-screen keypad: `press(k)` — del (len<=1 → '0'), '.' only if none present, digits capped ~len<=9; `disp` groups integer part, keeps decimal. Save: `value = (parseFloat(amount)||0).round()`; if `<=0` → `pop()` (no create); else `createTransaction(name: catLabel-or-cat, cat: catKey, acct: activeAcct, amount: value)` then `pop()`. Loading → Save button spinner/disabled (`create.isPending`-equivalent: a local `saving` bool). No onError.

### Task 25: Menu (modal) — `screens/menu.dart` (source: `app/menu.tsx`)
**Consumes:** `navItems`; AppTile.
**Map:** Header `nav.more` + close → pop. 3-column grid (width ~31%, gap 12) of all 12 `navItems`; each tile uses `doc` tint, label `nav[item.key]`, icon size 19. `go(route)`: `pop()` then push the route (faithful: `context.pop(); context.push(route);`). Order = navItems order.

### Task 26: Day detail (modal) — `screens/day_detail.dart` (source: `app/day/[day].tsx`)
**Consumes:** route param `day`, `billsProvider(null)`, `toggleBillPaid`; AppTile, AppIcon.
**Map:** `dayNum = int.parse(day)`; const MONTH {en:'June',th:'มิถุนายน'}; date string `th? '$dayNum มิถุนายน 2026' : 'June $dayNum, 2026'`. `dayBills = bills.where(dueDay==dayNum)`. Each row checkbox → `toggleBillPaid(id)`; paid → primary fill + white check + strikethrough muted; name `th?th:name`; `fmt(amount)`. Empty → EmptyView(icon 'calendar', label `upcoming`). No explicit loading/error (faithful). Close → pop.

### Task 27: Debt detail — `screens/debt_detail.dart` (source: `app/debt/[id].tsx`)
**Consumes:** route `id`, `debtProvider(id)`, `debtScheduleProvider(id)`, `payDebt`; AppHeader(back), Segmented, AppCard, ProgressBar, AppButton.
**Map:** Hero balance/progress (`pct(progress)`, `fmt(remaining)`, payoff `th?payoffTh:payoff`). `tab` default `overview`. Overview: definition rows (`method` = calc reducing→`calcReducing` else `calcFlat`; apr, monthly, payoff) + pay actions: 'Pay this month' AppButton → `payDebt(id)` (busy via `pay` pending → local `paying` bool, disabled). Schedule tab: gate on `debtScheduleProvider`; table COLS `[0.5,1,1,1,1.1]`; rows `schedule.take(24)` (#, payment, principal, interest, balance); interest column + totals tinted `destructive`. Empty schedule → null. Edge: debt query gates body.

### Task 28: Transaction detail (modal) — `screens/tx_detail.dart` (source: `app/tx/[id].tsx`)
**Consumes:** route `id`, `transactionProvider(id)`, `categoriesProvider`; AppTile, AppButton.
**Map:** Loading guard: while loading or tx null → LoadingView. Icon tile (`catMap[tx.cat]` fallback circle/doc), name, income=amount>=0 → `signed` green else `-fmt`; table category(`th?th:label` else key)/account/date(raw string)/note(`tx.note` or '—'). Edit button = no-op; Delete button → `pop()` (no API delete — faithful). Close → pop. No error state (faithful).

---

## Phase 4 — Verification gate

### Task 29: Static + tests + build
- [ ] **Step 1:** `cd app && dart format .` then `flutter analyze` — Expected: clean (0 issues).
- [ ] **Step 2:** `cd app && flutter test` — Expected: all green (format, i18n, palette, prefs, models, api_client, providers, charts, widgets, smoke).
- [ ] **Step 3:** Add/confirm `app/test/smoke_test.dart`: pump `CashflowKubApp` inside `ProviderScope` overriding `apiClientProvider` (or the per-resource providers) with canned data; `await tester.pumpAndSettle()`; expect the dashboard greeting text and that tapping the Bills tab shows the bills summary. Run it.
- [ ] **Step 4:** `cd app && flutter build apk --debug` (or `flutter build web`) — Expected: build succeeds.
- [ ] **Step 5:** Commit.

### Task 30: Live parity check (manual gate)
- [ ] **Step 1:** Start API: `cd api && go run .` (migrates + seeds + serves :8080). Verify `curl localhost:8080/api/v1/dashboard`.
- [ ] **Step 2:** `cd app && flutter run -d <device> --dart-define=API_BASE_URL=http://localhost:8080` (Android emulator uses `http://10.0.2.2:8080`).
- [ ] **Step 3:** Walk every screen + modal; toggle EN/TH, light/dark, year; add a transaction; mark a bill paid; log a debt payment. Confirm parity vs `mobile/`. Record any gaps and fix before proceeding.
- [ ] **Step 4:** Only when all gate criteria (Global Constraints) pass, continue to Phase 5.

---

## Phase 5 — Cleanup (only after the gate passes)

### Task 31: Remove `mobile/`
- [ ] **Step 1:** `git rm -r mobile/`
- [ ] **Step 2:** `cd app && flutter analyze && flutter test` — Expected: still green (app has no dependency on `mobile/`).
- [ ] **Step 3:** Commit: `git commit -m "chore: remove React Native mobile app (ported to Flutter app/)"`

### Task 32: Rewrite root README
- [ ] **Step 1:** Edit `README.md`: keep the title + the **API** section (run steps, endpoint reference link). Replace the stack table `mobile` row with a Flutter row (`app/` · Flutter 3.44 · Dart · Riverpod · go_router · http). Replace "## 2. Run the mobile app" with "## 2. Run the Flutter app": `cd app && flutter pub get && flutter run --dart-define=API_BASE_URL=http://localhost:8080` (note Android `10.0.2.2`). Replace the project-layout tree's `mobile/` subtree with the `app/lib/src/{core,models,data,widgets,screens}` structure. Update the "Verify" section: `cd app && flutter analyze && flutter test`.
- [ ] **Step 2:** Commit: `git commit -m "docs: README for Flutter app"`

---

## Self-review (done while writing)

- **Spec coverage:** every screen in the spec inventory has a Task (12–28); foundation (format/palette/theme/i18n/prefs/models/api/providers) = Tasks 1–7; chrome/widgets/router = Tasks 8–11; mutations + invalidations match `hooks.ts`; deletion + README gated behind Task 29/30 = Tasks 31/32. ✔
- **Placeholder scan:** no "TBD/TODO"; no-op buttons are intentional faithful behavior, called out explicitly. ✔
- **Type consistency:** provider names, mutation signatures, widget constructors, and palette field names are defined once (Tasks 2,7,8,9,10) and referenced consistently by screens. ✔
- **Known faithful quirks preserved:** June-2026 hardcoded calendar (Tasks 13,26); hardcoded English `Pay first · APR`/`Tap to retry`/`Something went wrong` (Tasks 12, 9); decorative notifications switch & period segment (Tasks 23,19); tx delete/edit no-op (Task 28). ✔

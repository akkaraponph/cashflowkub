# Transaction Sheet (ธุรกรรมรายวัน) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/transactions` into a Google-Sheets-style grid where many transactions can be typed or pasted in one sitting, with a month filter, a summary panel and column totals.

**Architecture:** Extend the existing `Transaction` model (no new table) with interest/fee/goal columns and add `saving`/`debt` categories. Pure row logic (validation, paste parsing, summaries) lives in `src/lib/tx-sheet.ts` so client and tests share it. A client `TxSheet` grid saves each row through the existing REST API (`apiFetch`) when focus leaves the row; pasted blocks go through a new all-or-nothing batch endpoint.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7 (Postgres), Zod 4, Tailwind 4, shadcn/radix, lucide-react, sonner, Vitest.

**Spec:** The user's request in chat (2026-10-17) plus the reference sheet screenshot: "when I need to add multiple transactions I cannot add them" — the sheet layout with columns วันที่ / กิจกรรม / รายการ / ช่องทางรับเงิน-จ่ายเงิน / ยอดเงิน / กรณีชำระหนี้สิน (ดอกเบี้ย, ค่าธรรมเนียมอื่นๆ) / กรณีเงินสะสม (เลือกเป้าหมาย) / โน้ต, summary box (รายรับ, เงินสะสม/การลงทุน, ค่าใช้จ่ายจำเป็น, ค่าใช้จ่ายอื่นๆ, ชำระหนี้สิน), totals, month filter.

## Deviations from the request (my calls — check these)

- **No Server Actions, no React Hook Form, no UUIDs.** The app already uses REST routes under `/api/v1` + `apiFetch`, Zod, int ids and integer-baht `amount`. Following that instead of adding a parallel stack. RHF isn't installed and isn't needed for a grid.
- **กิจกรรม (รับเงิน/จ่ายเงิน) is derived from amount sign**, as the app already does (negative = expense). The cell is still a dropdown; it flips the sign.
- **รายการ = existing `Category`**, **ช่องทาง = existing `acct`** (account name), **description = existing `name`**, **โน้ต = existing `note`**.
- **Default month = current month** (not hard-coded January 2026).
- **Mobile (< md) keeps the current grouped list**; the grid shows at md and up.

## Global Constraints

- Amounts are integer baht, as today (`z.number().int()`); interest/fee are integers ≥ 0.
- Month param format: `?month=YYYY-MM`; invalid → fall back to current month (`today()` from `@/lib/clock`).
- All user-facing strings go through `src/lib/i18n.ts` (en + th).
- No new runtime dependencies.
- Commit after every task; messages in the repo's `feat(tx): …` style ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Half-filled row then focus leaves** — must not POST; row stays marked "incomplete" (amber left edge), no toast spam. → Task 2 `validateRow` test + Task 4 behavior.
2. **Amount typed as `1,358.00`, `-100`, `฿550`** — parse to 1358 / 100 (sign comes from กิจกรรม) / 550. → Task 2 `parseAmount` test.
3. **Pasted block with Thai date `1 ม.ค. 2026` or `2026-01-01`, mixed blank lines** — both dates accepted, blank lines skipped, one bad line rejects the whole paste with its line number. → Task 2 + Task 3 tests.
4. **Fast typing on a new row: blur fires twice before the first POST returns** — must create once, then PATCH. → Task 4 per-row in-flight guard.
5. **Month boundaries** — 31 Jan included, 1 Feb excluded, December rolls to next year. → Task 2 `monthRange` test.

---

### Task 1: Schema — interest, fee, goal; saving & debt categories

**Files:**
- Modify: `cashflowkub/prisma/schema.prisma` (model `Transaction`, `Category.sub` doc comment)
- Create: `cashflowkub/prisma/migrations/20261017000000_tx_sheet/migration.sql`
- Modify: `cashflowkub/prisma/seed-data.ts` (categories)
- Modify: `cashflowkub/src/server/transaction/logic.ts` (`TxView`, `toTxView`)
- Modify: `cashflowkub/src/server/transaction/service.ts` (`txSchema`, `listTransactions`)
- Test: `cashflowkub/tests/api/transactions.test.ts`

**Interfaces:**
- Produces: `Transaction.interest Int @default(0)`, `Transaction.fee Int @default(0)`, `Transaction.goal String @default("")`; `TxView` gains `interest: number; fee: number; goal: string; isoDate: string` (`YYYY-MM-DD`); `TxFilter` already has `from`/`to` — unchanged. Categories `{ key: 'saving', label: 'Savings & Investing', th: 'เงินสะสม / การลงทุน', type: 'expense', sub: 'saving', icon: 'piggy-bank' }` and `{ key: 'debt', label: 'Debt payment', th: 'ชำระหนี้สิน', type: 'expense', sub: 'debt', icon: 'hand-coins' }`. `Category.sub` is now `need | want | saving | debt`.

- [ ] **Step 1: Write failing tests** in `tests/api/transactions.test.ts`:
  - `POST` with `{ name:'KTC', cat:'debt', acct:'SCB Current', amount:-1358, interest:120, fee:15 }` → 201, `toMatchObject({ interest:120, fee:15, goal:'' })`.
  - `POST` with `interest:-1` → 400.
  - Existing first-row `toEqual` in the GET test updated to include `interest:0, fee:0, goal:'', isoDate:'2026-06-18'`.
- [ ] **Step 2:** `pnpm test:api -- transactions` → FAIL (unknown fields / missing keys).
- [ ] **Step 3:** Add the three columns + migration SQL (`ALTER TABLE "transactions" ADD COLUMN "interest" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "fee" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "goal" TEXT NOT NULL DEFAULT '';` plus `INSERT INTO "categories"` for the two rows, `ON CONFLICT ("key") DO NOTHING`). Add the two categories to `seed-data.ts` (sort 8, 9). Extend `txSchema` with `interest: z.number().int().min(0).optional()`, `fee` same, `goal: z.string().optional()`. Add the fields + `isoDate` to `toTxView`. Run `pnpm prisma generate`. Update `tests/api/seed.test.ts` category count if it asserts one.
- [ ] **Step 4:** `pnpm test && pnpm typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(tx): interest, fee and goal on transactions; saving and debt categories`.

### Task 2: Pure sheet logic

**Files:**
- Create: `cashflowkub/src/lib/tx-sheet.ts`
- Test: `cashflowkub/tests/unit/tx-sheet.test.ts`

**Interfaces:**
- Consumes: `parseFlexDate` from `@/server/transaction/logic` (pure, safe to import), `Category` type.
- Produces:
  ```ts
  export type Activity = 'income' | 'expense';
  export interface RowDraft { id?: number; date: string /*YYYY-MM-DD*/; activity: Activity; cat: string; acct: string; amount: string; interest: string; fee: string; goal: string; note: string; name: string }
  export interface TxBody { name: string; cat: string; acct: string; amount: number; interest: number; fee: number; goal: string; note: string; date: string }
  export type RowCheck = { kind: 'empty' } | { kind: 'incomplete'; missing: (keyof RowDraft)[] } | { kind: 'ready'; body: TxBody };
  export function parseAmount(raw: string): number | null;          // strips ฿ , spaces and leading -, rounds; null if not a finite number
  export function validateRow(d: RowDraft, cats: Category[]): RowCheck;
  export function draftFromView(t: TxView): RowDraft;
  export function parseThaiOrIsoDate(raw: string): string | null;   // '1 ม.ค. 2026' | '1 ม.ค. 2569' (BE if year > 2400) | '2026-01-01' → '2026-01-01'
  export function parsePaste(text: string, defaults: { date: string; acct: string }, cats: Category[]): { ok: true; bodies: TxBody[] } | { ok: false; line: number; error: string };
  export function monthRange(month: string /*YYYY-MM*/): { from: Date; to: Date } | null;
  export function summarize(rows: Pick<TxView,'cat'|'amount'>[], cats: Category[]): { income: number; saving: number; need: number; want: number; debt: number };
  export function columnTotals(rows: Pick<TxView,'amount'|'interest'|'fee'>[]): { income: number; expense: number; interest: number; fee: number };
  ```
  Paste columns are tab-separated in sheet order: date, activity (`รับเงิน|จ่ายเงิน|income|expense`), category (key, label or th), account, amount, interest, fee, goal, note. Missing trailing columns are fine; missing date/account use `defaults`. `name` = note if non-empty else the category label.

- [ ] **Step 1: Write failing tests** (one `it` per bullet):
  - `parseAmount('1,358.00')===1358`, `parseAmount('฿550')===550`, `parseAmount('-100')===100`, `parseAmount('abc')===null`, `parseAmount('')===null`.
  - `validateRow` on an all-blank draft → `{kind:'empty'}`; with only amount → `incomplete` with `missing` containing `'cat'` and `'acct'`; complete expense draft amount `'100'` → `ready` with `body.amount===-100`; income → `+100`; amount `'0'` → incomplete `['amount']`.
  - `parseThaiOrIsoDate('1 ม.ค. 2026')==='2026-01-01'`, `('31 ธ.ค. 2569')==='2026-12-31'`, `('2026-02-30')===null`.
  - `parsePaste` of `"1 ม.ค. 2026\tรับเงิน\tincome\tKasikorn Savings\t100\t\t\t\tย่าให้\n\n2 ม.ค. 2026\tจ่ายเงิน\tdebt\tSCB Current\t550\t20\t5"` → 2 bodies, second `{amount:-550, interest:20, fee:5}`; a paste where line 2 amount is `x` → `{ok:false,line:2}`.
  - `monthRange('2026-01')` → from `2026-01-01`, to `2026-01-31`; `('2026-12')` to `2026-12-31`; `('2026-13')===null`.
  - `summarize` over seed-like rows buckets income (amount>0), then expense by `cat.sub` (`need|want|saving|debt`; unknown sub → `want`), as positive numbers.
  - `columnTotals` sums income/expense separately (expense positive).
- [ ] **Step 2:** `pnpm test:unit -- tx-sheet` → FAIL (module missing).
- [ ] **Step 3:** Implement in `src/lib/tx-sheet.ts`. Thai month abbreviations: `ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.`.
- [ ] **Step 4:** `pnpm test:unit -- tx-sheet` → PASS.
- [ ] **Step 5:** Commit `feat(tx): sheet row parsing, paste and summaries`.

### Task 3: Batch create endpoint

**Files:**
- Create: `cashflowkub/src/app/api/v1/transactions/batch/route.ts`
- Modify: `cashflowkub/src/server/transaction/service.ts`
- Test: `cashflowkub/tests/api/transactions.test.ts`

**Interfaces:**
- Consumes: `txSchema` (Task 1).
- Produces: `createTransactions(body: unknown): Promise<TxView[]>` — body `{ items: TxBody[] }`, 1–500 items, all inside `prisma.$transaction`; `POST /api/v1/transactions/batch` → 201 `{ data: TxView[] }` via existing `created`/`list` helpers (match whichever shape `list` produces).

- [ ] **Step 1: Write failing tests:** posting 3 valid items → 201, `data` length 3, `GET` now returns 15; posting 2 valid + 1 with `amount:0` → 400 and `GET` still returns 12; `items: []` → 400.
- [ ] **Step 2:** `pnpm test:api -- transactions` → FAIL (404/import error).
- [ ] **Step 3:** Implement `createTransactions` with `z.object({ items: z.array(txSchema).min(1).max(500) })`, then the route.
- [ ] **Step 4:** `pnpm test:api` → PASS.
- [ ] **Step 5:** Commit `feat(tx): batch create endpoint`.

### Task 4: `TxSheet` grid component

**Files:**
- Create: `cashflowkub/src/components/cfk/tx-sheet.tsx` (client)
- Modify: `cashflowkub/src/lib/i18n.ts` (en + th keys below)

**Interfaces:**
- Consumes: everything in Task 2; `apiFetch`; `POST /transactions`, `PATCH /transactions/:id`, `DELETE /transactions/:id` (verify verbs in `src/app/api/v1/transactions/[id]/route.ts`), `POST /transactions/batch`.
- Produces: `export function TxSheet(props: { rows: TxView[]; categories: Category[]; accounts: Account[]; goals: { name: string }[]; month: string; defaultDate: string }): JSX.Element`.
- i18n keys (`ui.sheet.*`): `title` "Daily transactions"/"บันทึกธุรกรรมรายวัน", `date` วันที่, `activity` กิจกรรม, `category` รายการ, `channel` "ช่องทางรับเงิน - จ่ายเงิน", `amount` ยอดเงิน, `debtCase` กรณีชำระหนี้สิน, `interest` ดอกเบี้ย, `fee` "ค่าธรรมเนียมอื่นๆ (ไม่รวมดอกเบี้ย)", `savingCase` กรณีเงินสะสม, `goal` เลือกเป้าหมาย, `note` โน้ต, `incomeAct` รับเงิน, `expenseAct` จ่ายเงิน, `total` รวม, `pasted` "Added {n} rows"/"เพิ่ม {n} รายการ", `hint` "Paste rows from Sheets/Excel to add many at once"/"วางหลายแถวจาก Sheets/Excel เพื่อเพิ่มทีละหลายรายการ".

Behaviour (the decisions; layout details are the builder's):
- Dense `<table>` (`text-xs`, ~28px rows, row-number gutter, two-level header for the debt/saving groups), styled with existing tokens. Cells are bare `<input>`/`<select>`; income amounts green, expense red, as in the screenshot.
- Interest/fee cells enabled only when the row's category `sub === 'debt'`; goal select only when `sub === 'saving'`; otherwise rendered as the grey disabled block from the sheet.
- Always 20 blank rows after the last saved row; filling one adds more.
- **Save on row blur** (focus moves to a cell in another row or outside the table): `validateRow` → `empty`: nothing; `incomplete`: amber left border on the row, no request; `ready`: POST if no `id` else PATCH only if changed. Keep a per-row `inFlight` promise; a second blur awaits it and then PATCHes with the new id — never double-creates.
- Keyboard: Enter / ↓ next row same column, ↑ previous, Tab / Shift-Tab across cells (native), Esc reverts the cell to its last saved value.
- Row-number gutter on hover shows a trash button → `DELETE`, row removed.
- `onPaste` on any cell: if clipboard text contains a tab or newline, `parsePaste` with `{ date: defaultDate, acct: accounts[0].name }`; `ok` → `POST /transactions/batch`, toast `pasted`, `router.refresh()`; error → toast `Line {line}: {error}` and insert nothing. Single-value paste falls through to the input.
- `<tfoot>` row: income total, expense total, interest total, fee total from `columnTotals` over saved rows.
- Failures toast via `sonner` and leave the draft in place.

- [ ] **Step 1:** Implement the component and i18n keys.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint` → clean.
- [ ] **Step 3:** Commit `feat(tx): spreadsheet grid for transactions`.

(UI is verified in the browser in Task 5; the logic it relies on is already unit-tested.)

### Task 5: Page — month filter, summary panel, sheet

**Files:**
- Modify: `cashflowkub/src/app/(app)/transactions/page.tsx`
- Create: `cashflowkub/src/components/cfk/tx-summary.tsx` (server-safe, presentational)
- Modify: `cashflowkub/tests/e2e/pages.test.ts` if it snapshots `/transactions`

**Interfaces:**
- Consumes: `monthRange`, `summarize` (Task 2), `TxSheet` (Task 4), `listTransactions({ from, to })`, `listResource('categories' | 'accounts' | 'goals')`.
- Produces: `TxSummary({ totals: ReturnType<typeof summarize> })` — five rows รายรับ / เงินสะสม/การลงทุน / ค่าใช้จ่ายจำเป็น / ค่าใช้จ่ายอื่นๆ / ชำระหนี้สิน with ฿ amounts.

- [ ] **Step 1:** Page reads `?month=YYYY-MM` (fallback current month), fetches rows for `monthRange`, sorts ascending by date then id for the sheet. Header: title + month name/year, ‹ › links to previous/next month, and a `<input type="month">` that navigates. Layout at md+: `TxSummary` left (~220px), `TxSheet` right with horizontal scroll; below md: summary then the existing grouped `TxRow` list (keep the `type` segmented filter there).
- [ ] **Step 2:** `pnpm test && pnpm typecheck && pnpm lint` → PASS.
- [ ] **Step 3: Browser check** with `pnpm dev` at `http://localhost:3000/transactions?month=2026-06`: type 3 new rows using only keyboard; confirm each persists after reload; paste the Task 2 two-line sample and see 2 rows + summary update; leave a row half-filled and confirm the amber marker and no request; delete a row; check ‹ › month nav and that the tfoot totals match the summary.
- [ ] **Step 4:** Commit `feat(tx): monthly sheet view with summary`.

# Transaction Activities Implementation Plan (roadmap phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every transaction one of the spreadsheet planner's six activities and the item it applies to, and reject rows the planner would silently miscount.

**Architecture:** Add two columns to `transactions`: `activity` and `item`. `item` is a **name** reference, the same pattern `acct` and `goal` already use, with uniqueness, rename-cascade and in-use guards. One pure module, `src/lib/activity.ts`, holds the rules. The server (Zod and service) and the client sheet (`tx-sheet.ts`) both import it, so the two can't drift apart. Existing rows are backfilled by the migration.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7 (PostgreSQL), Zod 4, Vitest (`unit`, `api`, `e2e`).

**Spec:** `docs/knowledge/spreadsheet-planner.md` §2 (activities, direction), §4 (daily grid columns), §13 (pain points: rows without item or account). Roadmap: `docs/superpowers/plans/2026-10-18-planner-gaps-roadmap.md`.

## Calls I made (check these)

- **Activity keys** are `receive | pay | save | pay_debt | withdraw | transfer` (planner: รับเงิน, จ่ายเงิน, สะสมเงิน, ชำระหนี้, เบิกเงิน, เปลี่ยนบัญชี).
- **What `item` names, by activity:**
  - `receive`: an `IncomeCategory.name`. Optional; blank means "other income".
  - `save`, `withdraw`: a `Channel.name`. Required.
  - `pay_debt`: a `Debt.name`. Required.
  - `transfer`: the **source** `Account.name`. `acct` is the destination; this matches the planner's "into an account, out of the account named as item". Required, and it must not equal `acct`.
  - `pay`: always `''`. The expense category in `cat` is the item.
- **`cat` for activities other than `pay` is set by the server**: `receive` → `income`, `save` → `saving`, `pay_debt` → `debt`, `withdraw` and `transfer` → `''`. For `pay`, `cat` must be an expense category whose `sub` is not `saving` or `debt`.
- **`acct` must name an existing `Account`** (400 `unknownAccount`). Today it is free text. This is a deliberate tightening, from planner §13.
- **No indirect withdrawal.** Credit cards are already `Account(kind=credit)`, so a payment made with one is just a `pay` from that account (see the roadmap's "Deliberately not planned").
- **Backward compatibility:** a POST without `activity` is inferred from the amount's sign and the category's `sub`, which is what the migration does too. Existing API clients keep working. A PATCH that sets neither `activity` nor `item` does not demand an item, so a legacy `save` row with a blank item can still have its note edited.
- **Sign convention stays:** money in > 0 (`receive`, `withdraw`, `transfer`), money out < 0 (`pay`, `save`, `pay_debt`). A transfer is **one row**, credited to `acct` and debited from `item`. Phase 2 turns that into balances.
- **Income/expense list filter:** `?type=income` now means `activity = receive`, and `?type=expense` means `activity in (pay, save, pay_debt)`. Withdrawals and transfers are in neither. Before this change they would have shown up as income.
- **New field names** `activity` and `item` are single words, so the `snake_case` rule is satisfied with no casing question.
- **Needs your decision, not built here:** `AGENTS.md` asks for Postman and OpenAPI updates in `docs/postman-collections/`, but that folder does not exist (the 2026-10-17 plan noted the same). This phase changes the transactions request and response. Task 7 records the new fields in the knowledge note only. Creating the collection from scratch is a separate task, if you want it.

## Global Constraints

- Activity keys exactly: `receive`, `pay`, `save`, `pay_debt`, `withdraw`, `transfer`.
- Thai labels exactly, accepted on paste and shown in the Thai UI: รับเงิน, จ่ายเงิน, สะสมเงิน, ชำระหนี้, เบิกเงิน, เปลี่ยนบัญชี.
- New error codes, each added to `ui.errors` in both `en` and `th` in `src/lib/i18n.ts`:
  - 400: `unknownAccount`, `unknownItem`, `activityMismatch`
  - 409: `channelNameTaken`, `channelInUse`, `incomeNameTaken`, `incomeInUse`, `debtNameTaken`, `debtInUse`
- Name comparisons ignore case and surrounding spaces, as `assertAccountNameFree` does (`mode: 'insensitive'`, `trim()`).
- Every user-facing string goes through `src/lib/i18n.ts` (`en` and `th`).
- No new runtime dependencies.
- From `cashflowkub/`, run tests with `pnpm test` (unit + api), type checking with `pnpm typecheck`, and lint with `pnpm lint`. Run e2e with `pnpm test:e2e` in Task 6 only.
- Commit after every task. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **A legacy row edited after the migration:** a seeded `food` row PATCHed with only `{ note }` returns 200, and its activity stays `pay`. A legacy row with `cat: 'saving'` and a blank item PATCHed with `{ note }` also returns 200 (Task 3 test).
- **Transfer to itself:** `transfer` with `item === acct`, case or spacing aside (`' scb current '`), returns 400 `activityMismatch` (Task 1 and Task 3 tests).
- **A pasted Thai sheet row where the activity cell is blank and the item cell names a channel, not a category,** fails with `unknown activity` on that line. It does not silently become a `pay` (Task 5 test).
- **Renaming an account that is the *source* of a transfer** updates that transfer's `item` as well as other rows' `acct`. Deleting that account returns 409 `accountInUse` (Task 4 test).
- **The batch endpoint with one bad item among valid ones** rejects the whole batch with 400 `unknownItem` and writes nothing (Task 3 test).

---

### Task 1: Shared activity rules

**Files:**
- Create: `cashflowkub/src/lib/activity.ts`
- Test: `cashflowkub/tests/unit/activity.test.ts`

**Interfaces:**
- Produces (`src/lib/activity.ts`):
  - `export const ACTIVITIES = ['receive', 'pay', 'save', 'pay_debt', 'withdraw', 'transfer'] as const`
  - `export type Activity = (typeof ACTIVITIES)[number]`
  - `export type ItemList = 'income' | 'channel' | 'debt' | 'account'`
  - `export function itemListFor(a: Activity): ItemList | null`: receive→income, save→channel, withdraw→channel, pay_debt→debt, transfer→account, pay→null.
  - `export function itemRequired(a: Activity): boolean`: true for save, pay_debt, withdraw, transfer.
  - `export function isInflow(a: Activity): boolean`: true for receive, withdraw, transfer.
  - `export function signedAmount(a: Activity, magnitude: number): number`: returns `+|magnitude|` for inflows and `−|magnitude|` otherwise.
  - `export function fixedCat(a: Activity): string | null`: receive `'income'`, save `'saving'`, pay_debt `'debt'`, withdraw `''`, transfer `''`, pay `null`.
  - `export function legacyActivity(amount: number, catSub: string): Activity`: amount > 0 → receive; else sub `saving` → save, sub `debt` → pay_debt, otherwise pay.
  - `export function activityFromLabel(raw: string): Activity | null`: trims and lowercases, then accepts the six keys, the six Thai labels, and the legacy `income` (→ receive) and `expense` (→ pay). Anything else, including `''`, returns null.
  - `export const ACTIVITY_TH: Record<Activity, string>`: the six Thai labels.
  - `export interface ActivityRow { activity: Activity; cat: string; acct: string; item: string; amount: number; interest: number; fee: number; goal: string }`
  - `export type ActivityProblem = 'amountSign' | 'itemRequired' | 'itemNotAllowed' | 'catNotAllowed' | 'interestOnlyOnDebt' | 'goalOnlyOnSave' | 'transferToSelf'`
  - `export function checkActivity(row: ActivityRow, catSub: string | undefined, opts?: { requireItem?: boolean }): ActivityProblem | null`
    - `catSub` is the `sub` of the `Category` whose key is `row.cat`. It is `undefined` when there is no such category.
    - Checks run in this order, and the first failure is returned:
      1. **Sign:** wrong sign for the activity → `amountSign`.
      2. **Category:** for `pay`, `catSub` undefined, `'saving'` or `'debt'` → `catNotAllowed`. For any other activity, `row.cat !== fixedCat(a)` → `catNotAllowed`.
      3. **Item:** for `pay`, a non-blank `item` → `itemNotAllowed`. If `opts.requireItem` (default `true`) is set and `itemRequired(a)`, a blank `item` → `itemRequired`.
      4. **Interest/fee:** `interest > 0 || fee > 0` on anything but `pay_debt` → `interestOnlyOnDebt`.
      5. **Goal:** a non-blank `goal` on anything but `save` → `goalOnlyOnSave`.
      6. **Self-transfer:** for `transfer`, `item.trim().toLowerCase() === acct.trim().toLowerCase()` → `transferToSelf`.

- [ ] **Step 1: Write the failing tests** in `tests/unit/activity.test.ts`:
  - `itemListFor` and `fixedCat`: table-driven over all six activities, with the values above.
  - `signedAmount('pay', 100) === -100`, `signedAmount('transfer', -50) === 50`, `signedAmount('withdraw', 7) === 7`.
  - `legacyActivity(62000, '') === 'receive'`, `legacyActivity(-100, 'saving') === 'save'`, `legacyActivity(-100, 'debt') === 'pay_debt'`, `legacyActivity(-185, 'need') === 'pay'`.
  - `activityFromLabel`:
    - `'ชำระหนี้'` → `'pay_debt'`, `' เปลี่ยนบัญชี '` → `'transfer'`, `'PAY_DEBT'` → `'pay_debt'`
    - `'income'` → `'receive'`, `'expense'` → `'pay'`
    - `''` → `null`, `'โอน'` → `null`
  - `checkActivity`, with base `{ activity: 'pay', cat: 'food', acct: 'SCB Current', item: '', amount: -185, interest: 0, fee: 0, goal: '' }` and `catSub: 'need'`:
    - the base row → `null`
    - `amount: 185` → `'amountSign'`
    - `cat: 'saving'` with catSub `'saving'` → `'catNotAllowed'`; catSub `undefined` → `'catNotAllowed'`
    - `{ activity: 'save', cat: 'saving', item: '' }` with catSub `'saving'` → `'itemRequired'`; the same with `{ requireItem: false }` → `null`
    - `{ activity: 'receive', cat: 'income', amount: 100, item: '' }` → `null` (income item optional)
    - `{ activity: 'pay', item: 'Gold savings' }` → `'itemNotAllowed'`
    - `{ activity: 'pay', interest: 5 }` → `'interestOnlyOnDebt'`
    - `{ activity: 'pay', goal: 'Japan Trip' }` → `'goalOnlyOnSave'`
    - `{ activity: 'transfer', cat: '', acct: 'SCB Current', item: ' scb current ', amount: 500 }` → `'transferToSelf'`

- [ ] **Step 2: Run the tests to verify they fail**
  Run `pnpm test:unit -- activity`. Expected: FAIL with "Cannot find module '@/lib/activity'".

- [ ] **Step 3: Implement** `src/lib/activity.ts` to match the interfaces. It must be pure, with no server imports, because the client sheet imports it.

- [ ] **Step 4: Run the tests to verify they pass**
  Run `pnpm test:unit -- activity`. Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add cashflowkub/src/lib/activity.ts cashflowkub/tests/unit/activity.test.ts
  git commit -m "feat(tx): shared activity rules"
  ```

---

### Task 2: Schema, migration backfill, seed and read view

**Files:**
- Modify: `cashflowkub/prisma/schema.prisma` (`model Transaction`)
- Create: `cashflowkub/prisma/migrations/20261018000000_tx_activity/migration.sql`
- Modify: `cashflowkub/prisma/seed-data.ts` (`transactions`)
- Modify: `cashflowkub/src/server/transaction/logic.ts` (`TxView`, `toTxView`)
- Test: `cashflowkub/tests/api/seed.test.ts`, `cashflowkub/tests/unit/transaction-logic.test.ts`

**Interfaces:**
- Produces (Prisma `Transaction`):
  - `activity String @default("pay")` with the doc comment `/// receive | pay | save | pay_debt | withdraw | transfer`
  - `item String @default("")` with the doc comment `/// income item / channel / debt / source account name, by activity`
  - `@@index([activity, item])`
- Produces: `TxView` gains `activity: Activity` and `item: string`; `toTxView` copies both. Import `Activity` from `@/lib/activity`, cast from the DB string.

- [ ] **Step 1: Write the failing tests**
  - `tests/unit/transaction-logic.test.ts`: `toTxView` of a plain row with `activity: 'save', item: 'Gold savings'` exposes both fields unchanged.
  - `tests/api/seed.test.ts`: `it('gives every seeded transaction an activity consistent with its sign')`. For every seeded transaction:
    - `amount > 0` ⇔ activity `'receive'`;
    - `item` is `''`, or for `receive` it is one of the seeded income category names.

- [ ] **Step 2: Run the tests to verify they fail**
  Run `pnpm test:unit -- transaction-logic` and `pnpm test:api -- seed`. Expected: FAIL, because `activity` is undefined.

- [ ] **Step 3: Implement**
  - Schema fields as above.
  - Migration SQL:
    - `ALTER TABLE "transactions" ADD COLUMN "activity" TEXT NOT NULL DEFAULT 'pay', ADD COLUMN "item" TEXT NOT NULL DEFAULT '';`
    - Backfill, in this order:
      - `UPDATE ... SET activity = 'receive' WHERE amount > 0`
      - `UPDATE "transactions" t SET activity = 'save' FROM "categories" c WHERE c.key = t.cat_key AND c.sub = 'saving' AND t.amount < 0`
      - the same for `'debt'` → `'pay_debt'`
    - Then `CREATE INDEX "transactions_activity_item_idx" ON "transactions"("activity", "item");`
    - Run `pnpm prisma migrate dev --create-only` only to check that the generated SQL matches. The committed file is the hand-written one, in the style of `20261017000000_tx_sheet`.
  - Seed: add `activity: 'receive', item: 'Monthly salary'` to the salary row and `activity: 'pay'` to every other row.
  - `logic.ts`: extend `TxView` and `toTxView`.

- [ ] **Step 4: Run the tests to verify they pass**
  Run `pnpm test`. The global setup runs `prisma migrate deploy` against `TEST_DATABASE_URL`, so the new migration is applied. Expected: all PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add cashflowkub/prisma cashflowkub/src/server/transaction/logic.ts cashflowkub/tests
  git commit -m "feat(tx): activity and item columns with backfill"
  ```

---

### Task 3: Server validation for create, batch, update and filters

**Files:**
- Create: `cashflowkub/src/server/transaction/refs.ts`
- Modify: `cashflowkub/src/server/transaction/service.ts` (`txSchema`, `createTransaction`, `createTransactions`, `updateTransaction`, `buildWhere`)
- Modify: `cashflowkub/src/server/transaction/logic.ts` (`TxFilter`, `parseTxFilter`)
- Modify: `cashflowkub/src/lib/i18n.ts` (`ui.errors`: `unknownAccount`, `unknownItem`, `activityMismatch`, in `en` and `th`)
- Test: `cashflowkub/tests/api/transactions.test.ts`

**Interfaces:**
- Consumes: everything in `@/lib/activity` (Task 1).
- Produces (`refs.ts`): `export async function assertActivityRefs(tx: Prisma.TransactionClient, row: { activity: Activity; acct: string; item: string }): Promise<void>`. It matches names case-insensitively, after trimming:
  - `acct` is not an `Account.name` → `badRequest('unknown account', 'unknownAccount')`.
  - A non-blank `item` is not in `itemListFor(activity)`'s table (`incomeCategory`, `channel`, `debt` or `account`) → `badRequest('unknown item', 'unknownItem')`.
- Produces (`service.ts`):
  - `txSchema` gains `activity: z.enum(ACTIVITIES).optional()` and `item: z.string().trim().optional()`. `cat` becomes `z.string().optional()`.
  - A shared resolver `async function resolveRow(tx, input, current?: TxPlain, opts?: { requireItem: boolean }): Promise<ResolvedRow>`:
    1. Merges `input` over `current`.
    2. Picks the activity: `input.activity`, else `current.activity`, else `legacyActivity(amount, catSub)`. When there is no activity and no `cat`, it throws `badRequest('cat or activity required', 'validation')`.
    3. Sets `cat` from `fixedCat` when that is not null.
    4. Calls `checkActivity`. Any problem is thrown as `badRequest(problem, 'activityMismatch')`.
    5. Calls `assertActivityRefs`.
  - On PATCH, `requireItem` is `true` only when the body sets `activity` or `item`.
- Produces (`logic.ts`): `TxFilter.activity?: Activity`, read from `?activity=` (unknown values are ignored, as `type` is). `buildWhere`:
  - `type: 'income'` → `{ activity: 'receive' }`
  - `type: 'expense'` → `{ activity: { in: ['pay', 'save', 'pay_debt'] } }`
  - `activity` → `{ activity }`

- [ ] **Step 1: Write the failing tests** in `tests/api/transactions.test.ts`. Change existing tests that use a non-seeded `acct` to a seeded account name. New tests:
  - `it('infers activity when omitted')`: POST `{ name: 'x', cat: 'food', acct: 'SCB Current', amount: -50 }` → 201, `activity: 'pay'`.
  - `it('sets cat from the activity')`: POST `{ name: 'Gold', activity: 'save', item: 'Gold savings', acct: 'SCB Current', amount: -1000 }` → `cat: 'saving'`.
  - `it('records a transfer')`: `{ activity: 'transfer', item: 'SCB Current', acct: 'Cash Wallet', amount: 500, name: 'ATM' }` → 201.
  - `it('rejects activity problems')`: each of these → 400 `activityMismatch`:
    - `pay` with `amount: 50`
    - `save` without `item`
    - transfer to self
    - `pay` with `goal`
  - `it('rejects unknown account and item')`: `acct: 'Nope'` → 400 `unknownAccount`; `save` with `item: 'Nope'` → 400 `unknownItem`.
  - `it('lets a legacy row be edited without an item')`: create directly with `prisma.transaction.create` (`activity: 'save', cat: 'saving', item: ''`), then PATCH `{ note: 'n' }` → 200. PATCH `{ activity: 'save' }` → 400 `activityMismatch`.
  - `it('rejects the whole batch on one unknown item')`: batch of two, the second with `item: 'Nope'`. The response is 400 `unknownItem`, and the transaction count is unchanged.
  - `it('keeps transfers out of the income filter')`: after the transfer above, `GET ?type=income` contains no row with `activity: 'transfer'`, and `GET ?activity=transfer` returns it.

- [ ] **Step 2: Run the tests to verify they fail**
  Run `pnpm test:api -- transactions`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement** `refs.ts` and the service changes. In `createTransactions`, resolve each item inside one `prisma.$transaction(async (tx) => …)` so that any failure rolls back the batch. Add the three i18n error strings.

- [ ] **Step 4: Run the tests to verify they pass**
  Run `pnpm test && pnpm typecheck`. Expected: PASS, no type errors.

- [ ] **Step 5: Commit**
  ```bash
  git add cashflowkub/src cashflowkub/tests
  git commit -m "feat(tx): validate activity, item and account on write"
  ```

---

### Task 4: Name references for channels, income items, debts and transfer sources

**Files:**
- Create: `cashflowkub/src/server/reference/channels.ts`, `cashflowkub/src/server/reference/income.ts`, `cashflowkub/src/server/debt/refs.ts`
- Modify: `cashflowkub/src/server/reference/accounts.ts` (`renameAccountInTransactions`, `assertAccountUnused`)
- Modify: `cashflowkub/src/server/reference/service.ts`: replace the per-resource `if` chains with a lookup table
- Modify: `cashflowkub/src/server/debt/service.ts`: create, update and delete call the debt guards
- Modify: `cashflowkub/src/lib/i18n.ts` (`ui.errors`, the six 409 codes, `en` and `th`)
- Test: `cashflowkub/tests/api/reference.test.ts`, `cashflowkub/tests/api/accounts.test.ts`, `cashflowkub/tests/api/debts.test.ts`

**Interfaces:**
- Produces, mirroring `goals.ts` (same three functions, same `Tx` type):
  - `channels.ts`: `assertChannelNameFree(tx, name, exceptId?)` (409 `channelNameTaken`), `renameChannelInTransactions(tx, from, to)` (updates `item` where `activity in ('save','withdraw')`), `assertChannelUnused(tx, name)` (409 `channelInUse`).
  - `income.ts`: `assertIncomeNameFree` (409 `incomeNameTaken`), `renameIncomeInTransactions` (where `activity = 'receive'`), `assertIncomeUnused` (409 `incomeInUse`).
  - `debt/refs.ts`: `assertDebtNameFree` (409 `debtNameTaken`), `renameDebtInTransactions` (where `activity = 'pay_debt'`), `assertDebtUnused` (409 `debtInUse`).
  - `accounts.ts`: the rename also updates `item` where `activity = 'transfer'`. The unused check counts rows where `acct = name` **or** (`activity = 'transfer'` and `item = name`).
- Produces (`reference/service.ts`): `const NAME_REFS: Partial<Record<ResourceName, { table: 'account' | 'goal' | 'channel' | 'incomeCategory'; free; rename; unused }>>` covering `accounts`, `goals`, `channels` and `'income-categories'`. `createResource`, `updateResource` and `deleteResource` use one code path when `NAME_REFS[name]` exists. Behaviour for accounts and goals is unchanged, and their existing tests must pass untouched.

- [ ] **Step 1: Write the failing tests**
  - `reference.test.ts`, for both `channels` and `income-categories`:
    - a duplicate name (`' gold SAVINGS '`) → 409 with the `*NameTaken` code;
    - a rename cascades to the `item` of a transaction created through the API in Task 3's shape;
    - deleting a resource that is in use → 409 `*InUse`; deleting an unused one → 204.
  - `accounts.test.ts`: `it('renames and guards the source of a transfer')`. Create a transfer from `SCB Current` to `Cash Wallet`. Rename `SCB Current` and check that the transfer's `item` follows. Deleting the renamed account → 409 `accountInUse`.
  - `debts.test.ts`: a duplicate debt name → 409 `debtNameTaken`. A rename cascades to a `pay_debt` transaction's `item`. Deleting the debt → 409 `debtInUse`.

- [ ] **Step 2: Run the tests to verify they fail**
  Run `pnpm test:api -- reference accounts debts`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement** the guard modules, the `NAME_REFS` table and the debt service calls. In the debt service, wrap create/update/delete in `prisma.$transaction` where they are not already. Add the i18n strings.

- [ ] **Step 4: Run the tests to verify they pass**
  Run `pnpm test`. Expected: all PASS, including the untouched goals and accounts tests.

- [ ] **Step 5: Commit**
  ```bash
  git add cashflowkub/src cashflowkub/tests
  git commit -m "feat(tx): name guards for channels, income items, debts"
  ```

---

### Task 5: Sheet logic: drafts, validation, paste and summaries

**Files:**
- Modify: `cashflowkub/src/lib/tx-sheet.ts`
- Test: `cashflowkub/tests/unit/tx-sheet.test.ts`

**Interfaces:**
- Consumes: `Activity`, `checkActivity`, `fixedCat`, `itemRequired`, `signedAmount`, `activityFromLabel`, `legacyActivity` from `@/lib/activity`.
- Produces:
  - Remove the local `type Activity = 'income' | 'expense'` and re-export `Activity` from `@/lib/activity`.
  - `RowDraft` gains `item: string`. `TxBody` gains `activity: Activity` and `item: string`.
  - `validateRow(d, cats)`:
    - `cat` is required only for `pay`, and `item` only when `itemRequired(d.activity)`. A missing `item` is reported as `'item'`.
    - A filled row is checked with `checkActivity` (catSub from `cats`). A problem returns `{ kind: 'incomplete', missing: [<the field the problem points at>] }`. The mapping:
      - `amountSign` → `'amount'`
      - `catNotAllowed` → `'cat'`
      - `itemRequired`, `itemNotAllowed`, `transferToSelf` → `'item'`
      - `interestOnlyOnDebt` → `'interest'`
      - `goalOnlyOnSave` → `'goal'`
    - The body uses `signedAmount`, and `cat` is `fixedCat(activity) ?? d.cat`.
  - `draftFromView(t)` reads `t.activity` and `t.item`.
  - `parsePaste`: the column order stays the same (date, activity, category-or-item, account, amount, interest, fee, goal, note). The rules:
    - The activity cell goes through `activityFromLabel`.
    - A blank activity cell is allowed only when column 3 matches a category. In that case the activity is `legacyActivity(sign, category.sub)`, and for an income category it is `receive`. Otherwise the line fails with `unknown activity`.
    - For `pay`, column 3 must match an expense category. For other activities, column 3 is the item.
    - Each body is checked with `checkActivity`, and a problem fails that line with the problem key.
  - `summarize(rows: Pick<TxView, 'activity' | 'cat' | 'amount'>[], cats)`: receive → income, save → saving, pay_debt → debt, pay → need or want by the category's `sub`. Withdraw and transfer are skipped.
  - `columnTotals(rows: Pick<TxView, 'activity' | 'amount' | 'interest' | 'fee'>[])`: `income` sums receive, `expense` sums pay, save and pay_debt. Withdraw and transfer count toward neither.

- [ ] **Step 1: Write the failing tests** in `tests/unit/tx-sheet.test.ts`. Add `item: ''` to existing draft fixtures and change their activity from `'expense'`/`'income'` to `'pay'`/`'receive'`. New tests:
  - `validateRow`:
    - a `save` draft without an item → `{ kind: 'incomplete', missing: ['item'] }`;
    - a `transfer` draft (`acct: 'Cash Wallet', item: 'SCB Current', amount: '500'`) → `ready`, with body `amount: 500` and `cat: ''`.
  - `parsePaste`:
    - `"2026-06-01\tสะสมเงิน\tGold savings\tSCB Current\t1000"` → one body with `activity: 'save', item: 'Gold savings', amount: -1000, cat: 'saving'`;
    - `"2026-06-01\t\tGold savings\tSCB Current\t1000"` → `{ ok: false, line: 1, error: 'unknown activity' }`;
    - `"2026-06-01\tจ่ายเงิน\tfood\tSCB Current\t50\t5"` → fails with `interestOnlyOnDebt`.
  - `summarize` and `columnTotals` ignore a `transfer` row of 500 and a `withdraw` row of 300.

- [ ] **Step 2: Run the tests to verify they fail**
  Run `pnpm test:unit -- tx-sheet`. Expected: FAIL.

- [ ] **Step 3: Implement** the changes to `tx-sheet.ts`.

- [ ] **Step 4: Run the tests to verify they pass**
  Run `pnpm test:unit -- tx-sheet && pnpm typecheck`. Expected: the tests PASS. Type errors are expected only in `tx-sheet.tsx`, `tx-summary.tsx` and `tx-row.tsx`, which Task 6 fixes; note them, don't fix them here.

- [ ] **Step 5: Commit**
  ```bash
  git add cashflowkub/src/lib/tx-sheet.ts cashflowkub/tests/unit/tx-sheet.test.ts
  git commit -m "feat(tx): activity-aware sheet logic"
  ```

---

### Task 6: Sheet UI: activity and item columns

**Files:**
- Modify: `cashflowkub/src/components/cfk/tx-sheet.tsx`
- Modify, wherever `Activity` or `amount > 0` is used to mean income: `cashflowkub/src/components/cfk/tx-summary.tsx`, `cashflowkub/src/components/cfk/tx-row.tsx`
- Modify: `cashflowkub/src/app/(app)/transactions/page.tsx`
- Modify: `cashflowkub/src/lib/i18n.ts` (`ui.sheet`)
- Test: `cashflowkub/tests/e2e/pages.test.ts`

**Interfaces:**
- Consumes: Task 5's `RowDraft`, `TxBody` and `validateRow`; `ACTIVITIES`, `itemListFor` and `ACTIVITY_TH` from `@/lib/activity`.
- Produces: `TxSheet` gains the props `incomeItems: { name: string }[]`, `channels: { name: string }[]` and `debts: { name: string; done: boolean }[]`. The page loads them with `listResource('income-categories')`, `listResource('channels')` and `prisma.debt.findMany({ select: { name: true, done: true } })` (via a small `listDebtNames()` in `src/server/debt/service.ts`).
- Produces (i18n, `en` and `th`): `ui.sheet.activities: Record<Activity, string>`, with the Thai values exactly as in `ACTIVITY_TH`. English values: Receive, Pay, Save, Pay debt, Withdraw, Transfer. Also `ui.sheet.item`, "Item" / "รายการ".

- [ ] **Step 1: Write the failing e2e check** in `tests/e2e/pages.test.ts`: `/transactions` renders a column header with `ui.sheet.item`'s English text, and an activity select whose options include "Transfer".

- [ ] **Step 2: Run the check to verify it fails**
  Run `pnpm test:e2e -- pages`. Expected: FAIL, because there is no Item header.

- [ ] **Step 3: Implement** the UI:
  - The activity select lists all six activities.
  - A new **Item** select, placed after the category column, takes its options from `itemListFor(activity)`:
    - `income`: income item names, plus a blank option;
    - `channel`: channel names;
    - `debt`: debts where `!done`;
    - `account`: account names except the row's `acct`.
  - The Item select is disabled for `pay`.
  - The category select is disabled unless the activity is `pay`.
  - The interest and fee inputs are disabled unless the activity is `pay_debt`; the goal input is disabled unless it is `save`.
  - Changing the activity clears `item` and any field that becomes disabled.
  - The new blank row defaults to `activity: 'pay'`.

- [ ] **Step 4: Verify**
  - Run `pnpm test && pnpm typecheck && pnpm lint && pnpm test:e2e`. Expected: all PASS.
  - Then run `pnpm dev`, open `/transactions`, and record one row of each activity:
    - each saves and shows no red "incomplete" cell;
    - a transfer to the same account cannot be picked;
    - the Thai UI shows the six Thai labels.

- [ ] **Step 5: Commit**
  ```bash
  git add cashflowkub/src cashflowkub/tests/e2e
  git commit -m "feat(tx): activity and item columns in the sheet"
  ```

---

### Task 7: Knowledge note

**Files:**
- Modify: `docs/knowledge/spreadsheet-planner.md` §14

- [ ] **Step 1: Update the note**
  - In the mapping table, change the "Daily transactions" row to name the `activity` and `item` columns.
  - Add a paragraph after the Bills paragraph that records:
    - the six activity keys and what `item` names for each;
    - that `cat` is fixed by the server except for `pay`;
    - that `acct` must be an existing account;
    - the new 400 and 409 codes;
    - the `?type=` and `?activity=` filter meanings;
    - that a transfer is one row, credited to `acct` and debited from `item`.
  - In "Behaviour to check", mark transfer, withdrawal and indirect withdrawal as covered, the last with a pointer to the roadmap's "Deliberately not planned".

- [ ] **Step 2: Verify**
  Read the section once against `src/lib/activity.ts` and the error codes in `i18n.ts`. Every key and code named in the note must exist in the code.

- [ ] **Step 3: Commit**
  ```bash
  git add docs/knowledge/spreadsheet-planner.md
  git commit -m "docs(knowledge): record transaction activities"
  ```

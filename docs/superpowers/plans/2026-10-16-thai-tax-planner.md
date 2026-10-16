# Thai Tax Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/tax` screen where the user enters income, tax already withheld and Thai PIT deductions for the selected year, and sees the full-year tax estimate, how much more they may owe (or get back), a summary of every deduction they claimed (with caps applied), and how much RMF / SSF / Thai ESG room is left.

**Architecture:** A pure calculator (`src/server/tax/logic.ts`) driven by a per-year rules table (`src/server/tax/rules.ts`). One saved plan per year is stored as JSON in the existing `settings` key/value table under key `tax:<year>` (no migration). `GET/PUT /api/v1/tax?year=` and a Server Component page call the service; a client form PUTs and calls `router.refresh()`, matching `debts/plan/income-dialog.tsx`.

**Tech Stack:** Next.js 16 App Router, Prisma 7 / PostgreSQL, zod 4, Vitest 5, shadcn/ui.

**Spec:** No separate spec. Source is row 1 of the feature table in the conversation: "วางแผนภาษีไทย: กรอกรายได้และค่าลดหย่อน → ประมาณการภาษีทั้งปี ภาษีที่จ่ายแล้ว และยอดที่อาจต้องจ่ายเพิ่ม/ได้เงินคืน พร้อมสรุปสิทธิที่กรอกแล้ว". The **Decisions** section below is the spec; every item marked *(my call)* is for the user to check.

All paths are relative to `cashflowkub/` (the Next.js app). Run every command from there.

## Decisions

- **Tax year = the app's year cookie** (`getPrefs().year`, 2024–2028). The API takes `?year=` (integer 2000–2100, default `CURRENT_YEAR`).
- **Rules are only pinned for tax year 2025 (พ.ศ. 2568).** Any other year uses the 2025 rules with `assumed: true`, `easyEReceiptMax: 0`, and the page shows a banner saying so. *(my call: 2026 rule changes, e.g. the social-security wage ceiling, are not verified, so the app says that instead of guessing)*
- **Income types in scope:** salary/bonus 40(1), freelance 40(2), and "other income after expenses" (entered net, no expense deduction applied). *(my call)*
- **Out of scope (YAGNI):** 40(3)–40(8) expense-rate tables, the 0.5% minimum tax on non-salary income, spouse joint filing, foreign income, ESGX / special stimulus programs other than Easy E-Receipt, and filing or export.
- **Default when nothing is saved:** `salary = monthlyIncome × 12` (from `getMonthlyIncome()`), everything else 0 / false. `saved: false`. *(my call)*
- **Room left** is shown only for RMF, SSF and Thai ESG (the items people buy before year end to cut tax). *(my call)*
- **Disclaimer is always shown** (copy below). This is an estimate, not tax advice.

### Rules for 2025 (`TAX_RULES_2025`)

| Item | Value |
|---|---|
| Brackets on net income | 0–150,000: 0% · –300,000: 5% · –500,000: 10% · –750,000: 15% · –1,000,000: 20% · –2,000,000: 25% · –5,000,000: 30% · above: 35% |
| Expense deduction | 50% of (salary + freelance), max 100,000 |
| Personal | 60,000 |
| Spouse with no income | 60,000 |
| Child | 30,000 each; +30,000 more for each 2nd-or-later child born 2018+ (`children2018Extra ≤ children − 1`) |
| Parents aged 60+ | 30,000 each, at most 4 |
| Disabled dependent | 60,000 each |
| Pregnancy & birth | max 60,000 |
| Social security | max 9,000 |
| Life insurance | max 100,000 |
| Health insurance | max 25,000; life + health together max 100,000 (the excess is cut from health) |
| Parents' health insurance | max 15,000 |
| Pension insurance | min(15% of income, 200,000) |
| PVD / GPF (กบข.) | each min(15% of salary, 500,000) |
| NSF (กอช.) | max 30,000 |
| RMF | min(30% of income, 500,000) |
| SSF | min(30% of income, 200,000) |
| Retirement group cap | pensionInsurance + pvd + gpf + nsf + rmf + ssf ≤ 500,000; trim the overflow from the end of the list `[pvd, gpf, nsf, pensionInsurance, rmf, ssf]` (SSF first) |
| Thai ESG | min(30% of income, 300,000), outside the group cap |
| Home loan interest | max 100,000 |
| Easy E-Receipt | max 50,000 (0 for assumed years) |
| Donations | `cap = 10% × (income − expense − all other deductions)`; double donations count ×2 and are applied first: `doubleAllowed = min(2 × donationDouble, cap)`, `donationAllowed = min(donation, cap − doubleAllowed)` *(my call: one shared cap)* |

"Income" means `salary + freelance + otherNet`. Band tax is `Math.round(taxable × rate)` per band; total tax is the sum of the bands. Net income is never negative.

## Global Constraints

- Money is integer baht everywhere (inputs, stored JSON, API). Rates are 0..1 floats.
- Every user-facing string goes into both `en` and `th` in `src/lib/i18n.ts` (`th: Dict` enforces parity at `pnpm typecheck`). Strings in Thai are exactly as written in Task 3.
- Server stays the authority: the client does no tax math; 400 messages are shown with `toast.error`.
- No new dependencies and no Prisma migration.
- Follow the existing layering: `logic.ts` is pure and has no imports from `@/lib/db`; `service.ts` does Prisma access; route handlers are wrapped in `route()`.

## Review Focus

1. **A stored `tax:<year>` value that is not valid JSON or no longer matches the schema** (e.g. an older shape): GET and the page must fall back to defaults with `saved: false`, not return a 500. Pinned in Task 2.
2. **Zero income with deductions filled in:** tax 0, `effectiveRate` 0 (not NaN), net 0, room 0, no negative values. Pinned in Task 1.
3. **Easy E-Receipt entered for an assumed year (2026):** allowed 0 and marked capped, so the summary shows why. Pinned in Task 1.
4. **A form field left empty or typed with commas** ("12,500"): sent as 0 / 12500, not `NaN` (which `JSON.stringify` turns into `null`, giving a confusing 400). Pinned in Task 3.
5. **`?year=abc` / `?year=1999.5`:** 400 with a readable message, not a 500 or a silent default. Pinned in Task 2.

---

### Task 1: Rules table and pure calculator

**Files:**
- Create: `src/server/tax/rules.ts`
- Create: `src/server/tax/logic.ts`
- Test: `tests/unit/tax-logic.test.ts`

**Interfaces:**
- Produces:

```ts
// rules.ts
export interface TaxBracket { upTo: number; rate: number } // last bracket upTo: Infinity
export interface TaxRules { brackets: TaxBracket[]; expenseRate: number; expenseMax: number; personal: number; spouse: number;
  child: number; child2018Extra: number; parent: number; parentsMax: number; disabled: number; maternityMax: number;
  socialSecurityMax: number; lifeMax: number; healthMax: number; lifeHealthMax: number; parentHealthMax: number;
  pensionRate: number; pensionMax: number; pvdRate: number; pvdMax: number; gpfRate: number; gpfMax: number; nsfMax: number;
  rmfRate: number; rmfMax: number; ssfRate: number; ssfMax: number; retirementGroupMax: number; thaiEsgRate: number;
  thaiEsgMax: number; homeLoanMax: number; easyEReceiptMax: number; donationCapRate: number }
export const TAX_RULES_2025: TaxRules;            // values from the Decisions table
export const RULES_YEAR = 2025;
export function rulesFor(year: number): { rules: TaxRules; rulesYear: number; assumed: boolean };

// logic.ts
export interface TaxInput { salary: number; freelance: number; otherNet: number; withheld: number; spouse: boolean;
  children: number; children2018Extra: number; parents: number; disabledDependents: number; maternity: number;
  socialSecurity: number; lifeInsurance: number; healthInsurance: number; parentHealthInsurance: number;
  pensionInsurance: number; pvd: number; gpf: number; nsf: number; rmf: number; ssf: number; thaiEsg: number;
  homeLoanInterest: number; easyEReceipt: number; donation: number; donationDouble: number }
export type DeductionKey = 'personal' | 'spouse' | 'children' | 'parents' | 'disabled' | 'maternity' | 'socialSecurity'
  | 'lifeInsurance' | 'healthInsurance' | 'parentHealthInsurance' | 'pensionInsurance' | 'pvd' | 'gpf' | 'nsf' | 'rmf'
  | 'ssf' | 'thaiEsg' | 'homeLoanInterest' | 'easyEReceipt' | 'donationDouble' | 'donation';
export interface DeductionLine { key: DeductionKey; claimed: number; allowed: number; capped: boolean }
export interface TaxBand { rate: number; taxable: number; tax: number }
export interface TaxResult { income: number; expense: number; deductions: DeductionLine[]; totalDeductions: number;
  netIncome: number; bands: TaxBand[]; tax: number; marginalRate: number; effectiveRate: number; withheld: number;
  balance: number; /* tax − withheld: > 0 owe, < 0 refund */ room: { rmf: number; ssf: number; thaiEsg: number } }
export const EMPTY_TAX_INPUT: TaxInput;           // every number 0, spouse false
export function taxOnNet(net: number, brackets: TaxBracket[]): { bands: TaxBand[]; tax: number; marginalRate: number };
export function computeTax(input: TaxInput, rules: TaxRules): TaxResult;
```

`deductions` holds lines in `DeductionKey` order, and only lines with `claimed > 0` or `allowed > 0` (so `personal` is always there). For count-based lines (`spouse`, `children`, `parents`, `disabled`), `claimed` is the full allowance for what was entered and `allowed` is what passes the cap. `capped` means `allowed < claimed`. `bands` lists only bands with `taxable > 0`. `marginalRate` is the rate of the highest band with `taxable > 0`, or 0. `room.rmf = max(0, min(rmfCapForIncome − rmfAllowed, retirementGroupMax − groupTotal))`, `room.ssf` works the same way with the SSF cap, and `room.thaiEsg = max(0, thaiEsgCapForIncome − thaiEsgAllowed)`.

- [ ] **Step 1: Write the failing tests** in `tests/unit/tax-logic.test.ts`

```ts
const base = (p: Partial<TaxInput>): TaxInput => ({ ...EMPTY_TAX_INPUT, ...p });
const R = TAX_RULES_2025;

it('taxOnNet walks the brackets', () => {
  expect(taxOnNet(150_000, R.brackets).tax).toBe(0);
  expect(taxOnNet(300_000, R.brackets).tax).toBe(7_500);
  expect(taxOnNet(1_000_000, R.brackets).tax).toBe(115_000);
  expect(taxOnNet(5_000_000, R.brackets)).toMatchObject({ tax: 1_265_000, marginalRate: 0.3 });
  expect(taxOnNet(0, R.brackets)).toEqual({ bands: [], tax: 0, marginalRate: 0 });
});
it('salaried with social security owes a little more than withheld', () => {
  const r = computeTax(base({ salary: 600_000, socialSecurity: 9_000, withheld: 20_000 }), R);
  expect(r).toMatchObject({ income: 600_000, expense: 100_000, totalDeductions: 69_000, netIncome: 431_000, tax: 20_600, balance: 600, marginalRate: 0.1 });
  expect(r.effectiveRate).toBeCloseTo(20_600 / 600_000, 6);
});
it('negative balance means a refund', () => {
  expect(computeTax(base({ salary: 600_000, withheld: 30_000 }), R)).toMatchObject({ tax: 21_500, balance: -8_500 });
});
it('applies life+health and retirement-group caps', () => {
  const r = computeTax(base({ salary: 1_200_000, lifeInsurance: 120_000, healthInsurance: 30_000, rmf: 400_000, ssf: 250_000 }), R);
  const line = (k: DeductionKey) => r.deductions.find((d) => d.key === k);
  expect(line('lifeInsurance')).toEqual({ key: 'lifeInsurance', claimed: 120_000, allowed: 100_000, capped: true });
  expect(line('healthInsurance')).toEqual({ key: 'healthInsurance', claimed: 30_000, allowed: 0, capped: true });
  expect(line('rmf')).toEqual({ key: 'rmf', claimed: 400_000, allowed: 360_000, capped: true });
  expect(line('ssf')).toEqual({ key: 'ssf', claimed: 250_000, allowed: 140_000, capped: true });
  expect(r).toMatchObject({ totalDeductions: 660_000, netIncome: 440_000, tax: 21_500, room: { rmf: 0, ssf: 0, thaiEsg: 300_000 } });
});
it('caps donations at 10% of income after deductions, double ones first', () => {
  expect(computeTax(base({ salary: 300_000, donation: 50_000 }), R)).toMatchObject({ netIncome: 126_000, tax: 0 });
  expect(computeTax(base({ salary: 500_000, donationDouble: 10_000 }), R)).toMatchObject({ netIncome: 320_000, tax: 9_500 });
});
it('counts children, the 2018+ extra, and at most 4 parents', () => {
  const r = computeTax(base({ salary: 1_000_000, children: 2, children2018Extra: 1, parents: 4, spouse: true }), R);
  expect(r.deductions.find((d) => d.key === 'children')?.allowed).toBe(90_000);
  expect(r.deductions.find((d) => d.key === 'parents')?.allowed).toBe(120_000);
  expect(r.deductions.find((d) => d.key === 'spouse')?.allowed).toBe(60_000);
});
it('zero income never goes negative or NaN', () => {
  const r = computeTax(base({ lifeInsurance: 50_000, rmf: 100_000 }), R);
  expect(r).toMatchObject({ income: 0, netIncome: 0, tax: 0, effectiveRate: 0, marginalRate: 0, room: { rmf: 0, ssf: 0, thaiEsg: 0 } });
});
it('assumed years use 2025 rules without Easy E-Receipt', () => {
  expect(rulesFor(2025)).toMatchObject({ rulesYear: 2025, assumed: false });
  const { rules, assumed } = rulesFor(2026);
  expect(assumed).toBe(true);
  const r = computeTax(base({ salary: 600_000, easyEReceipt: 50_000 }), rules);
  expect(r.deductions.find((d) => d.key === 'easyEReceipt')).toEqual({ key: 'easyEReceipt', claimed: 50_000, allowed: 0, capped: true });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run --project unit tests/unit/tax-logic.test.ts`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Implement `rules.ts`** with the values from the Decisions table. `rulesFor(year)` returns `TAX_RULES_2025` for 2025, and otherwise `{ ...TAX_RULES_2025, easyEReceiptMax: 0 }` with `assumed: true`.

- [ ] **Step 4: Implement `taxOnNet` and `computeTax` in `logic.ts`** using the order in the Decisions table: expense, fixed allowances, insurance, retirement group (cap each item, then trim the group), Thai ESG, home loan, Easy E-Receipt, and donations last.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm vitest run --project unit tests/unit/tax-logic.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/tax tests/unit/tax-logic.test.ts
git commit -m "feat(tax): Thai PIT rules and pure calculator"
```

### Task 2: Saved plan service and `/api/v1/tax`

**Files:**
- Create: `src/server/tax/service.ts`
- Create: `src/app/api/v1/tax/route.ts`
- Test: `tests/api/tax.test.ts`

**Interfaces:**
- Consumes: `TaxInput`, `EMPTY_TAX_INPUT`, `computeTax`, `rulesFor` (Task 1); `getMonthlyIncome()` (`src/server/settings/service.ts`); `parseBody` (`src/server/validate.ts`); `badRequest`; `CURRENT_YEAR` (`src/lib/prefs.ts`).
- Produces:

```ts
export interface TaxPlan { year: number; rulesYear: number; assumed: boolean; saved: boolean; input: TaxInput; result: TaxResult }
export const taxInputSchema: z.ZodType<TaxInput>;
export function parseTaxYear(raw: string | null): number;   // null/'' → CURRENT_YEAR; non-integer or outside 2000–2100 → badRequest(`invalid year: ${raw}`)
export async function getTaxPlan(year: number): Promise<TaxPlan>;
export async function saveTaxPlan(year: number, body: unknown): Promise<TaxPlan>;
```

`taxInputSchema`: every money field is `z.number().int().nonnegative().max(1_000_000_000)`. Count fields are ints: `children` 0–20, `parents` 0–4, `disabledDependents` 0–10, and `children2018Extra` ≥ 0 with a `.refine` that it is ≤ `max(0, children − 1)` (message `children2018Extra cannot exceed children - 1`). `spouse` is a boolean. The object is strict (`z.strictObject`), so unknown keys give a 400. Storage key is `` `tax:${year}` ``, and the value is `JSON.stringify(input)`. When the stored value fails `JSON.parse` or `taxInputSchema.safeParse`, `getTaxPlan` treats it as not saved.

Route: `GET` returns `ok(await getTaxPlan(parseTaxYear(url.searchParams.get('year'))))`; `PUT` reads `readJson(req)` and returns `ok(await saveTaxPlan(...))`.

- [ ] **Step 1: Write the failing API tests** in `tests/api/tax.test.ts` (`beforeEach(resetDb)`; the demo `monthlyIncome` is 62,000)

```ts
it('defaults to monthly income × 12 when nothing is saved', async () => {
  const { status, json } = await call(tax.GET, { url: '/api/v1/tax?year=2025' });
  expect(status).toBe(200);
  expect(json).toMatchObject({ year: 2025, rulesYear: 2025, assumed: false, saved: false, input: { salary: 744_000 } });
});
it('saves per year and recomputes', async () => {
  const body = { ...EMPTY_TAX_INPUT, salary: 600_000, socialSecurity: 9_000, withheld: 20_000 };
  const put = await call(tax.PUT, { method: 'PUT', url: '/api/v1/tax?year=2025', body });
  expect(put.json).toMatchObject({ saved: true, result: { tax: 20_600, balance: 600 } });
  expect((await call(tax.GET, { url: '/api/v1/tax?year=2025' })).json.saved).toBe(true);
  expect((await call(tax.GET, { url: '/api/v1/tax?year=2026' })).json).toMatchObject({ saved: false, assumed: true });
});
it('400s bad input', async () => {
  const put = (body: unknown) => call(tax.PUT, { method: 'PUT', url: '/api/v1/tax?year=2025', body });
  expect((await put({ ...EMPTY_TAX_INPUT, salary: -1 })).status).toBe(400);
  expect((await put({ ...EMPTY_TAX_INPUT, salary: 1.5 })).status).toBe(400);
  expect((await put({ ...EMPTY_TAX_INPUT, parents: 5 })).status).toBe(400);
  expect((await put({ ...EMPTY_TAX_INPUT, children: 2, children2018Extra: 2 })).status).toBe(400);
  expect((await put({ ...EMPTY_TAX_INPUT, salary: null })).status).toBe(400);
  expect((await put({ ...EMPTY_TAX_INPUT, bogus: 1 })).status).toBe(400);
});
it('400s a bad year', async () => {
  for (const y of ['abc', '1999.5', '1999', '2101']) expect((await call(tax.GET, { url: `/api/v1/tax?year=${y}` })).status).toBe(400);
});
it('treats a corrupt stored plan as unsaved', async () => {
  await prisma.setting.create({ data: { key: 'tax:2025', value: '{not json' } });
  expect((await call(tax.GET, { url: '/api/v1/tax?year=2025' })).json).toMatchObject({ saved: false });
  await prisma.setting.update({ where: { key: 'tax:2025' }, data: { value: '{"salary":"old"}' } });
  expect((await call(tax.GET, { url: '/api/v1/tax?year=2025' })).json).toMatchObject({ saved: false });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run --project api tests/api/tax.test.ts`
Expected: FAIL, because the route module is missing.

- [ ] **Step 3: Implement `service.ts` and `route.ts`** to the interfaces above. Use `prisma.setting.upsert`, as `updateSettings` does.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm vitest run --project api tests/api/tax.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add the endpoint to `README.md` under API**: `` `GET/PUT /tax?year=YYYY` ``: one saved Thai tax plan per year (`TaxInput` body); responds `{ year, rulesYear, assumed, saved, input, result }`. `result.balance > 0` means owe, `< 0` means refund.

- [ ] **Step 6: Commit**

```bash
git add src/server/tax/service.ts src/app/api/v1/tax tests/api/tax.test.ts README.md
git commit -m "feat(tax): saved plan per year and /api/v1/tax"
```

### Task 3: Copy, nav entry and form model

**Files:**
- Modify: `src/lib/i18n.ts` (add `nav.tax` and a nested `tax` object to both `en` and `th`)
- Modify: `src/components/app-shell/nav.ts` (insert `{ key: 'tax', href: '/tax', icon: 'receipt' }` after `plan`)
- Create: `src/app/(app)/tax/form-model.ts`
- Test: `tests/unit/tax-form-model.test.ts`, `tests/unit/i18n.test.ts`

**Interfaces:**
- Consumes: `TaxInput`, `EMPTY_TAX_INPUT` (Task 1).
- Produces: `ui.nav.tax`, `ui.tax.*` (the keys below), `ui.tax.field: Record<keyof TaxInput | DeductionKey, string>`, plus

```ts
export type TaxFormValues = { [K in keyof TaxInput]: TaxInput[K] extends boolean ? boolean : string };
export function toFormValues(input: TaxInput): TaxFormValues;   // numbers → String(n)
export function toTaxInput(values: TaxFormValues): TaxInput;    // strip ',' and spaces; '' or NaN → 0; no rounding (server rejects fractions)
export const TAX_SECTIONS: { key: 'income' | 'family' | 'insurance' | 'other'; fields: (keyof TaxInput)[] }[];
```

`TAX_SECTIONS`: income = salary, freelance, otherNet, withheld · family = spouse, children, children2018Extra, parents, disabledDependents, maternity · insurance = socialSecurity, lifeInsurance, healthInsurance, parentHealthInsurance, pensionInsurance, pvd, gpf, nsf, rmf, ssf, thaiEsg · other = homeLoanInterest, easyEReceipt, donation, donationDouble.

Copy (EN / TH, exact):

| key | en | th |
|---|---|---|
| nav.tax | Tax | ภาษี |
| title | Tax planner | วางแผนภาษี |
| sub | Thai personal income tax estimate for {year} | ประมาณการภาษีเงินได้บุคคลธรรมดา ปี {year} |
| estimated | Estimated tax | ภาษีที่ต้องจ่ายทั้งปี |
| withheldLbl | Tax already withheld | ภาษีที่ถูกหัก ณ ที่จ่ายแล้ว |
| owe | You may owe | อาจต้องจ่ายเพิ่ม |
| refund | Possible refund | อาจได้เงินคืน |
| even | Nothing more to pay | ไม่ต้องจ่ายเพิ่ม |
| effectiveRate | Effective rate | อัตราภาษีเฉลี่ย |
| marginalRate | Top bracket | ฐานภาษีสูงสุด |
| incomeLbl | Total income | เงินได้ทั้งหมด |
| expenseLbl | Expense deduction | หักค่าใช้จ่าย |
| deductionsLbl | Total deductions | ลดหย่อนรวม |
| netIncome | Net taxable income | เงินได้สุทธิ |
| bands | Tax by bracket | ภาษีแต่ละขั้น |
| claims | Your deductions | สิทธิลดหย่อนที่กรอกแล้ว |
| capped | Capped | เกินสิทธิ |
| claimedOf | {claimed} claimed | กรอก {claimed} |
| room | Room left to cut tax | ลดหย่อนเพิ่มได้อีก |
| assumed | Official {year} rules are not in the app yet; using {rulesYear} rules. Check before you file. | ยังไม่มีเกณฑ์ภาษีปี {year} ในแอป ใช้เกณฑ์ปี {rulesYear} แทน โปรดตรวจสอบก่อนยื่นภาษี |
| disclaimer | Estimate only, not tax advice. Check with the Revenue Department before filing. | เป็นการประมาณการเท่านั้น ไม่ใช่คำแนะนำทางภาษี โปรดตรวจสอบกับกรมสรรพากรก่อนยื่นแบบ |
| section.income / family / insurance / other | Income / Family / Insurance & savings / Other | รายได้ / ครอบครัว / ประกันและการออม / อื่น ๆ |
| save | Save & recalculate | บันทึกและคำนวณ |
| field.personal | Personal allowance | ลดหย่อนส่วนตัว |
| field.salary | Salary & bonus (40(1)) | เงินเดือนและโบนัส (40(1)) |
| field.freelance | Freelance fees (40(2)) | ค่าจ้างฟรีแลนซ์ (40(2)) |
| field.otherNet | Other income after expenses | เงินได้อื่นหลังหักค่าใช้จ่าย |
| field.withheld | Tax already withheld | ภาษีที่ถูกหัก ณ ที่จ่ายแล้ว |
| field.spouse | Spouse with no income | คู่สมรสไม่มีเงินได้ |
| field.children | Children | จำนวนบุตร |
| field.children2018Extra | Of those, 2nd+ born 2018 or later | บุตรคนที่ 2 ขึ้นไปที่เกิดตั้งแต่ปี 2561 |
| field.parents | Parents aged 60+ (max 4) | บิดามารดาอายุ 60 ปีขึ้นไป (สูงสุด 4) |
| field.disabledDependents | Disabled dependents | ผู้พิการในอุปการะ |
| field.maternity | Pregnancy & birth costs | ค่าฝากครรภ์และคลอดบุตร |
| field.socialSecurity | Social security | ประกันสังคม |
| field.lifeInsurance | Life insurance | เบี้ยประกันชีวิต |
| field.healthInsurance | Health insurance | เบี้ยประกันสุขภาพ |
| field.parentHealthInsurance | Parents' health insurance | ประกันสุขภาพบิดามารดา |
| field.pensionInsurance | Pension insurance | ประกันชีวิตแบบบำนาญ |
| field.pvd | Provident fund | กองทุนสำรองเลี้ยงชีพ |
| field.gpf | Government Pension Fund | กบข. |
| field.nsf | National Savings Fund | กอช. |
| field.rmf / ssf / thaiEsg / easyEReceipt | RMF / SSF / Thai ESG / Easy E-Receipt | (same as en) |
| field.homeLoanInterest | Home loan interest | ดอกเบี้ยเงินกู้ซื้อบ้าน |
| field.donation | Donations | เงินบริจาคทั่วไป |
| field.donationDouble | Education/hospital donations (2×) | เงินบริจาคเพื่อการศึกษา/โรงพยาบาล (2 เท่า) |

Deduction lines are labelled with `ui.tax.field[line.key]`. The only `DeductionKey`s that are not `TaxInput` keys are `personal` (in the table) and `disabled`, which uses the same text as `disabledDependents`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/tax-form-model.test.ts`:
```ts
it('parses blanks and commas', () => {
  const v = { ...toFormValues(EMPTY_TAX_INPUT), salary: '12,500', freelance: '', rmf: 'abc', spouse: true };
  expect(toTaxInput(v)).toMatchObject({ salary: 12_500, freelance: 0, rmf: 0, spouse: true });
});
it('round-trips', () => {
  const input = { ...EMPTY_TAX_INPUT, salary: 600_000, children: 2 };
  expect(toTaxInput(toFormValues(input))).toEqual(input);
});
it('every TaxInput field is in exactly one section', () => {
  expect(TAX_SECTIONS.flatMap((s) => s.fields).sort()).toEqual(Object.keys(EMPTY_TAX_INPUT).sort());
});
```
Add to `tests/unit/i18n.test.ts`: `expect(DICT.th.nav.tax).toBe('ภาษี')` and, for each key of `EMPTY_TAX_INPUT`, `expect(DICT.th.tax.field[key]).toBeTruthy()`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run --project unit tests/unit/tax-form-model.test.ts tests/unit/i18n.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the copy, the nav item and `form-model.ts`.**

- [ ] **Step 4: Run the tests and the typecheck**

Run: `pnpm vitest run --project unit && pnpm typecheck`
Expected: all unit tests PASS, and tsc exits 0 (which proves `th` matches `en`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts src/components/app-shell/nav.ts "src/app/(app)/tax/form-model.ts" tests/unit
git commit -m "feat(tax): copy, nav entry and form model"
```

### Task 4: `/tax` page and form

**Files:**
- Create: `src/app/(app)/tax/page.tsx` (Server Component)
- Create: `src/app/(app)/tax/tax-form.tsx` (`'use client'`)
- Modify: `tests/e2e/pages.test.ts`

**Interfaces:**
- Consumes: `getTaxPlan` (Task 2); `ui.tax.*`, `TAX_SECTIONS`, `toFormValues`, `toTaxInput` (Task 3); `getPrefs`/`getI18n`; `fmt`, `pct`, `fill`; `PageTitle`, `Card`, `ToneBadge`, `Icon`, `apiFetch`.
- Produces: the `/tax` route.

Page layout, top to bottom:
1. `PageTitle` with `ui.tax.title`, then `ui.tax.sub` filled with the year (`year` in EN, `year + 543` in TH).
2. If `assumed`, a warning banner (`bg-type-folder-bg text-type-folder-fg`, `triangle-alert` icon) with `ui.tax.assumed`.
3. Result card: `estimated` = `fmt(tax)` (large), `withheldLbl` = `fmt(withheld)`. The balance row shows `owe` with a `danger` badge when `balance > 0`, `refund` with a `success` badge when `balance < 0`, and `even` otherwise, plus `fmt(|balance|)`. It also has `effectiveRate` and `marginalRate` via `pct`, and income / expense / deductions / net rows.
4. `bands` list: rate % → taxable → tax.
5. `claims` list: one row per `result.deductions` line, showing `field[key]` and `fmt(allowed)`. When `capped`, it also shows a `warning` `ToneBadge` with `ui.tax.capped` and `fill(claimedOf, { claimed: fmt(claimed) })`.
6. `room` card: RMF / SSF / Thai ESG with `fmt(room.x)`. Hide the card when all three are 0.
7. `<TaxForm year={year} input={plan.input} />`: one `Card` per section, money and count fields as `Input type="text" inputMode="numeric"`, `spouse` as a checkbox. `Save` sends `apiFetch('/tax?year=' + year, { method: 'PUT', body: toTaxInput(values) })`, then `router.refresh()`, or `toast.error(message)` on failure. Inputs are kept on failure.
8. `ui.tax.disclaimer` in `text-xs text-muted-foreground`.

- [ ] **Step 1: Add the e2e rows** to `PAGES`: `['/tax', 'Estimated tax', 'ภาษีที่ต้องจ่ายทั้งปี']` and `['/tax', 'Estimate only, not tax advice', 'ไม่ใช่คำแนะนำทางภาษี']`.

- [ ] **Step 2: Build the page and form** following the layout above.

- [ ] **Step 3: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, then start `PORT=3111 pnpm start` in the background and run `E2E_BASE_URL=http://localhost:3111 pnpm test:e2e`.
Expected: everything passes, including both `/tax` rows. Then stop the server.

- [ ] **Step 4: Manual browser pass** at `/tax` in EN and TH, for years 2025 and 2026 (2026 shows the banner):
  - Enter salary 600,000, social security 9,000 and withheld 20,000, then save. The page shows estimated ฿20,600 and "You may owe ฿600".
  - Enter RMF 400,000 with salary 1,200,000. RMF shows Capped with "฿400,000 claimed".
  - Enter `-5` in a field and save. A toast appears and the inputs stay.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/tax" tests/e2e/pages.test.ts
git commit -m "feat(tax): tax planner screen"
```

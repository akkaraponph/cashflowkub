# CashflowKub Debt Management System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the ported Debts module into a personal debt management system (ระบบบริหารจัดการหนี้สินส่วนตัว). It handles Shopee SPayLater-style fixed instalments, Shopee EasyCash-style flat-rate cash loans and bank loans (สินเชื่อ) on a reducing balance, with:
- a payment history;
- due dates and late fees;
- an avalanche/snowball payoff simulator;
- a DSR-based smart plan.

**Architecture:** This builds on the Next.js app from `2026-10-13-nextjs-port.md` (which must be complete). Each debt gains terms (rate method, term, fixed instalment, due day, late-fee rules) and a `DebtPayment` ledger; `paid` becomes `openingPaid + Σ payment.principal`. All money math is pure and lives in `src/server/debt/{terms,schedule,cycle,payment,strategy,dsr}.ts`. `DebtView` is rebuilt on top of it, so every existing screen gets computed instalment, payoff date and due status for free. New REST endpoints cover payments, strategy, DSR and settings, plus a new `/debts/plan` screen.

**Tech Stack:** Same as the port: Next.js 16, Prisma 7 + PostgreSQL, zod 4, shadcn/ui, Vitest.

**Spec:** The user's request (this conversation): *"debt management system: Shopee pay later + Shopee easy cash + debt bank สินเชื่อ — อยากทำระบบบริหารจัดการหนี้สินส่วนตัว"*, with chosen features: payment history; due dates & late fees; payoff strategy planner; a fixed paid-per-month instalment (e.g. Shopee PayLater); a smart plan based on DSR (Debt Service Ratio); and per-debt interest method (flat or reducing). Read it together with `docs/superpowers/plans/2026-10-13-nextjs-port.md`, whose file layout and helpers this plan uses.

## Global Constraints

- Prerequisite: every task of `2026-10-13-nextjs-port.md` is done (app in `cashflowkub/`, `api/` and `mobile/` removed). Commands run from `cashflowkub/`.
- "Today" is still `today()` = **2026-06-18** from `@/lib/clock`. Never read the wall clock in logic.
- Money is whole baht (`Int`). Rates are stored as a **nominal annual percent** in `Debt.apr`. The UI accepts "% per month" (×12) or "% per year".
- Interest methods:
  - `flat`: monthly interest = `round(original × apr/1200)`, fixed for the life of the loan (SPayLater / EasyCash style).
  - `reducing`: monthly interest = `round(remaining × apr/1200)` (bank loans).
- Instalment precedence: `fixedPayment > 0` (the amount printed on the statement) → computed from `termMonths` → `monthly` (minimum payment).
- A payment is applied **late fee first, then this cycle's interest, then principal**. Anything beyond the remaining balance is not stored and is reported back as `excess`.
- DSR = Σ instalments of active debts ÷ monthly income. Bands: ≤ 30% healthy, ≤ 40% manageable, ≤ 60% high, > 60% critical. The default target is 40%.
- Shopee figures in the seed are **illustrative demo values**, not Shopee's published rates or fees. The user enters real numbers from their statement. Do not fetch or scrape lender data.
- Migrations are hand-written SQL plus `prisma migrate deploy` (as in the port; `migrate dev` needs an interactive terminal). Never run `prisma migrate reset`.
- All new UI copy goes into `src/lib/i18n.ts` in both `en` and `th`.

## Review Focus

1. **Overpayment.** Paying more than is owed closes the debt at exactly `original`, stores only the applied amount, and returns `excess`. The UI tells the user. Unit test in Task 2; API test in Task 5.
2. **Due day missing from a month.** Due day 31 in a 30-day month, or 29–31 in February, clamps to the month's last day; a December/January rollover lands in the right year. Unit test in Task 2.
3. **No income set.** With monthly income 0 or unset, DSR is `null` (not `Infinity`/`NaN`), the smart plan asks the user to set income, and the page renders. Unit test in Task 4; API test in Task 6.
4. **Deleting a mistaken payment.** Deleting a payment recomputes `paid`/`done` from the ledger and reopens a debt that the payment had closed. API test in Task 5.
5. **Payment too small for the interest.** When the instalment doesn't cover monthly interest, the schedule and the simulator report `neverPaysOff` instead of looping or showing a fake payoff date. Unit tests in Task 1 and Task 3.

---

## File Structure

```
cashflowkub/
├── prisma/
│   ├── schema.prisma                         # Debt: +kind,lender,openingPaid,fixedPayment,termMonths,dueDay,graceDays,lateFee,penaltyApr
│   │                                         #       -payoff,payoffTh,monthsLeft (now derived); +DebtPayment, +Setting
│   ├── migrations/20261013010000_debt_management/migration.sql   # hand-written
│   ├── seed-data.ts                          # debts updated, +Shopee demo debts, +debtPayments, +settings
│   └── seed-lib.ts                           # truncates/creates the two new tables
├── src/server/
│   ├── debt/
│   │   ├── terms.ts        # monthlyRate, remainingPrincipal, interestForMonth, scheduledInstallment, amountDueThisMonth, toApr
│   │   ├── schedule.ts     # projectSchedule, payoffLabel
│   │   ├── cycle.ts        # dueDateIn, dueStatus
│   │   ├── payment.ts      # splitPayment
│   │   ├── strategy.ts     # payoffOrder, simulatePayoff, comparePayoff
│   │   ├── dsr.ts          # computeDsr, dsrBand, buildSmartPlan
│   │   ├── logic.ts        # buildSchedule (v2), parseStrategy, sortByStrategy (applyPayment removed)
│   │   ├── service.ts      # debts CRUD v2 + payments ledger
│   │   └── planning.ts     # payoff comparison, DSR, smart plan (DB-backed)
│   ├── settings/service.ts # monthly income
│   └── views.ts            # DebtView v2 (installment, monthsLeft, payoff, due, ...)
├── src/app/api/v1/
│   ├── debts/[id]/payments/route.ts                  # GET, POST
│   ├── debts/[id]/payments/[paymentId]/route.ts      # DELETE
│   ├── debts/strategy/route.ts                       # GET
│   ├── debts/dsr/route.ts                            # GET
│   └── settings/route.ts                             # GET, PUT
│   (debts/[id]/pay/route.ts is deleted)
└── src/app/(app)/debts/
    ├── page.tsx, add-debt-dialog.tsx, due-badge.tsx
    ├── [id]/page.tsx, [id]/record-payment-dialog.tsx, [id]/delete-payment-button.tsx
    └── plan/page.tsx, plan/income-dialog.tsx
```

---

### Task 1: Debt terms and payoff projection (pure)

**Files:**
- Create: `src/server/debt/terms.ts`, `src/server/debt/schedule.ts`
- Test: `tests/unit/debt-terms.test.ts`, `tests/unit/debt-schedule.test.ts`

**Interfaces:**
- Produces:
  - `interface DebtTerms { original: number; paid: number; apr: number; calc: string; monthly: number; fixedPayment: number; termMonths: number }`
  - `monthlyRate(d): number`, `remainingPrincipal(d): number`, `interestForMonth(d, balance?): number`, `scheduledInstallment(d): number`, `amountDueThisMonth(d): number`, `toApr(rate: number, unit: 'month' | 'year'): number` from `@/server/debt/terms`.
  - `const MAX_MONTHS = 600`, `interface ScheduleRow { month; payment; principal; interest; balance }`, `projectSchedule(d: DebtTerms): { rows: ScheduleRow[]; totalInterest: number; neverPaysOff: boolean }`, `payoffLabel(today: Date, months: number): { en: string; th: string }` from `@/server/debt/schedule`.
  - These modules import nothing at runtime, so Client Components (the add-debt preview) can use them.

- [ ] **Step 1: Write the failing tests**

`tests/unit/debt-terms.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { amountDueThisMonth, interestForMonth, remainingPrincipal, scheduledInstallment, toApr, type DebtTerms } from '@/server/debt/terms';

const terms = (o: Partial<DebtTerms> = {}): DebtTerms => ({ original: 10000, paid: 0, apr: 0, calc: 'reducing', monthly: 0, fixedPayment: 0, termMonths: 0, ...o });

describe('scheduledInstallment', () => {
  it('uses the statement instalment when given (SPayLater)', () => {
    expect(scheduledInstallment(terms({ fixedPayment: 1250, termMonths: 6, monthly: 999 }))).toBe(1250);
  });
  it('computes a flat-rate instalment from term (EasyCash)', () => {
    // 20000/12 + 20000 × 1.5% = 1666.67 + 300
    expect(scheduledInstallment(terms({ original: 20000, apr: 18, calc: 'flat', termMonths: 12 }))).toBe(1967);
  });
  it('computes an amortized instalment for a reducing-balance bank loan', () => {
    expect(scheduledInstallment(terms({ original: 100000, apr: 12, calc: 'reducing', termMonths: 12 }))).toBe(8885);
  });
  it('rounds a 0% term loan up so it still closes on time', () => {
    expect(scheduledInstallment(terms({ original: 1001, termMonths: 10 }))).toBe(101);
  });
  it('falls back to the minimum payment for open-ended debt', () => {
    expect(scheduledInstallment(terms({ monthly: 1523 }))).toBe(1523);
  });
});

describe('interestForMonth', () => {
  it('flat: charges on the original amount regardless of repayments', () => {
    expect(interestForMonth(terms({ original: 20000, paid: 5000, apr: 18, calc: 'flat' }))).toBe(300);
  });
  it('reducing: charges on the outstanding balance', () => {
    expect(interestForMonth(terms({ original: 70000, paid: 24300, apr: 25 }))).toBe(952);
  });
  it('charges nothing once the balance is zero', () => {
    expect(interestForMonth(terms({ original: 100, paid: 100, apr: 30, calc: 'flat' }))).toBe(0);
  });
});

describe('amountDueThisMonth / remainingPrincipal / toApr', () => {
  it('never asks for more than what is left plus interest', () => {
    expect(amountDueThisMonth(terms({ original: 1000, paid: 900, fixedPayment: 1250 }))).toBe(100);
  });
  it('clamps remaining at zero', () => {
    expect(remainingPrincipal(terms({ original: 100, paid: 150 }))).toBe(0);
  });
  it('converts a monthly rate to nominal annual', () => {
    expect(toApr(1.5, 'month')).toBe(18);
    expect(toApr(25, 'year')).toBe(25);
  });
});
```

`tests/unit/debt-schedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { payoffLabel, projectSchedule } from '@/server/debt/schedule';
import type { DebtTerms } from '@/server/debt/terms';

const terms = (o: Partial<DebtTerms> = {}): DebtTerms => ({ original: 10000, paid: 0, apr: 0, calc: 'reducing', monthly: 0, fixedPayment: 0, termMonths: 0, ...o });

describe('projectSchedule', () => {
  it('reducing balance: first row matches the bank-loan math', () => {
    const s = projectSchedule(terms({ original: 70000, paid: 24300, apr: 25, monthly: 2783 }));
    expect(s.rows[0]).toEqual({ month: 1, payment: 2783, principal: 1831, interest: 952, balance: 43869 });
    expect(s.rows.at(-1)?.balance).toBe(0);
    expect(s.neverPaysOff).toBe(false);
  });
  it('flat rate with term: constant interest, closes exactly on term', () => {
    const s = projectSchedule(terms({ original: 12000, apr: 12, calc: 'flat', termMonths: 12 }));
    expect(s.rows).toHaveLength(12);
    expect(s.rows.every((r) => r.interest === 120 && r.payment === 1120)).toBe(true);
    expect(s.totalInterest).toBe(1440);
  });
  it('partially repaid flat loan finishes with a short last payment', () => {
    const s = projectSchedule(terms({ original: 20000, paid: 5001, apr: 18, calc: 'flat', termMonths: 12 }));
    expect(s.rows).toHaveLength(9);
    expect(s.rows.at(-1)).toEqual({ month: 9, payment: 1963, principal: 1663, interest: 300, balance: 0 });
    expect(s.totalInterest).toBe(2700);
  });
  it('flags a payment that cannot cover the interest instead of looping', () => {
    const s = projectSchedule(terms({ original: 10000, apr: 60, monthly: 400 }));
    expect(s).toEqual({ rows: [], totalInterest: 0, neverPaysOff: true });
  });
  it('flags an open balance with no payment at all', () => {
    expect(projectSchedule(terms({ monthly: 0 })).neverPaysOff).toBe(true);
  });
  it('returns nothing for a closed debt', () => {
    expect(projectSchedule(terms({ original: 100, paid: 100, monthly: 10 }))).toEqual({ rows: [], totalInterest: 0, neverPaysOff: false });
  });
});

describe('payoffLabel', () => {
  const today = new Date('2026-06-18T00:00:00Z');
  it('adds months across year boundaries in both languages', () => {
    expect(payoffLabel(today, 46)).toEqual({ en: 'Apr 2030', th: 'เม.ย. 2030' });
    expect(payoffLabel(today, 9)).toEqual({ en: 'Mar 2027', th: 'มี.ค. 2027' });
    expect(payoffLabel(today, 0)).toEqual({ en: 'Jun 2026', th: 'มิ.ย. 2026' });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test:unit tests/unit/debt-terms.test.ts tests/unit/debt-schedule.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/server/debt/terms.ts`:

```ts
// Loan terms math. Rates are nominal annual percent (apr); interest is charged monthly.
// flat     = interest on the ORIGINAL amount every month (SPayLater / EasyCash style)
// reducing = interest on the REMAINING balance (bank loans)

export interface DebtTerms {
  original: number;
  paid: number;
  apr: number;
  calc: string;
  monthly: number;
  fixedPayment: number;
  termMonths: number;
}

export const monthlyRate = (d: Pick<DebtTerms, 'apr'>): number => d.apr / 100 / 12;

export const remainingPrincipal = (d: Pick<DebtTerms, 'original' | 'paid'>): number => Math.max(0, d.original - d.paid);

/** Interest charged for one month at the given outstanding balance. */
export function interestForMonth(d: DebtTerms, balance: number = remainingPrincipal(d)): number {
  if (balance <= 0) return 0;
  return Math.round((d.calc === 'flat' ? d.original : balance) * monthlyRate(d));
}

/** The regular monthly instalment: statement amount > computed from term > minimum payment. */
export function scheduledInstallment(d: DebtTerms): number {
  if (d.fixedPayment > 0) return d.fixedPayment;
  if (d.termMonths > 0) {
    const r = monthlyRate(d);
    const n = d.termMonths;
    if (d.calc === 'flat') return Math.round(d.original / n + d.original * r);
    if (r === 0) return Math.ceil(d.original / n);
    return Math.round((d.original * r) / (1 - (1 + r) ** -n));
  }
  return d.monthly;
}

/** What is due this month: the instalment, but never more than what's left plus this month's interest. */
export function amountDueThisMonth(d: DebtTerms): number {
  return Math.min(scheduledInstallment(d), remainingPrincipal(d) + interestForMonth(d));
}

export function toApr(rate: number, unit: 'month' | 'year'): number {
  return unit === 'month' ? rate * 12 : rate;
}
```

`src/server/debt/schedule.ts`:

```ts
// Forward projection of a debt from today's balance, and bilingual month labels.
import { interestForMonth, remainingPrincipal, scheduledInstallment, type DebtTerms } from './terms';

export const MAX_MONTHS = 600;

export interface ScheduleRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export function projectSchedule(d: DebtTerms): { rows: ScheduleRow[]; totalInterest: number; neverPaysOff: boolean } {
  let balance = remainingPrincipal(d);
  const installment = scheduledInstallment(d);
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;
  if (balance > 0 && installment <= 0) return { rows, totalInterest, neverPaysOff: true };
  for (let month = 1; balance > 0; month++) {
    const interest = interestForMonth(d, balance);
    const principal = Math.min(installment - interest, balance);
    if (principal <= 0 || month > MAX_MONTHS) return { rows: [], totalInterest: 0, neverPaysOff: true };
    balance -= principal;
    totalInterest += interest;
    rows.push({ month, payment: principal + interest, principal, interest, balance });
  }
  return { rows, totalInterest, neverPaysOff: false };
}

const EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "Apr 2030" / "เม.ย. 2030": the month `months` after today's month. */
export function payoffLabel(today: Date, months: number): { en: string; th: string } {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months, 1));
  const m = d.getUTCMonth();
  const y = d.getUTCFullYear();
  return { en: `${EN[m]} ${y}`, th: `${TH[m]} ${y}` };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add cashflowkub
git commit -m "feat(debt): loan terms math and payoff projection"
```

---

### Task 2: Due cycle, late fees and payment allocation (pure)

**Files:**
- Create: `src/server/debt/cycle.ts`, `src/server/debt/payment.ts`
- Test: `tests/unit/debt-cycle.test.ts`, `tests/unit/debt-payment.test.ts`

**Interfaces:**
- Consumes: `DebtTerms`, `amountDueThisMonth`, `interestForMonth`, `remainingPrincipal` (Task 1).
- Produces:
  - `interface CycleTerms extends DebtTerms { done: boolean; dueDay: number; graceDays: number; lateFee: number; penaltyApr: number }`
  - `interface PaymentLite { date: Date; amount: number; principal: number; interest: number; fee: number }`
  - `type DueState = 'closed' | 'paid' | 'upcoming' | 'dueSoon' | 'dueToday' | 'overdue'`
  - `interface DueStatus { state: DueState; dueDate: string /* YYYY-MM-DD */; daysUntil: number; daysLate: number; cycleStart: string; amountDue: number; paidThisCycle: number; lateFee: number }`
  - `dueDateIn(year, monthIndex, dueDay): Date`, `isoDate(d: Date): string`, `dueStatus(d: CycleTerms, payments: PaymentLite[], today: Date): DueStatus` from `@/server/debt/cycle`.
  - `interface PaymentSplit { principal; interest; fee; excess }`, `splitPayment(d: CycleTerms, payments: PaymentLite[], amount: number, date: Date): PaymentSplit` from `@/server/debt/payment`.

A **cycle** runs from the day after last month's due date through this month's due date. A payment made after the due date still counts toward the cycle it was late for.

- [ ] **Step 1: Write the failing tests**

`tests/unit/debt-cycle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dueDateIn, dueStatus, isoDate, type CycleTerms, type PaymentLite } from '@/server/debt/cycle';

const TODAY = new Date('2026-06-18T00:00:00Z');
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const terms = (o: Partial<CycleTerms> = {}): CycleTerms => ({
  original: 9593, paid: 5300, apr: 0, calc: 'reducing', monthly: 1607, fixedPayment: 0, termMonths: 0,
  done: false, dueDay: 25, graceDays: 0, lateFee: 0, penaltyApr: 0, ...o,
});
const pay = (iso: string, amount: number, o: Partial<PaymentLite> = {}): PaymentLite => ({ date: day(iso), amount, principal: amount, interest: 0, fee: 0, ...o });

describe('dueDateIn', () => {
  it('clamps to the last day of short months', () => {
    expect(isoDate(dueDateIn(2026, 5, 31))).toBe('2026-06-30');
    expect(isoDate(dueDateIn(2026, 1, 31))).toBe('2026-02-28');
    expect(isoDate(dueDateIn(2028, 1, 30))).toBe('2028-02-29');
  });
  it('rolls month indexes across years', () => {
    expect(isoDate(dueDateIn(2026, -1, 15))).toBe('2025-12-15');
    expect(isoDate(dueDateIn(2026, 12, 15))).toBe('2027-01-15');
  });
});

describe('dueStatus', () => {
  it('upcoming / dueSoon / dueToday before the due date', () => {
    expect(dueStatus(terms({ dueDay: 25 }), [], TODAY)).toMatchObject({ state: 'upcoming', dueDate: '2026-06-25', daysUntil: 7, amountDue: 1607 });
    expect(dueStatus(terms({ dueDay: 20 }), [], TODAY)).toMatchObject({ state: 'dueSoon', daysUntil: 2 });
    expect(dueStatus(terms({ dueDay: 18 }), [], TODAY)).toMatchObject({ state: 'dueToday', daysUntil: 0 });
  });
  it('a due day of 31 in June means June 30', () => {
    expect(dueStatus(terms({ dueDay: 31 }), [], TODAY)).toMatchObject({ dueDate: '2026-06-30', daysUntil: 12 });
  });
  it('overdue with a flat fee plus penalty interest once grace days pass', () => {
    const s = dueStatus(terms({ dueDay: 10, lateFee: 100, penaltyApr: 15 }), [], TODAY);
    // 100 + round(1607 × 15% / 365 × 8)
    expect(s).toMatchObject({ state: 'overdue', dueDate: '2026-06-10', daysLate: 8, daysUntil: -8, lateFee: 105, cycleStart: '2026-05-11' });
  });
  it('no fee while inside the grace period', () => {
    expect(dueStatus(terms({ dueDay: 10, lateFee: 100, graceDays: 10 }), [], TODAY)).toMatchObject({ state: 'overdue', lateFee: 0 });
  });
  it('a payment in the current cycle marks it paid and points at next month', () => {
    expect(dueStatus(terms({ dueDay: 10 }), [pay('2026-06-10', 1607)], TODAY)).toMatchObject({ state: 'paid', dueDate: '2026-07-10', daysUntil: 22, paidThisCycle: 1607 });
  });
  it("a payment on last cycle's due date does not count for this cycle", () => {
    expect(dueStatus(terms({ dueDay: 10 }), [pay('2026-05-10', 1607)], TODAY).state).toBe('overdue');
  });
  it('charges penalty only on the unpaid part of a partial payment', () => {
    const s = dueStatus(terms({ dueDay: 10, penaltyApr: 365 }), [pay('2026-06-12', 1000)], TODAY);
    // 607 × 365% / 365 × 8 = 48.56 → 49
    expect(s).toMatchObject({ state: 'overdue', paidThisCycle: 1000, lateFee: 49 });
  });
  it('closed debts are closed', () => {
    expect(dueStatus(terms({ done: true, paid: 9593 }), [], TODAY)).toMatchObject({ state: 'closed', amountDue: 0 });
  });
});
```

`tests/unit/debt-payment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CycleTerms, PaymentLite } from '@/server/debt/cycle';
import { splitPayment } from '@/server/debt/payment';

const TODAY = new Date('2026-06-18T00:00:00Z');
const terms = (o: Partial<CycleTerms> = {}): CycleTerms => ({
  original: 70000, paid: 24300, apr: 25, calc: 'reducing', monthly: 2783, fixedPayment: 0, termMonths: 0,
  done: false, dueDay: 25, graceDays: 0, lateFee: 0, penaltyApr: 0, ...o,
});

describe('splitPayment', () => {
  it('pays interest first, then principal', () => {
    expect(splitPayment(terms(), [], 2783, TODAY)).toEqual({ fee: 0, interest: 952, principal: 1831, excess: 0 });
  });
  it('does not charge interest twice in one cycle', () => {
    const earlier: PaymentLite[] = [{ date: TODAY, amount: 2783, principal: 1831, interest: 952, fee: 0 }];
    expect(splitPayment(terms({ paid: 24300 + 1831 }), earlier, 1000, TODAY)).toEqual({ fee: 0, interest: 0, principal: 1000, excess: 0 });
  });
  it('takes the late fee before interest on an overdue flat loan (EasyCash)', () => {
    const easyCash = terms({ original: 20000, paid: 5001, apr: 18, calc: 'flat', termMonths: 12, monthly: 0, dueDay: 5, lateFee: 100 });
    expect(splitPayment(easyCash, [], 2067, TODAY)).toEqual({ fee: 100, interest: 300, principal: 1667, excess: 0 });
  });
  it('caps principal at the balance and reports the excess', () => {
    expect(splitPayment(terms({ original: 1000, paid: 500, apr: 0 }), [], 800, TODAY)).toEqual({ fee: 0, interest: 0, principal: 500, excess: 300 });
  });
  it('a payment smaller than the fee only reduces the fee', () => {
    expect(splitPayment(terms({ dueDay: 10, lateFee: 100 }), [], 50, TODAY)).toEqual({ fee: 50, interest: 0, principal: 0, excess: 0 });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test:unit tests/unit/debt-cycle.test.ts tests/unit/debt-payment.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/server/debt/cycle.ts`:

```ts
// Monthly due cycle: which instalment is due, whether it's paid, and late fees.
// A cycle runs from the day after last month's due date through this month's due date.
import { amountDueThisMonth, remainingPrincipal, type DebtTerms } from './terms';

export interface CycleTerms extends DebtTerms {
  done: boolean;
  dueDay: number;
  graceDays: number;
  lateFee: number;
  penaltyApr: number;
}

export interface PaymentLite {
  date: Date;
  amount: number;
  principal: number;
  interest: number;
  fee: number;
}

export type DueState = 'closed' | 'paid' | 'upcoming' | 'dueSoon' | 'dueToday' | 'overdue';

export interface DueStatus {
  state: DueState;
  /** YYYY-MM-DD of the due date this status refers to (next month's once paid). */
  dueDate: string;
  /** negative when late */
  daysUntil: number;
  daysLate: number;
  /** YYYY-MM-DD, first day of the current cycle */
  cycleStart: string;
  amountDue: number;
  paidThisCycle: number;
  /** late fee + penalty interest accrued this cycle */
  lateFee: number;
}

const DAY_MS = 86_400_000;

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

const daysBetween = (from: Date, to: Date): number => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** The due date in a month; dueDay past the month's end clamps to its last day. monthIndex may overflow. */
export function dueDateIn(year: number, monthIndex: number, dueDay: number): Date {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(dueDay, lastDay)));
}

export function dueStatus(d: CycleTerms, payments: PaymentLite[], today: Date): DueStatus {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const thisDue = dueDateIn(y, m, d.dueDay);
  const prevDue = dueDateIn(y, m - 1, d.dueDay);
  const nextDue = dueDateIn(y, m + 1, d.dueDay);
  const cycleStart = new Date(prevDue.getTime() + DAY_MS);
  const amountDue = amountDueThisMonth(d);
  const paidThisCycle = payments.filter((p) => p.date >= cycleStart).reduce((s, p) => s + p.amount, 0);
  const base = { cycleStart: isoDate(cycleStart), amountDue, paidThisCycle, daysLate: 0, lateFee: 0 };

  if (d.done || remainingPrincipal(d) <= 0) return { ...base, state: 'closed', amountDue: 0, dueDate: isoDate(thisDue), daysUntil: 0 };
  if (paidThisCycle >= amountDue) return { ...base, state: 'paid', dueDate: isoDate(nextDue), daysUntil: daysBetween(today, nextDue) };
  if (today <= thisDue) {
    const daysUntil = daysBetween(today, thisDue);
    const state: DueState = daysUntil === 0 ? 'dueToday' : daysUntil <= 5 ? 'dueSoon' : 'upcoming';
    return { ...base, state, dueDate: isoDate(thisDue), daysUntil };
  }
  const daysLate = daysBetween(thisDue, today);
  const unpaid = amountDue - paidThisCycle;
  const lateFee = daysLate > d.graceDays ? d.lateFee + Math.round(((unpaid * d.penaltyApr) / 100 / 365) * daysLate) : 0;
  return { ...base, state: 'overdue', dueDate: isoDate(thisDue), daysUntil: -daysLate, daysLate, lateFee };
}
```

`src/server/debt/payment.ts`:

```ts
// Allocates a payment: late fee first, then this cycle's unpaid interest, then principal.
import { dueStatus, type CycleTerms, type PaymentLite } from './cycle';
import { interestForMonth, remainingPrincipal } from './terms';

export interface PaymentSplit {
  principal: number;
  interest: number;
  fee: number;
  /** amount beyond what is owed; not applied */
  excess: number;
}

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

export function splitPayment(d: CycleTerms, payments: PaymentLite[], amount: number, date: Date): PaymentSplit {
  const status = dueStatus(d, payments, date);
  const cycleStart = new Date(`${status.cycleStart}T00:00:00Z`);
  const inCycle = payments.filter((p) => p.date >= cycleStart);
  const feeDue = Math.max(0, status.lateFee - sum(inCycle.map((p) => p.fee)));
  const interestDue = Math.max(0, interestForMonth(d) - sum(inCycle.map((p) => p.interest)));

  let left = amount;
  const fee = Math.min(left, feeDue);
  left -= fee;
  const interest = Math.min(left, interestDue);
  left -= interest;
  const principal = Math.min(left, remainingPrincipal(d));
  left -= principal;
  return { fee, interest, principal, excess: left };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add cashflowkub
git commit -m "feat(debt): due cycles, late fees and payment allocation"
```

---

### Task 3: Payoff strategy simulator (pure)

**Files:**
- Create: `src/server/debt/strategy.ts`
- Test: `tests/unit/debt-strategy.test.ts`

**Interfaces:**
- Consumes: `MAX_MONTHS` (Task 1); `Strategy` type from `@/server/debt/logic` (port Task 4).
- Produces:
  - `interface SimDebt { id: number; balance: number; apr: number; calc: string; original: number; minPayment: number; sort: number }`
  - `interface SimResult { strategy: Strategy; extra: number; months: number; totalInterest: number; neverPaysOff: boolean; order: number[]; payoffMonth: Record<number, number> }`
  - `payoffOrder(debts: SimDebt[], strategy: Strategy): number[]`
  - `simulatePayoff(debts: SimDebt[], strategy: Strategy, extra: number, opts?: { rollover?: boolean }): SimResult`
  - `interface PayoffComparison { baseline: SimResult; plan: SimResult; interestSaved: number; monthsSaved: number }`, `comparePayoff(debts, strategy, extra): PayoffComparison` (baseline = minimums only, no rollover)

- [ ] **Step 1: Write the failing test**

`tests/unit/debt-strategy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { comparePayoff, payoffOrder, simulatePayoff, type SimDebt } from '@/server/debt/strategy';

const sim = (o: Partial<SimDebt>): SimDebt => ({ id: 1, balance: 1000, apr: 0, calc: 'reducing', original: 1000, minPayment: 100, sort: 1, ...o });

describe('payoffOrder', () => {
  const debts = [
    sim({ id: 1, balance: 5000, apr: 33, sort: 3 }),
    sim({ id: 2, balance: 1000, apr: 0, sort: 1 }),
    sim({ id: 3, balance: 3000, apr: 33, sort: 2 }),
  ];
  it('avalanche: highest rate, then smaller balance', () => expect(payoffOrder(debts, 'avalanche')).toEqual([3, 1, 2]));
  it('snowball: smallest balance first', () => expect(payoffOrder(debts, 'snowball')).toEqual([2, 3, 1]));
  it('custom: configured order', () => expect(payoffOrder(debts, 'custom')).toEqual([2, 3, 1]));
});

describe('simulatePayoff', () => {
  it('pays a 0% debt off with its minimum', () => {
    expect(simulatePayoff([sim({})], 'avalanche', 0)).toMatchObject({ months: 10, totalInterest: 0, neverPaysOff: false, payoffMonth: { 1: 10 } });
  });
  it('extra money shortens the payoff', () => {
    expect(simulatePayoff([sim({})], 'avalanche', 100).months).toBe(5);
  });
  it('rolls a closed debt’s minimum into the next target', () => {
    const debts = [sim({ id: 1, balance: 300, minPayment: 100 }), sim({ id: 2, balance: 1000, minPayment: 100, sort: 2 })];
    const r = simulatePayoff(debts, 'snowball', 0);
    expect(r.payoffMonth[1]).toBe(3);
    // months 1-3: debt 2 gets 100/mo (700 left); then 200/mo → 4 more months
    expect(r.payoffMonth[2]).toBe(7);
  });
  it('stops at the cap and flags debts that never pay off', () => {
    const r = simulatePayoff([sim({ balance: 10000, original: 10000, apr: 60, minPayment: 400 })], 'avalanche', 0);
    expect(r).toMatchObject({ months: 600, neverPaysOff: true });
  });
  it('handles no debts', () => {
    expect(simulatePayoff([], 'avalanche', 0)).toMatchObject({ months: 0, totalInterest: 0, order: [] });
  });
});

describe('comparePayoff', () => {
  const debts = [
    sim({ id: 1, balance: 45700, original: 70000, apr: 25, minPayment: 2783 }),
    sim({ id: 2, balance: 7430, original: 12000, apr: 33, minPayment: 1523, sort: 2 }),
    sim({ id: 3, balance: 178375, original: 186650, apr: 0, calc: 'flat', minPayment: 3889, sort: 3 }),
  ];
  it('extra payments save interest and months versus minimums only', () => {
    const c = comparePayoff(debts, 'avalanche', 2000);
    expect(c.plan.months).toBeLessThan(c.baseline.months);
    expect(c.interestSaved).toBeGreaterThan(0);
    expect(c.interestSaved).toBe(c.baseline.totalInterest - c.plan.totalInterest);
  });
  it('avalanche never pays more interest than snowball', () => {
    expect(comparePayoff(debts, 'avalanche', 2000).plan.totalInterest).toBeLessThanOrEqual(comparePayoff(debts, 'snowball', 2000).plan.totalInterest);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test:unit tests/unit/debt-strategy.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/server/debt/strategy.ts`:

```ts
// Month-by-month payoff simulation across all active debts.
// Each month: accrue interest, pay every minimum, then pour the remaining budget into
// the first open debt in strategy order. With rollover, the budget stays at the
// starting total, so a closed debt's minimum flows to the next one (snowball effect).
import type { Strategy } from './logic';
import { MAX_MONTHS } from './schedule';

export interface SimDebt {
  id: number;
  balance: number;
  apr: number;
  calc: string;
  original: number;
  minPayment: number;
  sort: number;
}

export interface SimResult {
  strategy: Strategy;
  extra: number;
  months: number;
  totalInterest: number;
  neverPaysOff: boolean;
  order: number[];
  payoffMonth: Record<number, number>;
}

export interface PayoffComparison {
  baseline: SimResult;
  plan: SimResult;
  interestSaved: number;
  monthsSaved: number;
}

export function payoffOrder(debts: SimDebt[], strategy: Strategy): number[] {
  const list = [...debts];
  if (strategy === 'avalanche') list.sort((a, b) => b.apr - a.apr || a.balance - b.balance || a.sort - b.sort);
  else if (strategy === 'snowball') list.sort((a, b) => a.balance - b.balance || b.apr - a.apr || a.sort - b.sort);
  else list.sort((a, b) => a.sort - b.sort);
  return list.map((d) => d.id);
}

export function simulatePayoff(debts: SimDebt[], strategy: Strategy, extra: number, opts: { rollover?: boolean } = {}): SimResult {
  const rollover = opts.rollover ?? true;
  const open = debts.filter((d) => d.balance > 0);
  const order = payoffOrder(open, strategy);
  const byId = new Map(open.map((d) => [d.id, d]));
  const balance = new Map(open.map((d) => [d.id, d.balance]));
  const startBudget = open.reduce((s, d) => s + d.minPayment, 0) + extra;
  const payoffMonth: Record<number, number> = {};
  let totalInterest = 0;
  let month = 0;
  const active = () => order.filter((id) => (balance.get(id) ?? 0) > 0);

  while (active().length > 0) {
    if (month >= MAX_MONTHS) return { strategy, extra, months: MAX_MONTHS, totalInterest, neverPaysOff: true, order, payoffMonth };
    month++;
    const ids = active();
    for (const id of ids) {
      const d = byId.get(id)!;
      const b = balance.get(id)!;
      const interest = Math.round((d.calc === 'flat' ? d.original : b) * (d.apr / 1200));
      totalInterest += interest;
      balance.set(id, b + interest);
    }
    let pool = rollover ? startBudget : ids.reduce((s, id) => s + byId.get(id)!.minPayment, 0) + extra;
    for (const id of ids) {
      const pay = Math.min(byId.get(id)!.minPayment, balance.get(id)!, pool);
      balance.set(id, balance.get(id)! - pay);
      pool -= pay;
    }
    for (const id of ids) {
      if (pool <= 0) break;
      const pay = Math.min(pool, balance.get(id)!);
      balance.set(id, balance.get(id)! - pay);
      pool -= pay;
    }
    for (const id of ids) if (balance.get(id)! <= 0) payoffMonth[id] = month;
  }
  return { strategy, extra, months: month, totalInterest, neverPaysOff: false, order, payoffMonth };
}

/** Chosen strategy + extra (with rollover) versus paying only each debt's own minimum. */
export function comparePayoff(debts: SimDebt[], strategy: Strategy, extra: number): PayoffComparison {
  const baseline = simulatePayoff(debts, strategy, 0, { rollover: false });
  const plan = simulatePayoff(debts, strategy, extra);
  return { baseline, plan, interestSaved: baseline.totalInterest - plan.totalInterest, monthsSaved: baseline.months - plan.months };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add cashflowkub
git commit -m "feat(debt): avalanche/snowball payoff simulator"
```

---

### Task 4: DSR and smart plan (pure)

**Files:**
- Create: `src/server/debt/dsr.ts`
- Test: `tests/unit/debt-dsr.test.ts`

**Interfaces:**
- Consumes: `DueStatus` (Task 2).
- Produces:
  - `type DsrBand = 'healthy' | 'manageable' | 'high' | 'critical'`, `DSR_LIMITS = { healthy: 0.3, manageable: 0.4, high: 0.6 }`, `REFINANCE_APR = 25`, `REFINANCE_MIN_BALANCE = 10_000`
  - `interface PlanDebt { id: number; apr: number; remaining: number; installment: number; done: boolean; due: Pick<DueStatus, 'state' | 'amountDue' | 'paidThisCycle' | 'lateFee'> }` (`DebtView` from Task 5 satisfies it structurally)
  - `interface DsrResult { income: number; monthlyDebt: number; ratio: number | null; band: DsrBand | null }`, `dsrBand(ratio)`, `computeDsr(debts: PlanDebt[], income: number): DsrResult`
  - `type SmartActionKey = 'setIncome' | 'payOverdue' | 'cutDsr' | 'quickWin' | 'focusHighestRate' | 'refinance' | 'noNewDebt' | 'debtFree'`, `interface SmartAction { key: SmartActionKey; debtId?: number; amount?: number }`, `interface QuickWin { id; remaining; installment; dsrAfter: number | null }`, `interface SmartPlan { dsr; targetDsr; monthlyCut; incomeNeeded; quickWins: QuickWin[]; refinance: number[]; actions: SmartAction[] }`, `buildSmartPlan(debts: PlanDebt[], income: number, targetDsr?: number): SmartPlan`

- [ ] **Step 1: Write the failing test**

`tests/unit/debt-dsr.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSmartPlan, computeDsr, dsrBand, type PlanDebt } from '@/server/debt/dsr';

const pd = (o: Partial<PlanDebt> & { id: number }): PlanDebt => ({
  apr: 0, remaining: 10000, installment: 1000, done: false,
  due: { state: 'upcoming', amountDue: o.installment ?? 1000, paidThisCycle: 0, lateFee: 0 }, ...o,
});

describe('computeDsr', () => {
  it('sums instalments of active debts over income', () => {
    const r = computeDsr([pd({ id: 1, installment: 3000 }), pd({ id: 2, installment: 1000 }), pd({ id: 3, installment: 9999, done: true })], 10000);
    expect(r).toEqual({ income: 10000, monthlyDebt: 4000, ratio: 0.4, band: 'manageable' });
  });
  it('returns null (not Infinity) when income is unknown', () => {
    expect(computeDsr([pd({ id: 1 })], 0)).toEqual({ income: 0, monthlyDebt: 1000, ratio: null, band: null });
  });
  it('bands at 30 / 40 / 60 %', () => {
    expect([0.3, 0.31, 0.4, 0.6, 0.61].map(dsrBand)).toEqual(['healthy', 'manageable', 'manageable', 'high', 'critical']);
  });
});

describe('buildSmartPlan', () => {
  it('asks for income first when it is missing', () => {
    expect(buildSmartPlan([pd({ id: 1 })], 0).actions[0]).toEqual({ key: 'setIncome' });
  });
  it('puts overdue payments (with fees) at the top', () => {
    const overdue = pd({ id: 16, installment: 1967, due: { state: 'overdue', amountDue: 1967, paidThisCycle: 0, lateFee: 100 } });
    expect(buildSmartPlan([overdue], 62000).actions[0]).toEqual({ key: 'payOverdue', debtId: 16, amount: 2067 });
  });
  it('computes the monthly cut needed to reach the target DSR', () => {
    const plan = buildSmartPlan([pd({ id: 1, installment: 6000, remaining: 100000 })], 10000, 0.4);
    expect(plan.monthlyCut).toBe(2000);
    expect(plan.incomeNeeded).toBe(15000);
    expect(plan.actions.map((a) => a.key)).toEqual(['cutDsr', 'quickWin', 'noNewDebt']);
  });
  it('ranks quick wins by monthly relief per baht with cumulative DSR', () => {
    const plan = buildSmartPlan([
      pd({ id: 1, installment: 1000, remaining: 10000 }),
      pd({ id: 2, installment: 1000, remaining: 2000 }),
      pd({ id: 3, installment: 500, remaining: 500 }),
    ], 5000);
    expect(plan.quickWins.map((q) => q.id)).toEqual([3, 2, 1]);
    expect(plan.quickWins.map((q) => q.dsrAfter)).toEqual([0.4, 0.2, 0]);
  });
  it('focuses the highest rate and flags refinance candidates', () => {
    const plan = buildSmartPlan([
      pd({ id: 2, apr: 25, remaining: 45700, installment: 2783 }),
      pd({ id: 5, apr: 33, remaining: 2600, installment: 1016 }),
      pd({ id: 3, apr: 33, remaining: 7430, installment: 1523 }),
    ], 62000);
    expect(plan.actions).toContainEqual({ key: 'focusHighestRate', debtId: 5 });
    expect(plan.refinance).toEqual([2]);
    expect(plan.actions).toContainEqual({ key: 'refinance', debtId: 2 });
    expect(plan.actions.some((a) => a.key === 'quickWin')).toBe(false); // DSR is healthy
  });
  it('congratulates when there is no active debt', () => {
    expect(buildSmartPlan([pd({ id: 1, done: true })], 50000).actions).toEqual([{ key: 'debtFree' }]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test:unit tests/unit/debt-dsr.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/server/debt/dsr.ts`:

```ts
// Debt Service Ratio (DSR = monthly debt payments / monthly income) and the smart plan built on it.
import type { DueStatus } from './cycle';

export type DsrBand = 'healthy' | 'manageable' | 'high' | 'critical';
export const DSR_LIMITS = { healthy: 0.3, manageable: 0.4, high: 0.6 } as const;
export const REFINANCE_APR = 25;
export const REFINANCE_MIN_BALANCE = 10_000;
const EPS = 1e-9;

export interface PlanDebt {
  id: number;
  apr: number;
  remaining: number;
  installment: number;
  done: boolean;
  due: Pick<DueStatus, 'state' | 'amountDue' | 'paidThisCycle' | 'lateFee'>;
}

export interface DsrResult {
  income: number;
  monthlyDebt: number;
  ratio: number | null;
  band: DsrBand | null;
}

export function dsrBand(ratio: number): DsrBand {
  if (ratio <= DSR_LIMITS.healthy) return 'healthy';
  if (ratio <= DSR_LIMITS.manageable) return 'manageable';
  if (ratio <= DSR_LIMITS.high) return 'high';
  return 'critical';
}

const activeOf = (debts: PlanDebt[]): PlanDebt[] => debts.filter((d) => !d.done && d.remaining > 0);

export function computeDsr(debts: PlanDebt[], income: number): DsrResult {
  const monthlyDebt = activeOf(debts).reduce((s, d) => s + d.installment, 0);
  if (income <= 0) return { income, monthlyDebt, ratio: null, band: null };
  const ratio = monthlyDebt / income;
  return { income, monthlyDebt, ratio, band: dsrBand(ratio) };
}

export type SmartActionKey = 'setIncome' | 'payOverdue' | 'cutDsr' | 'quickWin' | 'focusHighestRate' | 'refinance' | 'noNewDebt' | 'debtFree';

export interface SmartAction {
  key: SmartActionKey;
  debtId?: number;
  amount?: number;
}

export interface QuickWin {
  id: number;
  remaining: number;
  installment: number;
  /** DSR after closing this and every quick win above it; null without income */
  dsrAfter: number | null;
}

export interface SmartPlan {
  dsr: DsrResult;
  targetDsr: number;
  monthlyCut: number;
  incomeNeeded: number;
  quickWins: QuickWin[];
  refinance: number[];
  actions: SmartAction[];
}

export function buildSmartPlan(debts: PlanDebt[], income: number, targetDsr: number = DSR_LIMITS.manageable): SmartPlan {
  const active = activeOf(debts);
  const dsr = computeDsr(active, income);
  const actions: SmartAction[] = [];
  if (active.length === 0) {
    return { dsr, targetDsr, monthlyCut: 0, incomeNeeded: 0, quickWins: [], refinance: [], actions: [{ key: 'debtFree' }] };
  }
  if (dsr.ratio === null) actions.push({ key: 'setIncome' });

  for (const d of active) {
    if (d.due.state === 'overdue') actions.push({ key: 'payOverdue', debtId: d.id, amount: d.due.amountDue - d.due.paidThisCycle + d.due.lateFee });
  }

  // EPS keeps float noise (e.g. 6000 / 0.4 = 14999.999…) from rounding a whole baht up.
  const monthlyCut = dsr.ratio !== null && dsr.ratio > targetDsr ? Math.ceil(dsr.monthlyDebt - targetDsr * income - EPS) : 0;
  if (monthlyCut > 0) actions.push({ key: 'cutDsr', amount: monthlyCut });

  // Quick wins: closing these frees the most monthly payment per baht spent.
  let freed = 0;
  const quickWins: QuickWin[] = active
    .filter((d) => d.installment > 0)
    .sort((a, b) => b.installment / b.remaining - a.installment / a.remaining)
    .slice(0, 3)
    .map((d) => {
      freed += d.installment;
      return { id: d.id, remaining: d.remaining, installment: d.installment, dsrAfter: income > 0 ? (dsr.monthlyDebt - freed) / income : null };
    });
  if (quickWins[0] && (dsr.ratio === null || dsr.ratio > DSR_LIMITS.healthy)) {
    actions.push({ key: 'quickWin', debtId: quickWins[0].id, amount: quickWins[0].remaining });
  }

  const focus = active.filter((d) => d.apr > 0).sort((a, b) => b.apr - a.apr || a.remaining - b.remaining)[0];
  if (focus) actions.push({ key: 'focusHighestRate', debtId: focus.id });

  const refinance = active.filter((d) => d.apr >= REFINANCE_APR && d.remaining >= REFINANCE_MIN_BALANCE).map((d) => d.id);
  for (const id of refinance) actions.push({ key: 'refinance', debtId: id });

  if (dsr.ratio !== null && dsr.ratio > DSR_LIMITS.manageable) actions.push({ key: 'noNewDebt' });

  return {
    dsr, targetDsr, monthlyCut,
    incomeNeeded: targetDsr > 0 ? Math.ceil(dsr.monthlyDebt / targetDsr - EPS) : 0,
    quickWins, refinance, actions,
  };
}
```

In the "monthly cut" test, the single debt has apr 0, so there is no `focusHighestRate` action. That matches the expected `['cutDsr', 'quickWin', 'noNewDebt']`.

- [ ] **Step 4: Run tests**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add cashflowkub
git commit -m "feat(debt): DSR bands and smart plan"
```

---

### Task 5: Schema, seed, DebtView v2 and the payments ledger API

**Files:**
- Modify: `prisma/schema.prisma`, `prisma/seed-data.ts`, `prisma/seed-lib.ts`
- Create: `prisma/migrations/20261013010000_debt_management/migration.sql`
- Modify: `src/server/views.ts`, `src/server/debt/logic.ts`, `src/server/debt/service.ts`, `src/app/(app)/debts/[id]/pay-button.tsx`, `src/app/(app)/setup/page.tsx`
- Create: `src/app/api/v1/debts/[id]/payments/route.ts`, `src/app/api/v1/debts/[id]/payments/[paymentId]/route.ts`
- Delete: `src/app/api/v1/debts/[id]/pay/route.ts`
- Modify tests: `tests/fixtures.ts`, `tests/unit/views.test.ts`, `tests/unit/debt-logic.test.ts`, `tests/unit/analytics-logic.test.ts`, `tests/unit/setup-logic.test.ts`, `tests/api/db.test.ts`, `tests/api/seed.test.ts`, `tests/api/debts.test.ts`, `tests/api/aggregates.test.ts`
- Test: `tests/api/debt-payments.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2; port helpers (`route`, `readJson`, `parseId`, `parseBody`, `HttpError`, `parseFlexDate`, `today`).
- Produces:
  - Prisma: `Debt` gains `kind`, `lender`, `openingPaid`, `fixedPayment`, `termMonths`, `dueDay`, `graceDays`, `lateFee`, `penaltyApr`, `payments: DebtPayment[]` and loses `payoff`, `payoffTh`, `monthsLeft`. New models: `DebtPayment { id, debtId, date, amount, principal, interest, fee, note }` and `Setting { key, value }`.
  - `type DebtWithPayments = Debt & { payments: DebtPayment[] }`; `interface DebtView extends Debt { remaining; progress; installment; monthsLeft; payoff; payoffTh; totalInterestLeft; neverPaysOff; due: DueStatus }`; `toDebtView(d: DebtWithPayments, today: Date): DebtView` from `@/server/views`. **The signature changes**, and every caller passes `today()` and includes payments.
  - `buildSchedule(d: DebtWithPayments, today: Date): ScheduleView` where `ScheduleView = { debt: DebtView; schedule: ScheduleRow[]; totalInterest: number; months: number; neverPaysOff: boolean }` from `@/server/debt/logic`. `applyPayment` is removed.
  - `DEBT_KINDS = ['paylater','cashloan','bankloan','creditcard','personal'] as const`, `type DebtKind`, `interface PaymentView { id; debtId; date: string; amount; principal; interest; fee; note }`, `interface DebtDetail extends ScheduleView { payments: PaymentView[] }`, `getDebtDetail(id): Promise<DebtDetail>`, `listPayments(debtId): Promise<PaymentView[]>`, `recordPayment(debtId, body): Promise<{ payment: PaymentView; debt: DebtView; excess: number }>`, `deletePayment(debtId, paymentId): Promise<DebtView>` from `@/server/debt/service`. `listDebts`, `listActiveDebtViews`, `getDebt`, `getDebtSchedule`, `createDebt`, `updateDebt`, `deleteDebt` keep their names. `payDebt` is removed.
  - REST: `GET/POST /api/v1/debts/:id/payments`, `DELETE /api/v1/debts/:id/payments/:paymentId`. `POST /debts/:id/pay` is gone.
  - Test helper `debtView(o?: Partial<Debt>, payments?: DebtPayment[]): DebtView` and `payment(o)` from `tests/fixtures.ts`.

- [ ] **Step 1: Change the schema**

In `prisma/schema.prisma`, replace `model Debt { … }` with:

```prisma
/// A loan or credit line. paid = openingPaid + Σ payments.principal (kept in sync by the service).
model Debt {
  id           Int           @id @default(autoincrement())
  name         String
  th           String        @default("")
  icon         String        @default("credit-card")
  tint         String        @default("pdf")
  kind         String        @default("personal") /// paylater | cashloan | bankloan | creditcard | personal
  lender       String        @default("")
  original     Int
  openingPaid  Int           @default(0) @map("opening_paid") /// principal repaid before tracking started
  paid         Int           @default(0)
  apr          Float         @default(0) /// nominal annual %
  calc         String        @default("reducing") /// flat | reducing
  monthly      Int           @default(0) /// minimum payment (open-ended / revolving)
  fixedPayment Int           @default(0) @map("fixed_payment") /// statement instalment; > 0 overrides calc
  termMonths   Int           @default(0) @map("term_months")
  dueDay       Int           @default(1) @map("due_day")
  graceDays    Int           @default(0) @map("grace_days")
  lateFee      Int           @default(0) @map("late_fee")
  penaltyApr   Float         @default(0) @map("penalty_apr")
  done         Boolean       @default(false)
  revolving    Boolean       @default(false)
  sort         Int           @default(0)
  payments     DebtPayment[]

  @@map("debts")
}

/// One recorded repayment, already split into fee / interest / principal.
model DebtPayment {
  id        Int      @id @default(autoincrement())
  debtId    Int      @map("debt_id")
  debt      Debt     @relation(fields: [debtId], references: [id], onDelete: Cascade)
  date      DateTime @db.Date
  amount    Int
  principal Int
  interest  Int
  fee       Int
  note      String   @default("")

  @@index([debtId, date])
  @@map("debt_payments")
}

/// Key/value app settings (e.g. monthlyIncome for DSR).
model Setting {
  key   String @id
  value String

  @@map("settings")
}
```

- [ ] **Step 2: Write the migration by hand and apply it**

`prisma/migrations/20261013010000_debt_management/migration.sql`:

```sql
-- Debt terms, due-date rules and opening balance; payoff labels become derived.
ALTER TABLE "debts"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN "lender" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "opening_paid" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fixed_payment" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "term_months" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "due_day" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "grace_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "late_fee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "penalty_apr" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Everything repaid so far predates the ledger.
UPDATE "debts" SET "opening_paid" = "paid";

ALTER TABLE "debts" DROP COLUMN "payoff", DROP COLUMN "payoff_th", DROP COLUMN "months_left";

CREATE TABLE "debt_payments" (
  "id" SERIAL NOT NULL,
  "debt_id" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "amount" INTEGER NOT NULL,
  "principal" INTEGER NOT NULL,
  "interest" INTEGER NOT NULL,
  "fee" INTEGER NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "debt_payments_debt_id_date_idx" ON "debt_payments"("debt_id", "date");
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_fkey"
  FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);
```

```bash
pnpm prisma migrate deploy
pnpm prisma generate
pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script
```

Expected: the deploy applies `20261013010000_debt_management`. The final `migrate diff` prints an empty migration (`-- This is an empty migration.`), which proves the SQL matches the schema. If it prints statements, fix `migration.sql` until it doesn't. If the flags are rejected, `pnpm prisma migrate diff --help` lists the Prisma 7 names; `--from-migrations` may need the shadow database configured in `prisma.config.ts`.

`pnpm typecheck` now fails where code uses `payoff`/`monthsLeft`/`applyPayment`. The next steps fix that.

- [ ] **Step 3: Update the seed**

In `prisma/seed-data.ts`, replace the `debts` export and add `debtPayments` and `settings`:

```ts
// paid = openingPaid + Σ principal of that debt's seeded payments (asserted in tests/api/seed.test.ts).
// Shopee rows are illustrative demo terms, not Shopee's published rates/fees.
export const debts: Prisma.DebtCreateManyInput[] = [
  { name: 'Student Loan (กยศ)', th: 'กยศ', icon: 'graduation-cap', tint: 'doc', kind: 'personal', lender: 'กยศ', original: 186650, openingPaid: 8275, paid: 8275, apr: 0, monthly: 3889, calc: 'flat', dueDay: 28, sort: 1 },
  { name: 'KrungThai Personal', th: 'กรุงไทยใจป้ำ', icon: 'landmark', tint: 'pdf', kind: 'bankloan', lender: 'Krungthai Bank', original: 70000, openingPaid: 24300, paid: 24300, apr: 25, monthly: 2783, calc: 'reducing', dueDay: 25, sort: 2 },
  { name: 'Kbank Nano 3', th: 'Kbank Nano 3', icon: 'credit-card', tint: 'pdf', kind: 'cashloan', lender: 'KBank', original: 12000, openingPaid: 4570, paid: 4570, apr: 33, monthly: 1523, calc: 'reducing', dueDay: 25, revolving: true, sort: 3 },
  { name: 'SPEC 3 Personal', th: 'SPEC 3', icon: 'receipt', tint: 'pdf', kind: 'cashloan', lender: 'SPEC', original: 9593, openingPaid: 5300, paid: 5300, apr: 33, monthly: 1607, calc: 'reducing', dueDay: 20, sort: 4 },
  { name: 'Kbank Nano 2', th: 'Kbank Nano 2', icon: 'credit-card', tint: 'pdf', kind: 'cashloan', lender: 'KBank', original: 8000, openingPaid: 5400, paid: 5400, apr: 33, monthly: 1016, calc: 'reducing', dueDay: 25, revolving: true, sort: 5 },
  { name: 'SPEC 4', th: 'SPEC 4', icon: 'receipt', tint: 'doc', kind: 'cashloan', lender: 'SPEC', original: 7789, openingPaid: 7789, paid: 7789, apr: 33, monthly: 948, calc: 'reducing', done: true, sort: 6 },
  { name: 'iPhone 16 / PQ', th: 'ผ่อน iPhone 16 กับ PQ', icon: 'smartphone', tint: 'image', kind: 'personal', lender: 'PQ', original: 30580, openingPaid: 30580, paid: 30580, apr: 0, monthly: 3058, calc: 'flat', done: true, sort: 7 },
  { name: 'Motorcycle', th: 'รถมอเตอร์ไซค์', icon: 'bike', tint: 'doc', kind: 'personal', original: 14885, openingPaid: 14885, paid: 14885, apr: 0, monthly: 2977, calc: 'flat', done: true, sort: 8 },
  { name: 'iPhone Piggybank', th: 'ยืมกระปุก IPHONE', icon: 'piggy-bank', tint: 'folder', kind: 'personal', original: 15800, openingPaid: 15800, paid: 15800, apr: 0, monthly: 7900, calc: 'flat', done: true, sort: 9 },
  { name: 'Kbank Nano 1', th: 'Kbank Nano', icon: 'credit-card', tint: 'pdf', kind: 'cashloan', lender: 'KBank', original: 5000, openingPaid: 5000, paid: 5000, apr: 33, monthly: 635, calc: 'reducing', done: true, sort: 10 },
  { name: 'SPEC 1', th: 'SPEC 1', icon: 'receipt', tint: 'pdf', kind: 'cashloan', lender: 'SPEC', original: 4032, openingPaid: 4032, paid: 4032, apr: 31.4, monthly: 898, calc: 'reducing', done: true, sort: 11 },
  { name: 'SPEC 2', th: 'SPEC 2', icon: 'receipt', tint: 'pdf', kind: 'cashloan', lender: 'SPEC', original: 5514, openingPaid: 5514, paid: 5514, apr: 33, monthly: 915, calc: 'reducing', done: true, sort: 12 },
  { name: 'Water Heater / PQ', th: 'เครื่องทำน้ำอุ่น พี่คิว', icon: 'shower-head', tint: 'image', kind: 'personal', lender: 'PQ', original: 1886, openingPaid: 1886, paid: 1886, apr: 0, monthly: 629, calc: 'flat', done: true, sort: 13 },
  { name: 'Desk & Keyboard', th: 'โต๊ะ และ คีย์บอร์ด', icon: 'monitor', tint: 'doc', kind: 'personal', original: 2137, openingPaid: 2137, paid: 2137, apr: 0, monthly: 712, calc: 'flat', done: true, sort: 14 },
  // id 15: SPayLater-style, fixed statement instalment, paid this cycle.
  { name: 'Shopee SPayLater', th: 'ช้อปปี้ เพย์เลเตอร์', icon: 'shopping-bag', tint: 'image', kind: 'paylater', lender: 'Shopee', original: 7500, openingPaid: 0, paid: 3750, apr: 0, calc: 'flat', fixedPayment: 1250, termMonths: 6, dueDay: 1, revolving: true, sort: 15 },
  // id 16: EasyCash-style flat-rate cash loan, June instalment missed (overdue with a late fee).
  { name: 'Shopee EasyCash', th: 'ช้อปปี้ อีซี่แคช', icon: 'hand-coins', tint: 'folder', kind: 'cashloan', lender: 'Shopee', original: 20000, openingPaid: 0, paid: 5001, apr: 18, calc: 'flat', termMonths: 12, dueDay: 5, lateFee: 100, sort: 16 },
];

export const debtPayments: Prisma.DebtPaymentCreateManyInput[] = [
  { debtId: 15, date: d('2026-04-01'), amount: 1250, principal: 1250, interest: 0, fee: 0, note: 'Statement Apr' },
  { debtId: 15, date: d('2026-05-01'), amount: 1250, principal: 1250, interest: 0, fee: 0, note: 'Statement May' },
  { debtId: 15, date: d('2026-06-01'), amount: 1250, principal: 1250, interest: 0, fee: 0, note: 'Statement Jun' },
  { debtId: 16, date: d('2026-03-05'), amount: 1967, principal: 1667, interest: 300, fee: 0, note: '' },
  { debtId: 16, date: d('2026-04-05'), amount: 1967, principal: 1667, interest: 300, fee: 0, note: '' },
  { debtId: 16, date: d('2026-05-05'), amount: 1967, principal: 1667, interest: 300, fee: 0, note: '' },
];

export const settings: Prisma.SettingCreateManyInput[] = [{ key: 'monthlyIncome', value: '62000' }];
```

In `prisma/seed-lib.ts`:
- add `'debt_payments', 'settings',` at the **start** of the `TABLES` array;
- after `await tx.debt.createMany({ data: data.debts });` add:

```ts
    await tx.debtPayment.createMany({ data: data.debtPayments });
    await tx.setting.createMany({ data: data.settings });
```

- [ ] **Step 4: DebtView v2 and logic**

Replace the debt half of `src/server/views.ts` (keep the bill half unchanged):

```ts
// Derived read shapes rendered by more than one feature.
import type { Bill, Debt, DebtPayment } from '@/generated/prisma/client';
import { dueStatus, type DueStatus } from '@/server/debt/cycle';
import { payoffLabel, projectSchedule } from '@/server/debt/schedule';
import { amountDueThisMonth } from '@/server/debt/terms';

export type DebtWithPayments = Debt & { payments: DebtPayment[] };

export interface DebtView extends Debt {
  remaining: number;
  /** 0..1, paid / original */
  progress: number;
  /** amount due this month */
  installment: number;
  monthsLeft: number;
  /** "Apr 2030"; "—" when the payment never clears the balance; "" when closed */
  payoff: string;
  payoffTh: string;
  totalInterestLeft: number;
  neverPaysOff: boolean;
  due: DueStatus;
}

export function toDebtView(d: DebtWithPayments, today: Date): DebtView {
  const { payments, ...debt } = d;
  const projection = projectSchedule(debt);
  const closed = debt.done || debt.paid >= debt.original;
  const label = payoffLabel(today, projection.rows.length);
  return {
    ...debt,
    remaining: Math.max(0, debt.original - debt.paid),
    progress: debt.original > 0 ? debt.paid / debt.original : 0,
    installment: closed ? 0 : amountDueThisMonth(debt),
    monthsLeft: projection.rows.length,
    payoff: closed ? '' : projection.neverPaysOff ? '—' : label.en,
    payoffTh: closed ? '' : projection.neverPaysOff ? '—' : label.th,
    totalInterestLeft: projection.totalInterest,
    neverPaysOff: projection.neverPaysOff,
    due: dueStatus(debt, payments, today),
  };
}
```

Replace `src/server/debt/logic.ts` with:

```ts
// Debt read models built on the pure terms/schedule/cycle modules, plus payoff ordering.
import { toDebtView, type DebtView, type DebtWithPayments } from '@/server/views';
import { projectSchedule, type ScheduleRow } from './schedule';

export type { ScheduleRow } from './schedule';

export interface ScheduleView {
  debt: DebtView;
  schedule: ScheduleRow[];
  totalInterest: number;
  months: number;
  neverPaysOff: boolean;
}

export function buildSchedule(d: DebtWithPayments, today: Date): ScheduleView {
  const { rows, totalInterest, neverPaysOff } = projectSchedule(d);
  return { debt: toDebtView(d, today), schedule: rows, totalInterest, months: rows.length, neverPaysOff };
}

export type Strategy = 'avalanche' | 'snowball' | 'custom';

export function parseStrategy(v: string | undefined): Strategy {
  return v === 'snowball' || v === 'custom' ? v : 'avalanche';
}

export function sortByStrategy(debts: DebtView[], strategy: Strategy): DebtView[] {
  const list = [...debts];
  if (strategy === 'avalanche') return list.sort((a, b) => b.apr - a.apr || a.remaining - b.remaining);
  if (strategy === 'snowball') return list.sort((a, b) => a.remaining - b.remaining);
  return list.sort((a, b) => a.sort - b.sort);
}
```

- [ ] **Step 5: Update test fixtures and the pure tests that used the old view**

In `tests/fixtures.ts`:
- replace the `debt` factory;
- add `payment` and `debtView`;
- extend the import list with `DebtPayment`;
- add `import { toDebtView, type DebtView } from '@/server/views';`.

```ts
export const debt = (o: Partial<Debt> = {}): Debt => ({
  id: 1, name: 'Loan', th: 'เงินกู้', icon: 'landmark', tint: 'pdf', kind: 'personal', lender: '', original: 10000, openingPaid: 0, paid: 0,
  apr: 0, calc: 'reducing', monthly: 1000, fixedPayment: 0, termMonths: 0, dueDay: 25, graceDays: 0, lateFee: 0, penaltyApr: 0,
  done: false, revolving: false, sort: 1, ...o,
});
export const payment = (o: Partial<DebtPayment> = {}): DebtPayment => ({
  id: 1, debtId: 1, date: new Date('2026-06-01T00:00:00Z'), amount: 1000, principal: 1000, interest: 0, fee: 0, note: '', ...o,
});
export const debtView = (o: Partial<Debt> = {}, payments: DebtPayment[] = []): DebtView =>
  toDebtView({ ...debt(o), payments }, new Date('2026-06-18T00:00:00Z'));
```

In `tests/unit/analytics-logic.test.ts` and `tests/unit/setup-logic.test.ts`:
- replace every `toDebtView(debt(` … `))` with `debtView(` … `)`;
- delete the `import { toDebtView } from '@/server/views';` line;
- in the `../fixtures` import, replace `debt` with `debtView`.

```bash
sed -i '' -E 's/toDebtView\(debt\(([^)]*)\)\)/debtView(\1)/g' tests/unit/analytics-logic.test.ts tests/unit/setup-logic.test.ts
sed -i '' -E "/import \{ toDebtView \} from '@\/server\/views';/d" tests/unit/analytics-logic.test.ts tests/unit/setup-logic.test.ts
sed -i '' "s/, debt, /, debtView, /" tests/unit/analytics-logic.test.ts tests/unit/setup-logic.test.ts
```

Replace the `toDebtView` block in `tests/unit/views.test.ts` (keep the `toBillView` block):

```ts
import { describe, expect, it } from 'vitest';
import { toBillView } from '@/server/views';
import { bill, debtView, payment } from '../fixtures';

describe('toDebtView', () => {
  it('derives remaining, progress, instalment and payoff from terms', () => {
    const v = debtView({ original: 20000, paid: 5001, apr: 18, calc: 'flat', termMonths: 12, monthly: 0, dueDay: 5, lateFee: 100 });
    expect(v).toMatchObject({ remaining: 14999, installment: 1967, monthsLeft: 9, payoff: 'Mar 2027', payoffTh: 'มี.ค. 2027', totalInterestLeft: 2700, neverPaysOff: false });
    expect(v.due).toMatchObject({ state: 'overdue', lateFee: 100 });
  });
  it('uses payments to decide the due state and drops the payments array', () => {
    const v = debtView({ dueDay: 1, fixedPayment: 1250, original: 7500, paid: 3750 }, [payment({ amount: 1250 })]);
    expect(v.due.state).toBe('paid');
    expect(v).not.toHaveProperty('payments');
  });
  it('closed debts have no instalment or payoff', () => {
    expect(debtView({ original: 100, paid: 100, done: true })).toMatchObject({ remaining: 0, installment: 0, payoff: '', monthsLeft: 0 });
  });
  it('marks a debt whose payment never clears the interest', () => {
    expect(debtView({ original: 10000, apr: 60, monthly: 400 })).toMatchObject({ neverPaysOff: true, payoff: '—' });
  });
});

describe('toBillView', () => {
  it.each([
    [{ paid: true, dueDay: 1 }, 'paid', -17],
    [{ dueDay: 16 }, 'overdue', -2],
    [{ dueDay: 18 }, 'dueToday', 0],
    [{ dueDay: 23 }, 'dueSoon', 5],
    [{ dueDay: 24 }, 'upcoming', 6],
  ] as const)('%o -> %s', (o, status, diff) => {
    const v = toBillView(bill(o), 18);
    expect(v.status).toBe(status);
    expect(v.daysDiff).toBe(diff);
  });
});
```

Replace `tests/unit/debt-logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSchedule, parseStrategy, sortByStrategy } from '@/server/debt/logic';
import { debt, debtView } from '../fixtures';

const TODAY = new Date('2026-06-18T00:00:00Z');

describe('buildSchedule', () => {
  it('wraps the projection with the debt view', () => {
    const s = buildSchedule({ ...debt({ original: 70000, paid: 24300, apr: 25, monthly: 2783 }), payments: [] }, TODAY);
    expect(s.schedule[0]).toEqual({ month: 1, payment: 2783, principal: 1831, interest: 952, balance: 43869 });
    expect(s.months).toBe(s.schedule.length);
    expect(s.debt.monthsLeft).toBe(s.months);
    expect(s.neverPaysOff).toBe(false);
  });
});

describe('sortByStrategy', () => {
  const views = [
    debtView({ id: 1, apr: 0, original: 1000, sort: 1 }),
    debtView({ id: 2, apr: 33, original: 5000, sort: 2 }),
    debtView({ id: 3, apr: 25, original: 300, sort: 3 }),
  ];
  it('avalanche = highest APR first', () => expect(sortByStrategy(views, 'avalanche').map((d) => d.id)).toEqual([2, 3, 1]));
  it('snowball = smallest balance first', () => expect(sortByStrategy(views, 'snowball').map((d) => d.id)).toEqual([3, 1, 2]));
  it('custom = configured order', () => expect(sortByStrategy(views, 'custom').map((d) => d.id)).toEqual([1, 2, 3]));
  it('parseStrategy falls back to avalanche', () => {
    expect(parseStrategy('snowball')).toBe('snowball');
    expect(parseStrategy(undefined)).toBe('avalanche');
  });
});
```

Run: `pnpm test:unit`
Expected: PASS. (Services still fail typecheck until Step 6.)

- [ ] **Step 6: Debt service v2**

Replace `src/server/debt/service.ts`:

```ts
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { today } from '@/lib/clock';
import type { DebtPayment, Prisma } from '@/generated/prisma/client';
import { badRequest, HttpError, notFound } from '@/server/errors';
import { parseFlexDate } from '@/server/transaction/logic';
import { parseBody } from '@/server/validate';
import { toDebtView, type DebtView } from '@/server/views';
import { buildSchedule, type ScheduleView } from './logic';
import { isoDate } from './cycle';
import { splitPayment } from './payment';

export const DEBT_KINDS = ['paylater', 'cashloan', 'bankloan', 'creditcard', 'personal'] as const;
export type DebtKind = (typeof DEBT_KINDS)[number];

const text = z.string().optional();
const money = z.number().int().nonnegative().optional();
const debtFields = z.object({
  name: z.string().trim().min(1),
  th: text, icon: text, tint: text,
  kind: z.enum(DEBT_KINDS).optional(),
  lender: text,
  original: z.number().int().positive(),
  openingPaid: money,
  apr: z.number().min(0).max(200).optional(),
  calc: z.enum(['flat', 'reducing']).optional(),
  monthly: money,
  fixedPayment: money,
  termMonths: z.number().int().min(0).max(600).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  graceDays: z.number().int().min(0).max(60).optional(),
  lateFee: money,
  penaltyApr: z.number().min(0).max(200).optional(),
  revolving: z.boolean().optional(),
  sort: z.number().int().optional(),
});
const paymentSchema = z.object({
  amount: z.number().int().positive(),
  date: z.string().optional(),
  note: z.string().max(200).optional(),
});

export interface PaymentView {
  id: number;
  debtId: number;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
  principal: number;
  interest: number;
  fee: number;
  note: string;
}

export interface DebtDetail extends ScheduleView {
  payments: PaymentView[];
}

const withPayments = { payments: { orderBy: [{ date: 'asc' as const }, { id: 'asc' as const }] } };
const toPaymentView = (p: DebtPayment): PaymentView => ({ ...p, date: isoDate(p.date) });

async function findDebt(id: number, db: Prisma.TransactionClient = prisma) {
  const row = await db.debt.findUnique({ where: { id }, include: withPayments });
  if (!row) throw notFound();
  return row;
}

/** Recomputes paid/done from the opening balance plus the ledger. */
async function syncPaid(db: Prisma.TransactionClient, id: number) {
  const debt = await findDebt(id, db);
  const principal = debt.payments.reduce((s, p) => s + p.principal, 0);
  const paid = Math.min(debt.original, debt.openingPaid + principal);
  return db.debt.update({ where: { id }, data: { paid, done: paid >= debt.original }, include: withPayments });
}

export async function listDebts(status?: string): Promise<DebtView[]> {
  const where = status === 'active' ? { done: false } : status === 'paid' ? { done: true } : {};
  const rows = await prisma.debt.findMany({ where, orderBy: [{ done: 'asc' }, { sort: 'asc' }], include: withPayments });
  const now = today();
  return rows.map((d) => toDebtView(d, now));
}

export async function listActiveDebtViews(): Promise<DebtView[]> {
  return listDebts('active');
}

export async function getDebt(id: number): Promise<DebtView> {
  return toDebtView(await findDebt(id), today());
}

export async function getDebtSchedule(id: number): Promise<ScheduleView> {
  return buildSchedule(await findDebt(id), today());
}

export async function getDebtDetail(id: number): Promise<DebtDetail> {
  const debt = await findDebt(id);
  return { ...buildSchedule(debt, today()), payments: [...debt.payments].reverse().map(toPaymentView) };
}

export async function listPayments(debtId: number): Promise<PaymentView[]> {
  return (await getDebtDetail(debtId)).payments;
}

export async function recordPayment(debtId: number, body: unknown): Promise<{ payment: PaymentView; debt: DebtView; excess: number }> {
  const input = parseBody(paymentSchema, body);
  let date = today();
  if (input.date !== undefined) {
    const parsed = parseFlexDate(input.date);
    if (!parsed) throw badRequest(`invalid date: ${input.date}`);
    date = parsed;
  }
  return prisma.$transaction(async (tx) => {
    const debt = await findDebt(debtId, tx);
    if (debt.done) throw new HttpError(409, 'this debt is already paid off');
    const { excess, ...split } = splitPayment(debt, debt.payments, input.amount, date);
    const applied = split.fee + split.interest + split.principal;
    const created = await tx.debtPayment.create({ data: { debtId, date, amount: applied, ...split, note: input.note ?? '' } });
    const saved = await syncPaid(tx, debtId);
    return { payment: toPaymentView(created), debt: toDebtView(saved, today()), excess };
  });
}

export async function deletePayment(debtId: number, paymentId: number): Promise<DebtView> {
  return prisma.$transaction(async (tx) => {
    const found = await tx.debtPayment.findFirst({ where: { id: paymentId, debtId } });
    if (!found) throw notFound();
    await tx.debtPayment.delete({ where: { id: paymentId } });
    return toDebtView(await syncPaid(tx, debtId), today());
  });
}

export async function createDebt(body: unknown): Promise<DebtView> {
  const input = parseBody(debtFields, body);
  const openingPaid = input.openingPaid ?? 0;
  if (openingPaid > input.original) throw badRequest('openingPaid cannot exceed original');
  const row = await prisma.debt.create({ data: { ...input, paid: openingPaid, done: openingPaid >= input.original }, include: withPayments });
  return toDebtView(row, today());
}

export async function updateDebt(id: number, body: unknown): Promise<DebtView> {
  const input = parseBody(debtFields.partial(), body);
  return prisma.$transaction(async (tx) => {
    const current = await findDebt(id, tx);
    const original = input.original ?? current.original;
    const openingPaid = input.openingPaid ?? current.openingPaid;
    if (openingPaid > original) throw badRequest('openingPaid cannot exceed original');
    await tx.debt.update({ where: { id }, data: input });
    return toDebtView(await syncPaid(tx, id), today());
  });
}

export async function deleteDebt(id: number): Promise<void> {
  await prisma.debt.delete({ where: { id } });
}
```

- [ ] **Step 7: Payments routes; remove `/pay`; keep the UI compiling**

```bash
git rm -q 'src/app/api/v1/debts/[id]/pay/route.ts'
```

`src/app/api/v1/debts/[id]/payments/route.ts`:

```ts
import { created, list, parseId, readJson, route } from '@/server/http';
import { listPayments, recordPayment } from '@/server/debt/service';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => list(await listPayments(parseId((await ctx.params).id))));

export const POST = route(async (req: Request, ctx: Ctx) => created(await recordPayment(parseId((await ctx.params).id), await readJson(req))));
```

`src/app/api/v1/debts/[id]/payments/[paymentId]/route.ts`:

```ts
import { ok, parseId, route } from '@/server/http';
import { deletePayment } from '@/server/debt/service';

type Ctx = { params: Promise<{ id: string; paymentId: string }> };

/** Returns the recomputed debt so the client can show the reopened balance. */
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { id, paymentId } = await ctx.params;
  return ok(await deletePayment(parseId(id), parseId(paymentId)));
});
```

Update `src/app/(app)/debts/[id]/pay-button.tsx` so it records a payment of the amount due (Task 7 replaces it with a dialog):
- change the props to `{ id: number; amount: number; disabled?: boolean }`;
- change the call to `await apiFetch(`/debts/${id}/payments`, { method: 'POST', body: { amount } });`;
- in `src/app/(app)/debts/[id]/page.tsx`, render `<PayDebtButton id={d.id} amount={Math.max(1, d.installment)} disabled={d.done} />`.

In `src/app/(app)/setup/page.tsx` `DebtRows`, change `${fmt(d.monthly)}` to `${fmt(d.installment)}`, so EasyCash (`monthly` 0) shows its computed instalment.

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 8: Update the port's API tests and add ledger tests**

`tests/api/db.test.ts`: in the expected table list, insert `'debt_payments'` between `'day_spends'` and `'debts'`, and `'settings'` between `'plan_items'` and `'setup_goal_channels'`.

`tests/api/seed.test.ts`:
- change `debts: 14` to `debts: 16`;
- add `debtPayments: await prisma.debtPayment.count(),` / `debtPayments: 6,` and `settings: await prisma.setting.count(),` / `settings: 1,` to the two objects;
- add this test:

```ts
  it('keeps paid = openingPaid + ledger principal for every debt', async () => {
    const debts = await prisma.debt.findMany({ include: { payments: true } });
    for (const d of debts) {
      expect(d.paid, d.name).toBe(d.openingPaid + d.payments.reduce((s, p) => s + p.principal, 0));
    }
  });
```

`tests/api/debts.test.ts`:
- delete the whole `describe('POST /api/v1/debts/:id/pay', …)` block and the `import { POST as pay } …` line;
- in `GET /api/v1/debts`, change the expectations to active `7`, paid `9`, all `16`;
- in the create test, expect `id: 17`;
- add this test inside `describe('debt create / update / delete')`:

```ts
  it('starts paid at openingPaid and rejects openingPaid above original', async () => {
    const ok = await call(collection.POST, { method: 'POST', body: { name: 'Bank', original: 1000, openingPaid: 400, kind: 'bankloan', dueDay: 31 } });
    expect(ok.json).toMatchObject({ paid: 400, remaining: 600, kind: 'bankloan', dueDay: 31 });
    expect((await call(collection.POST, { method: 'POST', body: { name: 'X', original: 100, openingPaid: 101 } })).status).toBe(400);
    expect((await call(collection.POST, { method: 'POST', body: { name: 'X', original: 100, kind: 'loan-shark' } })).status).toBe(400);
  });
```

`tests/api/aggregates.test.ts`, with the new expected numbers (the Shopee demo debts add 18,749 of liabilities):
- dashboard: `netWorth: 106783`, `totalLiab: 257147`; debt `{ original: 313743, paid: 56596, remaining: 257147 }`; focus stays `{ id: 3 }`;
- net worth: `netWorth: 106783`; liabilities order `[1, 2, 16, 3, 4, 15, 5]`;
- setup: closing `[1, 2, 4, 16]`, revolving `[3, 5, 15]`.

Create `tests/api/debt-payments.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as payments from '@/app/api/v1/debts/[id]/payments/route';
import { DELETE as removePayment } from '@/app/api/v1/debts/[id]/payments/[paymentId]/route';
import { GET as getDebt } from '@/app/api/v1/debts/[id]/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

const post = (id: string, body: unknown) => call(payments.POST, { method: 'POST', params: { id }, body });

describe('debt views expose terms and due state', () => {
  it('EasyCash is overdue with a late fee; SPayLater is paid this cycle', async () => {
    expect((await call(getDebt, { params: { id: '16' } })).json).toMatchObject({
      installment: 1967, remaining: 14999, monthsLeft: 9, payoff: 'Mar 2027',
      due: { state: 'overdue', daysLate: 13, lateFee: 100, amountDue: 1967 },
    });
    expect((await call(getDebt, { params: { id: '15' } })).json.due).toMatchObject({ state: 'paid', dueDate: '2026-07-01' });
  });
});

describe('POST /api/v1/debts/:id/payments', () => {
  it('splits fee → interest → principal and clears the overdue state', async () => {
    const { status, json } = await post('16', { amount: 2067 });
    expect(status).toBe(201);
    expect(json.payment).toMatchObject({ id: 7, date: '2026-06-18', amount: 2067, fee: 100, interest: 300, principal: 1667 });
    expect(json.debt).toMatchObject({ paid: 6668, due: { state: 'paid', dueDate: '2026-07-05' } });
    expect(json.excess).toBe(0);
  });
  it('closes the debt on overpayment and reports the excess', async () => {
    const { json } = await post('15', { amount: 5000, note: 'Pay off' });
    expect(json.payment).toMatchObject({ amount: 3750, principal: 3750 });
    expect(json.debt).toMatchObject({ paid: 7500, remaining: 0, done: true, due: { state: 'closed' } });
    expect(json.excess).toBe(1250);
  });
  it('accepts a back-dated payment', async () => {
    expect((await post('16', { amount: 1967, date: '2026-06-05' })).json.payment).toMatchObject({ date: '2026-06-05', fee: 0 });
  });
  it('rejects bad input and closed debts', async () => {
    expect((await post('16', { amount: 0 })).status).toBe(400);
    expect((await post('16', { amount: 100, date: '2026-02-30' })).status).toBe(400);
    expect((await post('16', '')).status).toBe(400);
    expect((await post('6', { amount: 100 })).status).toBe(409);
    expect((await post('9999', { amount: 100 })).status).toBe(404);
  });
});

describe('payment history', () => {
  it('lists newest first', async () => {
    const { json } = await call(payments.GET, { params: { id: '16' } });
    expect(json.data.map((p: { date: string }) => p.date)).toEqual(['2026-05-05', '2026-04-05', '2026-03-05']);
  });
  it('deleting a payment recomputes the balance and reopens a closed debt', async () => {
    const paidOff = await post('15', { amount: 3750 });
    expect(paidOff.json.debt.done).toBe(true);
    const { status, json } = await call(removePayment, { method: 'DELETE', params: { id: '15', paymentId: String(paidOff.json.payment.id) } });
    expect(status).toBe(200);
    expect(json).toMatchObject({ paid: 3750, done: false, remaining: 3750 });
  });
  it("404s a payment that belongs to another debt", async () => {
    expect((await call(removePayment, { method: 'DELETE', params: { id: '16', paymentId: '1' } })).status).toBe(404);
  });
});
```

- [ ] **Step 9: Migrate, reseed and run everything**

```bash
pnpm test
pnpm typecheck && pnpm build
pnpm db:seed
```

Expected: unit + API tests PASS (the API harness runs `migrate deploy` on the test DB first), build succeeds, dev DB reseeded.

- [ ] **Step 10: Commit**

```bash
git add cashflowkub
git commit -m "feat(debt): payment ledger, due cycles and derived payoff on every debt"
```

---

### Task 6: Strategy, DSR and settings API

**Files:**
- Create: `src/server/settings/service.ts`, `src/server/debt/planning.ts`
- Create: `src/app/api/v1/settings/route.ts`, `src/app/api/v1/debts/strategy/route.ts`, `src/app/api/v1/debts/dsr/route.ts`
- Test: `tests/api/debt-planning.test.ts`

**Interfaces:**
- Consumes: `comparePayoff`, `SimDebt` (Task 3); `buildSmartPlan`, `computeDsr` (Task 4); `listActiveDebtViews` (Task 5); `parseStrategy` (port).
- Produces:
  - `interface AppSettings { monthlyIncome: number }`, `getSettings(): Promise<AppSettings>`, `updateSettings(body: unknown): Promise<AppSettings>`, `getMonthlyIncome(): Promise<number>` (setting, else the latest `MonthlyCashflow.income`, else 0) from `@/server/settings/service`.
  - `parsePlanningParams(params: URLSearchParams): { strategy: Strategy; extra: number; target: number }` (400 on bad input; defaults avalanche / 0 / 0.4), `toSimDebt(d: DebtView): SimDebt`, `getPayoffComparison(strategy, extra): Promise<PayoffComparison>`, `getSmartPlan(target?): Promise<SmartPlan>`, `getDsr(): Promise<DsrResult>` from `@/server/debt/planning`.
  - REST: `GET/PUT /api/v1/settings`, `GET /api/v1/debts/strategy?strategy=&extra=`, `GET /api/v1/debts/dsr?target=`.

- [ ] **Step 1: Write the failing test**

`tests/api/debt-planning.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as settings from '@/app/api/v1/settings/route';
import { GET as strategy } from '@/app/api/v1/debts/strategy/route';
import { GET as dsr } from '@/app/api/v1/debts/dsr/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('settings', () => {
  it('reads and updates monthly income', async () => {
    expect((await call(settings.GET)).json).toEqual({ monthlyIncome: 62000 });
    expect((await call(settings.PUT, { method: 'PUT', body: { monthlyIncome: 70000 } })).json).toEqual({ monthlyIncome: 70000 });
    expect((await call(settings.GET)).json).toEqual({ monthlyIncome: 70000 });
  });
  it('rejects negative or fractional income', async () => {
    expect((await call(settings.PUT, { method: 'PUT', body: { monthlyIncome: -1 } })).status).toBe(400);
    expect((await call(settings.PUT, { method: 'PUT', body: { monthlyIncome: 1.5 } })).status).toBe(400);
  });
});

describe('GET /api/v1/debts/dsr', () => {
  it('computes DSR and the smart plan for the demo data', async () => {
    const { json } = await call(dsr, { url: '/api/v1/debts/dsr' });
    expect(json.dsr).toMatchObject({ income: 62000, monthlyDebt: 14035, band: 'healthy' });
    expect(json.dsr.ratio).toBeCloseTo(0.2264, 4);
    expect(json.actions).toEqual([
      { key: 'payOverdue', debtId: 16, amount: 2067 },
      { key: 'focusHighestRate', debtId: 5 },
      { key: 'refinance', debtId: 2 },
    ]);
  });
  it('honours a stricter target', async () => {
    const { json } = await call(dsr, { url: '/api/v1/debts/dsr?target=0.2' });
    expect(json.monthlyCut).toBe(1635);
    expect(json.actions.map((a: { key: string }) => a.key)).toContain('cutDsr');
  });
  it('asks for income when it is zero, without Infinity', async () => {
    await call(settings.PUT, { method: 'PUT', body: { monthlyIncome: 0 } });
    const { status, json } = await call(dsr, { url: '/api/v1/debts/dsr' });
    expect(status).toBe(200);
    expect(json.dsr.ratio).toBeNull();
    expect(json.actions[0]).toEqual({ key: 'setIncome' });
  });
  it('400s a target outside (0, 1]', async () => {
    expect((await call(dsr, { url: '/api/v1/debts/dsr?target=0' })).status).toBe(400);
    expect((await call(dsr, { url: '/api/v1/debts/dsr?target=abc' })).status).toBe(400);
  });
});

describe('GET /api/v1/debts/strategy', () => {
  it('compares a strategy with extra money against minimums only', async () => {
    const { json } = await call(strategy, { url: '/api/v1/debts/strategy?strategy=avalanche&extra=2000' });
    expect(json.plan).toMatchObject({ strategy: 'avalanche', extra: 2000, neverPaysOff: false });
    expect(json.plan.order).toHaveLength(7);
    expect(json.plan.months).toBeLessThan(json.baseline.months);
    expect(json.interestSaved).toBeGreaterThan(0);
  });
  it('defaults to avalanche with no extra and 400s bad extra', async () => {
    expect((await call(strategy, { url: '/api/v1/debts/strategy' })).json.plan).toMatchObject({ strategy: 'avalanche', extra: 0 });
    expect((await call(strategy, { url: '/api/v1/debts/strategy?extra=-5' })).status).toBe(400);
    expect((await call(strategy, { url: '/api/v1/debts/strategy?extra=lots' })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test:api tests/api/debt-planning.test.ts`
Expected: FAIL, route modules not found.

- [ ] **Step 3: Implement the services**

`src/server/settings/service.ts`:

```ts
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseBody } from '@/server/validate';

export interface AppSettings {
  monthlyIncome: number;
}

const settingsSchema = z.object({ monthlyIncome: z.number().int().nonnegative() });
const INCOME_KEY = 'monthlyIncome';

/** Configured income, else the latest month's actual income, else 0. */
export async function getMonthlyIncome(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: INCOME_KEY } });
  if (row) return Number(row.value) || 0;
  const latest = await prisma.monthlyCashflow.findFirst({ orderBy: { sort: 'desc' } });
  return latest?.income ?? 0;
}

export async function getSettings(): Promise<AppSettings> {
  return { monthlyIncome: await getMonthlyIncome() };
}

export async function updateSettings(body: unknown): Promise<AppSettings> {
  const { monthlyIncome } = parseBody(settingsSchema, body);
  await prisma.setting.upsert({ where: { key: INCOME_KEY }, create: { key: INCOME_KEY, value: String(monthlyIncome) }, update: { value: String(monthlyIncome) } });
  return { monthlyIncome };
}
```

`src/server/debt/planning.ts`:

```ts
// DB-backed debt planning: payoff comparison, DSR and smart plan.
import { badRequest } from '@/server/errors';
import { getMonthlyIncome } from '@/server/settings/service';
import type { DebtView } from '@/server/views';
import { buildSmartPlan, computeDsr, DSR_LIMITS, type DsrResult, type SmartPlan } from './dsr';
import { parseStrategy, type Strategy } from './logic';
import { listActiveDebtViews } from './service';
import { comparePayoff, type PayoffComparison, type SimDebt } from './strategy';

export function parsePlanningParams(params: URLSearchParams): { strategy: Strategy; extra: number; target: number } {
  const rawExtra = params.get('extra');
  const extra = rawExtra === null || rawExtra === '' ? 0 : Number(rawExtra);
  if (!Number.isInteger(extra) || extra < 0 || extra > 10_000_000) throw badRequest(`invalid extra: ${rawExtra}`);
  const rawTarget = params.get('target');
  const target = rawTarget === null || rawTarget === '' ? DSR_LIMITS.manageable : Number(rawTarget);
  if (!Number.isFinite(target) || target <= 0 || target > 1) throw badRequest(`invalid target: ${rawTarget} (expected 0 < target <= 1)`);
  return { strategy: parseStrategy(params.get('strategy') ?? undefined), extra, target };
}

export const toSimDebt = (d: DebtView): SimDebt => ({
  id: d.id, balance: d.remaining, apr: d.apr, calc: d.calc, original: d.original, minPayment: d.installment, sort: d.sort,
});

export async function getPayoffComparison(strategy: Strategy, extra: number): Promise<PayoffComparison> {
  return comparePayoff((await listActiveDebtViews()).map(toSimDebt), strategy, extra);
}

export async function getSmartPlan(target: number = DSR_LIMITS.manageable): Promise<SmartPlan> {
  const [debts, income] = await Promise.all([listActiveDebtViews(), getMonthlyIncome()]);
  return buildSmartPlan(debts, income, target);
}

export async function getDsr(): Promise<DsrResult> {
  const [debts, income] = await Promise.all([listActiveDebtViews(), getMonthlyIncome()]);
  return computeDsr(debts, income);
}
```

- [ ] **Step 4: Implement the routes**

`src/app/api/v1/settings/route.ts`:

```ts
import { ok, readJson, route } from '@/server/http';
import { getSettings, updateSettings } from '@/server/settings/service';

export const GET = route(async () => ok(await getSettings()));

export const PUT = route(async (req: Request) => ok(await updateSettings(await readJson(req))));
```

`src/app/api/v1/debts/strategy/route.ts`:

```ts
import { ok, route } from '@/server/http';
import { getPayoffComparison, parsePlanningParams } from '@/server/debt/planning';

export const GET = route(async (req: Request) => {
  const { strategy, extra } = parsePlanningParams(new URL(req.url).searchParams);
  return ok(await getPayoffComparison(strategy, extra));
});
```

`src/app/api/v1/debts/dsr/route.ts`:

```ts
import { ok, route } from '@/server/http';
import { getSmartPlan, parsePlanningParams } from '@/server/debt/planning';

export const GET = route(async (req: Request) => ok(await getSmartPlan(parsePlanningParams(new URL(req.url).searchParams).target)));
```

- [ ] **Step 5: Run tests**

Run: `pnpm test && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add cashflowkub
git commit -m "feat(debt): strategy, DSR smart plan and income settings api"
```

---

### Task 7: Debts UI — add debt, due badges, payment history

**Files:**
- Modify: `src/lib/i18n.ts` (debt-management strings), `src/components/cfk/icon.tsx` (new icons)
- Create: `src/app/(app)/debts/add-debt-dialog.tsx`, `src/app/(app)/debts/due-badge.tsx`, `src/app/(app)/debts/[id]/record-payment-dialog.tsx`, `src/app/(app)/debts/[id]/delete-payment-button.tsx`
- Replace: `src/app/(app)/debts/page.tsx`, `src/app/(app)/debts/[id]/page.tsx`
- Delete: `src/app/(app)/debts/[id]/pay-button.tsx`
- Modify: `tests/e2e/pages.test.ts`
- Test: `tests/unit/i18n.test.ts` (extend)

**Interfaces:**
- Consumes: `getDebtDetail`, `listDebts`, `DEBT_KINDS` (Task 5); `scheduledInstallment`, `toApr` (Task 1); REST `POST /debts`, `POST /debts/:id/payments`, `DELETE /debts/:id/payments/:paymentId`.
- Produces: `fill(template, vars)` and `pickLabel(map, key)` from `@/lib/i18n`; `<DueBadge due />`; `<AddDebtDialog />`; `<RecordPaymentDialog debtId defaultAmount />`; `<DeletePaymentButton debtId paymentId />`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/i18n.test.ts`:

```ts
import { fill, pickLabel } from '@/lib/i18n';

describe('i18n helpers', () => {
  it('fill replaces {placeholders}', () => {
    expect(fill('in {n} days', { n: 3 })).toBe('in 3 days');
    expect(fill(DICT.th.action.payOverdue, { debt: 'EasyCash', amount: '฿2,067' })).toContain('EasyCash');
  });
  it('pickLabel falls back to the raw key', () => {
    expect(pickLabel(DICT.en.debtKind, 'paylater')).toBe('PayLater');
    expect(pickLabel(DICT.th.debtKind, 'bankloan')).toBe('สินเชื่อธนาคาร');
    expect(pickLabel(DICT.en.debtKind, 'mystery')).toBe('mystery');
  });
});
```

Append to `PAGES` in `tests/e2e/pages.test.ts`:

```ts
  ['/debts/16', 'Payment history', 'ประวัติการชำระ'],
  ['/debts/16?tab=schedule', 'Total interest', 'ดอกเบี้ยรวม'],
```

Run: `pnpm test:unit tests/unit/i18n.test.ts`
Expected: FAIL (`fill` is not exported).

- [ ] **Step 2: Add the strings and helpers**

In `src/lib/i18n.ts`, add to **`en`** (after the keys added in the port):

```ts
  debtKind: { paylater: 'PayLater', cashloan: 'Cash loan', bankloan: 'Bank loan', creditcard: 'Credit card', personal: 'Personal' },
  dueState: { closed: 'Closed', paid: 'Paid this cycle', upcoming: 'Upcoming', dueSoon: 'Due soon', dueToday: 'Due today', overdue: 'Overdue' },
  dsrBand: { healthy: 'Healthy', manageable: 'Manageable', high: 'High', critical: 'Critical' },
  action: {
    setIncome: 'Set your monthly income to calculate DSR.',
    payOverdue: 'Pay {debt} now: {amount} including the late fee.',
    cutDsr: 'Reduce monthly debt payments by {amount} to reach your DSR target.',
    quickWin: 'Close {debt} ({amount}) to free its instalment every month.',
    focusHighestRate: 'Put any extra money into {debt}: it has the highest interest rate.',
    refinance: 'Consider refinancing {debt}: the rate is 25%+ on a large balance.',
    noNewDebt: 'Avoid new debt until your DSR is below 40%.',
    debtFree: 'No active debt. Keep it up!',
  },
  lender: 'Lender', debtName: 'Name', alreadyPaid: 'Already repaid', rate: 'Interest rate', perMonthRate: '% / month',
  perYearRate: '% / year', termMonthsLbl: 'Term (months)', fixedPaymentLbl: 'Fixed instalment from statement',
  fixedPaymentHint: 'Leave 0 to calculate it from rate and term', minPaymentLbl: 'Minimum payment', dueDayLbl: 'Due day of month',
  graceDaysLbl: 'Grace days', lateFeeLbl: 'Late fee (฿)', penaltyAprLbl: 'Penalty interest (% / year)', revolvingLbl: 'Revolving credit line',
  instalmentPreview: 'Monthly instalment', recordPayment: 'Record payment', paymentHistory: 'Payment history',
  noPayments: 'No payments recorded yet', fee: 'Fee', excessReturned: 'Paid off! {amount} more than owed was not applied.',
  nextDue: 'Next due', daysLateN: '{n} days late', lateFeeAccrued: 'Late fee accrued', smartPlan: 'Smart plan',
  neverPaysOff: 'The instalment does not cover the interest, so this debt will never be paid off. Pay more each month.',
  dsrTitle: 'Debt service ratio (DSR)', dsrSub: 'Monthly debt payments ÷ monthly income', monthlyIncome: 'Monthly income',
  monthlyDebtPay: 'Debt payments / month', editIncome: 'Edit income', targetDsr: 'Target DSR', actionsTitle: 'Recommended actions',
  quickWins: 'Quick wins', dsrAfter: 'DSR after', simulator: 'Payoff simulator', extraPerMonth: 'Extra per month (฿)',
  simulate: 'Simulate', debtFreeIn: 'Debt-free in', monthsUnit: 'months', interestSaved: 'Interest saved', monthsSaved: 'Months saved',
  minimumOnly: 'Minimums only', withPlan: 'With this plan', payoffOrder: 'Payoff order', monthN: 'month {n}',
  setIncomeFirst: 'Set your monthly income to see your DSR.',
```

and to **`th`**:

```ts
  debtKind: { paylater: 'เพย์เลเตอร์', cashloan: 'สินเชื่อเงินสด', bankloan: 'สินเชื่อธนาคาร', creditcard: 'บัตรเครดิต', personal: 'ส่วนบุคคล' },
  dueState: { closed: 'ปิดแล้ว', paid: 'ชำระงวดนี้แล้ว', upcoming: 'รอชำระ', dueSoon: 'ใกล้ครบกำหนด', dueToday: 'ครบกำหนดวันนี้', overdue: 'เลยกำหนด' },
  dsrBand: { healthy: 'ดี', manageable: 'พอรับได้', high: 'สูง', critical: 'วิกฤต' },
  action: {
    setIncome: 'ตั้งค่ารายได้ต่อเดือนเพื่อคำนวณ DSR',
    payOverdue: 'ชำระ {debt} ทันที {amount} (รวมค่าปรับ)',
    cutDsr: 'ลดค่างวดหนี้ต่อเดือนลง {amount} เพื่อให้ถึงเป้าหมาย DSR',
    quickWin: 'ปิด {debt} ({amount}) เพื่อลดภาระค่างวดทุกเดือน',
    focusHighestRate: 'มีเงินเหลือให้โปะ {debt} ก่อน เพราะดอกเบี้ยสูงสุด',
    refinance: 'พิจารณารีไฟแนนซ์ {debt} ดอกเบี้ย 25% ขึ้นไปและยอดคงเหลือสูง',
    noNewDebt: 'หลีกเลี่ยงการก่อหนี้ใหม่จนกว่า DSR จะต่ำกว่า 40%',
    debtFree: 'ไม่มีหนี้คงค้าง เยี่ยมมาก!',
  },
  lender: 'ผู้ให้กู้', debtName: 'ชื่อหนี้', alreadyPaid: 'ชำระเงินต้นไปแล้ว', rate: 'อัตราดอกเบี้ย', perMonthRate: '% ต่อเดือน',
  perYearRate: '% ต่อปี', termMonthsLbl: 'จำนวนงวด (เดือน)', fixedPaymentLbl: 'ค่างวดคงที่ตามใบแจ้งหนี้',
  fixedPaymentHint: 'ใส่ 0 เพื่อคำนวณจากดอกเบี้ยและจำนวนงวด', minPaymentLbl: 'ยอดชำระขั้นต่ำ', dueDayLbl: 'วันครบกำหนดชำระ (วันที่)',
  graceDaysLbl: 'ผ่อนผัน (วัน)', lateFeeLbl: 'ค่าปรับล่าช้า (บาท)', penaltyAprLbl: 'ดอกเบี้ยผิดนัด (% ต่อปี)', revolvingLbl: 'วงเงินหมุนเวียน',
  instalmentPreview: 'ค่างวดต่อเดือน', recordPayment: 'บันทึกการชำระ', paymentHistory: 'ประวัติการชำระ',
  noPayments: 'ยังไม่มีการบันทึกการชำระ', fee: 'ค่าปรับ', excessReturned: 'ปิดหนี้แล้ว! ส่วนเกิน {amount} ไม่ได้นำไปหักหนี้',
  nextDue: 'ครบกำหนดถัดไป', daysLateN: 'เลยกำหนด {n} วัน', lateFeeAccrued: 'ค่าปรับสะสม', smartPlan: 'แผนจัดการหนี้',
  neverPaysOff: 'ค่างวดไม่พอจ่ายดอกเบี้ย หนี้นี้จะไม่มีวันหมด ควรเพิ่มยอดชำระต่อเดือน',
  dsrTitle: 'ภาระหนี้ต่อรายได้ (DSR)', dsrSub: 'ค่างวดหนี้ต่อเดือน ÷ รายได้ต่อเดือน', monthlyIncome: 'รายได้ต่อเดือน',
  monthlyDebtPay: 'ค่างวดหนี้ต่อเดือน', editIncome: 'แก้ไขรายได้', targetDsr: 'เป้าหมาย DSR', actionsTitle: 'สิ่งที่ควรทำ',
  quickWins: 'ปิดง่าย ได้ผลไว', dsrAfter: 'DSR หลังปิด', simulator: 'จำลองการปลดหนี้', extraPerMonth: 'โปะเพิ่มต่อเดือน (บาท)',
  simulate: 'จำลอง', debtFreeIn: 'ปลดหนี้ภายใน', monthsUnit: 'เดือน', interestSaved: 'ประหยัดดอกเบี้ย', monthsSaved: 'เร็วขึ้น (เดือน)',
  minimumOnly: 'จ่ายขั้นต่ำอย่างเดียว', withPlan: 'ตามแผนนี้', payoffOrder: 'ลำดับการปิดหนี้', monthN: 'เดือนที่ {n}',
  setIncomeFirst: 'ตั้งค่ารายได้ต่อเดือนเพื่อดู DSR',
```

Below `localized`, add:

```ts
/** Replaces {name} placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Label for a data value (e.g. a debt kind), falling back to the raw value. */
export function pickLabel(map: Record<string, string>, key: string): string {
  return Object.hasOwn(map, key) ? map[key] : key;
}
```

In `src/components/cfk/icon.tsx`, import `HandCoins`, `Gauge`, `History`, `Lightbulb` and add `'hand-coins': HandCoins, gauge: Gauge, history: History, lightbulb: Lightbulb` to `ICONS`.

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 3: Due badge**

`src/app/(app)/debts/due-badge.tsx`:

```tsx
'use client';

import { ToneBadge, type Tone } from '@/components/cfk/tone-badge';
import { useI18n } from '@/components/i18n-provider';
import { fill } from '@/lib/i18n';
import type { DueState, DueStatus } from '@/server/debt/cycle';

const TONE: Record<DueState, Tone> = { closed: 'neutral', paid: 'success', upcoming: 'neutral', dueSoon: 'warning', dueToday: 'warning', overdue: 'danger' };

export function DueBadge({ due }: { due: DueStatus }) {
  const { ui } = useI18n();
  const label =
    due.state === 'overdue' ? fill(ui.daysLateN, { n: due.daysLate })
    : due.state === 'upcoming' || due.state === 'dueSoon' ? fill(ui.daysUntil, { n: due.daysUntil })
    : ui.dueState[due.state];
  return <ToneBadge label={label} tone={TONE[due.state]} />;
}
```

- [ ] **Step 4: Add-debt dialog**

`src/app/(app)/debts/add-debt-dialog.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { fmt } from '@/lib/format';
import { scheduledInstallment, toApr } from '@/server/debt/terms';

const KINDS = ['paylater', 'cashloan', 'bankloan', 'creditcard', 'personal'] as const;
type Kind = (typeof KINDS)[number];
type RateUnit = 'month' | 'year';

// Sensible defaults per product type; every field stays editable.
const PRESETS: Record<Kind, { icon: string; tint: string; calc: 'flat' | 'reducing'; unit: RateUnit; revolving: boolean; lender: string }> = {
  paylater: { icon: 'shopping-bag', tint: 'image', calc: 'flat', unit: 'month', revolving: true, lender: 'Shopee' },
  cashloan: { icon: 'hand-coins', tint: 'folder', calc: 'flat', unit: 'month', revolving: false, lender: 'Shopee' },
  bankloan: { icon: 'landmark', tint: 'doc', calc: 'reducing', unit: 'year', revolving: false, lender: '' },
  creditcard: { icon: 'credit-card', tint: 'pdf', calc: 'reducing', unit: 'year', revolving: true, lender: '' },
  personal: { icon: 'wallet', tint: 'xls', calc: 'flat', unit: 'year', revolving: false, lender: '' },
};

const TEXT_FIELDS = ['name', 'th', 'lender', 'original', 'openingPaid', 'rate', 'termMonths', 'fixedPayment', 'monthly', 'dueDay', 'graceDays', 'lateFee', 'penaltyApr'] as const;
type TextField = (typeof TEXT_FIELDS)[number];

const int = (v: string): number => Math.max(0, Math.round(Number(v) || 0));
const num = (v: string): number => Math.max(0, Number(v) || 0);

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AddDebtDialog() {
  const { ui } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<Kind>('paylater');
  const [unit, setUnit] = useState<RateUnit>('month');
  const [calc, setCalc] = useState<'flat' | 'reducing'>('flat');
  const [revolving, setRevolving] = useState(true);
  const [f, setF] = useState<Record<TextField, string>>({
    name: '', th: '', lender: 'Shopee', original: '', openingPaid: '0', rate: '0', termMonths: '0',
    fixedPayment: '0', monthly: '0', dueDay: '1', graceDays: '0', lateFee: '0', penaltyApr: '0',
  });

  const chooseKind = (k: Kind) => {
    const p = PRESETS[k];
    setKind(k);
    setCalc(p.calc);
    setUnit(p.unit);
    setRevolving(p.revolving);
    setF((prev) => ({ ...prev, lender: prev.lender || p.lender }));
  };

  const terms = {
    original: int(f.original), paid: int(f.openingPaid), apr: toApr(num(f.rate), unit), calc,
    monthly: int(f.monthly), fixedPayment: int(f.fixedPayment), termMonths: int(f.termMonths),
  };
  const preview = terms.original > 0 ? scheduledInstallment(terms) : 0;
  const valid = f.name.trim() !== '' && terms.original > 0 && terms.paid <= terms.original && int(f.dueDay) >= 1 && int(f.dueDay) <= 31;

  const save = () =>
    startTransition(async () => {
      try {
        const p = PRESETS[kind];
        await apiFetch('/debts', {
          method: 'POST',
          body: {
            name: f.name.trim(), th: f.th.trim() || f.name.trim(), kind, lender: f.lender.trim(), icon: p.icon, tint: p.tint,
            original: terms.original, openingPaid: terms.paid, apr: terms.apr, calc, termMonths: terms.termMonths,
            fixedPayment: terms.fixedPayment, monthly: terms.monthly, dueDay: int(f.dueDay), graceDays: int(f.graceDays),
            lateFee: int(f.lateFee), penaltyApr: num(f.penaltyApr), revolving,
          },
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });

  const input = (id: TextField, type: 'text' | 'number' = 'number') => (
    <Input id={`debt-${id}`} type={type} inputMode={type === 'number' ? 'decimal' : undefined} min={0}
      value={f[id]} onChange={(e) => setF((prev) => ({ ...prev, [id]: e.target.value }))} />
  );

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} />
        {ui.addDebt}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{ui.addDebt}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Button key={k} type="button" size="sm" variant={k === kind ? 'default' : 'outline'} onClick={() => chooseKind(k)}>
                {ui.debtKind[k]}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="debt-name" label={ui.debtName}>{input('name', 'text')}</Field>
            <Field id="debt-th" label={`${ui.debtName} (ไทย)`}>{input('th', 'text')}</Field>
            <Field id="debt-lender" label={ui.lender}>{input('lender', 'text')}</Field>
            <Field id="debt-original" label={`${ui.originalDebt} (฿)`}>{input('original')}</Field>
            <Field id="debt-openingPaid" label={`${ui.alreadyPaid} (฿)`}>{input('openingPaid')}</Field>
            <Field id="debt-rate" label={ui.rate}>
              <div className="flex gap-2">
                {input('rate')}
                <select aria-label={ui.rate} value={unit} onChange={(e) => setUnit(e.target.value === 'year' ? 'year' : 'month')} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
                  <option value="month">{ui.perMonthRate}</option>
                  <option value="year">{ui.perYearRate}</option>
                </select>
              </div>
            </Field>
            <Field id="debt-calc" label={ui.calcMethod}>
              <select id="debt-calc" value={calc} onChange={(e) => setCalc(e.target.value === 'reducing' ? 'reducing' : 'flat')} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="flat">{ui.calcFlat}</option>
                <option value="reducing">{ui.calcReducing}</option>
              </select>
            </Field>
            <Field id="debt-termMonths" label={ui.termMonthsLbl}>{input('termMonths')}</Field>
            <Field id="debt-fixedPayment" label={`${ui.fixedPaymentLbl} (฿)`} hint={ui.fixedPaymentHint}>{input('fixedPayment')}</Field>
            <Field id="debt-monthly" label={`${ui.minPaymentLbl} (฿)`}>{input('monthly')}</Field>
            <Field id="debt-dueDay" label={ui.dueDayLbl}>{input('dueDay')}</Field>
            <Field id="debt-graceDays" label={ui.graceDaysLbl}>{input('graceDays')}</Field>
            <Field id="debt-lateFee" label={ui.lateFeeLbl}>{input('lateFee')}</Field>
            <Field id="debt-penaltyApr" label={ui.penaltyAprLbl}>{input('penaltyApr')}</Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={revolving} onChange={(e) => setRevolving(e.target.checked)} />
            {ui.revolvingLbl}
          </label>
          <div className="flex items-center justify-between rounded-xl bg-secondary p-3">
            <span className="text-sm text-muted-foreground">{ui.instalmentPreview}</span>
            <span className="text-lg font-extrabold tabular-nums">{fmt(preview)}</span>
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!valid || pending} onClick={save}>{ui.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 5: Payment dialog and delete button**

`src/app/(app)/debts/[id]/record-payment-dialog.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { today } from '@/lib/clock';
import { fill } from '@/lib/i18n';
import { fmt } from '@/lib/format';

export function RecordPaymentDialog({ debtId, defaultAmount, disabled }: { debtId: number; defaultAmount: number; disabled?: boolean }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [date, setDate] = useState(today().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();
  const value = Math.round(Number(amount));

  const save = () =>
    startTransition(async () => {
      try {
        const res = await apiFetch<{ excess: number }>(`/debts/${debtId}/payments`, { method: 'POST', body: { amount: value, date, note } });
        if (res.excess > 0) toast.success(fill(ui.excessReturned, { amount: fmt(res.excess) }));
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });

  return (
    <>
      <Button className="h-11 flex-1" disabled={disabled} onClick={() => { setAmount(String(defaultAmount)); setOpen(true); }}>
        <Icon name="arrow-down-left" size={16} />
        {ui.recordPayment}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ui.recordPayment}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-amount">{ui.amount} (฿)</Label>
            <Input id="pay-amount" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-bold tabular-nums" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-date">{ui.date}</Label>
            <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-note">{ui.note}</Label>
            <Input id="pay-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!(value > 0) || pending} onClick={save}>{ui.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

`src/app/(app)/debts/[id]/delete-payment-button.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';

export function DeletePaymentButton({ debtId, paymentId }: { debtId: number; paymentId: number }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={ui.delete}
      disabled={pending}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-40"
      onClick={() => {
        if (!window.confirm(`${ui.delete}?`)) return;
        startTransition(async () => {
          try {
            await apiFetch(`/debts/${debtId}/payments/${paymentId}`, { method: 'DELETE' });
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        });
      }}>
      <Icon name="trash-2" size={15} />
    </button>
  );
}
```

- [ ] **Step 6: Replace the debts pages**

`src/app/(app)/debts/page.tsx` keeps the port's hero, strategy card and paid-off card. Change the following:
- the imports;
- the title row (add the smart-plan link and the add-debt button);
- the active-debt rows (kind, instalment, due badge).

Full file:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Donut } from '@/components/cfk/charts';
import { Hero, HeroPill } from '@/components/cfk/hero';
import { Icon } from '@/components/cfk/icon';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { ToneBadge } from '@/components/cfk/tone-badge';
import { fmt } from '@/lib/format';
import { localized, pickLabel } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { parseStrategy, sortByStrategy } from '@/server/debt/logic';
import { listDebts } from '@/server/debt/service';
import { AddDebtDialog } from './add-debt-dialog';
import { DueBadge } from './due-badge';

export default async function DebtsPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const strategy = parseStrategy(firstParam(await searchParams, 'strategy'));
  const [active, paid] = await Promise.all([listDebts('active'), listDebts('paid')]);
  const totalRemaining = active.reduce((s, d) => s + d.remaining, 0);
  const totalOriginal = active.reduce((s, d) => s + d.original, 0);
  const monthlyTotal = active.reduce((s, d) => s + d.installment, 0);
  const progress = totalOriginal > 0 ? active.reduce((s, d) => s + d.paid, 0) / totalOriginal : 0;

  return (
    <>
      <PageTitle title={ui.nav.debts}>
        <Button asChild size="sm">
          <Link href="/debts/plan"><Icon name="lightbulb" size={16} />{ui.smartPlan}</Link>
        </Button>
        <AddDebtDialog />
      </PageTitle>

      <Hero>
        <div className="flex items-center gap-5">
          <Donut size={96} stroke={12} trackColor="rgb(255 255 255 / 0.18)" segments={[{ value: progress, color: 'var(--hero-fg)' }]} centerValue={`${Math.round(progress * 100)}%`} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{ui.totalDebt}</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums">{fmt(totalRemaining)}</p>
            <p className="text-sm opacity-75 tabular-nums">{ui.of} {fmt(totalOriginal)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <HeroPill><span className="tabular-nums">{active.length}</span> {ui.active}</HeroPill>
          <HeroPill><span className="tabular-nums">{paid.length}</span> {ui.paidOff}</HeroPill>
          <HeroPill>{ui.monthlyDebtPay} <span className="tabular-nums">{fmt(monthlyTotal)}</span></HeroPill>
        </div>
      </Hero>

      <Card className="gap-3 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.strategy}</p>
        <SegmentedLinks
          value={strategy}
          options={[{ key: 'avalanche', label: ui.avalanche }, { key: 'snowball', label: ui.snowball }, { key: 'custom', label: ui.custom }]}
          hrefFor={(k) => `/debts?strategy=${k}`}
        />
        <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{ui.strategyTip[strategy]}</p>
      </Card>

      <Card className="gap-1 px-5 py-3">
        <div className="flex justify-between py-2">
          <h2 className="font-bold">{ui.active}</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{active.length}</span>
        </div>
        {sortByStrategy(active, strategy).map((d) => (
          <ListRow
            key={d.id}
            icon={d.icon}
            tint={d.tint}
            title={localized(lang, d.name, d.th)}
            subtitle={`${pickLabel(ui.debtKind, d.kind)} · ${ui.apr} ${d.apr}% · ${fmt(d.installment)}${ui.perMonth}`}
            right={fmt(d.remaining)}
            rightSub={<DueBadge due={d.due} />}
            href={`/debts/${d.id}`}
            className="border-t"
          />
        ))}
      </Card>

      {paid.length > 0 ? (
        <Card className="gap-3 p-5">
          <h2 className="font-bold text-type-xls-fg">{ui.paidOff}</h2>
          {paid.map((d) => (
            <div key={d.id} className="flex items-center gap-3 opacity-70">
              <ToneBadge label="✓" tone="success" />
              <span className="flex-1 truncate text-sm font-semibold line-through">{localized(lang, d.name, d.th)}</span>
              <span className="text-sm font-bold tabular-nums">{fmt(d.original)}</span>
            </div>
          ))}
        </Card>
      ) : null}
    </>
  );
}
```

`Button asChild` comes from the Radix-based shadcn button chosen in the port. If the project's button has no `asChild`, use `<Link className={buttonVariants({ size: 'sm' })} href="/debts/plan">` instead.

`src/app/(app)/debts/[id]/page.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/cfk/icon';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { fmt, pct } from '@/lib/format';
import { localized, pickLabel } from '@/lib/i18n';
import { loadOr404 } from '@/lib/load-or-404';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { parseId } from '@/server/http';
import { getDebtDetail } from '@/server/debt/service';
import { DueBadge } from '../due-badge';
import { DeletePaymentButton } from './delete-payment-button';
import { RecordPaymentDialog } from './record-payment-dialog';

export default async function DebtDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const { id } = await params;
  const tab = firstParam(await searchParams, 'tab') === 'schedule' ? 'schedule' : 'overview';
  const { debt: d, schedule, totalInterest, payments } = await loadOr404(async () => getDebtDetail(parseId(id)));
  const method = d.calc === 'reducing' ? ui.calcReducing : ui.calcFlat;
  const due = d.due;
  const suggested = Math.max(1, due.state === 'paid' ? d.installment : due.amountDue - due.paidThisCycle + due.lateFee);

  return (
    <>
      <PageTitle title={localized(lang, d.name, d.th)} back="/debts" />
      <div className="flex items-center gap-3">
        <Tile icon={d.icon} tint={d.tint} size={48} />
        <div>
          <p className="text-sm font-semibold">{pickLabel(ui.debtKind, d.kind)}{d.lender ? ` · ${d.lender}` : ''}</p>
          <p className="text-sm text-muted-foreground">{ui.apr} {d.apr}% · {method}</p>
        </div>
      </div>

      <Card className="gap-3.5 bg-secondary p-5">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.balance}</p>
            <p className="text-3xl font-extrabold tabular-nums">{fmt(d.remaining)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{ui.of} {fmt(d.original)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.payoff}</p>
            <p className="text-lg font-bold">{localized(lang, d.payoff, d.payoffTh) || '—'}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{d.monthsLeft} {ui.monthsLeftLbl}</p>
          </div>
        </div>
        <Progress value={d.progress} />
        <div className="flex justify-between text-xs font-semibold text-muted-foreground tabular-nums">
          <span>{fmt(d.paid)} {ui.paidOff}</span>
          <span>{pct(d.progress)}</span>
        </div>
      </Card>

      {d.neverPaysOff ? (
        <Card className="flex-row items-start gap-3 border-destructive/40 bg-type-pdf-bg p-4 text-type-pdf-fg">
          <Icon name="triangle-alert" size={18} />
          <p className="text-sm font-medium">{ui.neverPaysOff}</p>
        </Card>
      ) : null}

      {!d.done ? (
        <Card className="gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.nextDue}</span>
            <DueBadge due={due} />
          </div>
          <div className="flex items-end justify-between">
            <span className="text-sm text-muted-foreground tabular-nums">{due.dueDate}</span>
            <span className="text-xl font-extrabold tabular-nums">{fmt(due.state === 'paid' ? d.installment : due.amountDue - due.paidThisCycle)}</span>
          </div>
          {due.lateFee > 0 ? (
            <div className="flex justify-between text-sm font-semibold text-destructive tabular-nums">
              <span>{ui.lateFeeAccrued}</span>
              <span>+{fmt(due.lateFee)}</span>
            </div>
          ) : null}
        </Card>
      ) : null}

      <SegmentedLinks value={tab} options={[{ key: 'overview', label: ui.overview }, { key: 'schedule', label: ui.schedule }]} hrefFor={(k) => `/debts/${d.id}?tab=${k}`} />

      {tab === 'overview' ? (
        <>
          <Card className="gap-0 bg-secondary p-0">
            {([
              [ui.instalmentPreview, fmt(d.installment)],
              [ui.calcMethod, method],
              [ui.dueDayLbl, String(d.dueDay)],
              [ui.lateFeeLbl, fmt(d.lateFee)],
              [ui.originalDebt, fmt(d.original)],
              [ui.totalInterest, fmt(d.totalInterestLeft)],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between border-b px-4 py-3 text-sm last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </Card>
          <div className="flex gap-2.5">
            <RecordPaymentDialog debtId={d.id} defaultAmount={suggested} disabled={d.done} />
          </div>
          <Card className="gap-0 px-5 py-3">
            <h2 className="flex items-center gap-2 py-2 font-bold"><Icon name="history" size={16} />{ui.paymentHistory}</h2>
            {payments.length === 0 ? <p className="border-t py-4 text-sm text-muted-foreground">{ui.noPayments}</p> : null}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-t py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tabular-nums">{p.date}</p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    {ui.principal} {fmt(p.principal)} · {ui.interest} {fmt(p.interest)}{p.fee ? ` · ${ui.fee} ${fmt(p.fee)}` : ''}{p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <span className="font-bold tabular-nums">{fmt(p.amount)}</span>
                <DeletePaymentButton debtId={d.id} paymentId={p.id} />
              </div>
            ))}
          </Card>
        </>
      ) : (
        <>
          <Card className="gap-0 overflow-x-auto bg-secondary p-0">
            <table className="w-full text-xs tabular-nums">
              <thead className="bg-background text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-2.5 text-left">#</th>
                  <th className="px-2 text-left">{ui.amount}</th>
                  <th className="px-2 text-left">{ui.principal}</th>
                  <th className="px-2 text-left">{ui.interest}</th>
                  <th className="px-3.5 text-right">{ui.remaining}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.slice(0, 24).map((r) => (
                  <tr key={r.month} className="border-t">
                    <td className="px-3.5 py-2.5 font-semibold text-muted-foreground">{r.month}</td>
                    <td className="px-2 font-semibold">{fmt(r.payment)}</td>
                    <td className="px-2">{fmt(r.principal)}</td>
                    <td className="px-2 text-destructive">{fmt(r.interest)}</td>
                    <td className="px-3.5 text-right font-semibold">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex justify-between px-1 text-sm">
            <span className="text-muted-foreground">{ui.totalInterest}</span>
            <span className="font-bold text-destructive tabular-nums">{fmt(totalInterest)}</span>
          </div>
        </>
      )}
    </>
  );
}
```

```bash
git rm -q 'src/app/(app)/debts/[id]/pay-button.tsx'
```

- [ ] **Step 7: Build and run all checks**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
pnpm db:seed
pnpm start &
pnpm test:e2e
kill %1
```

Expected: all PASS, including the existing `/debts`, `/debts/2` and `/debts?strategy=snowball` rows.

Then check by hand (`pnpm dev`):
1. On `/debts`, EasyCash shows "13 days late" and SPayLater shows "Paid this cycle".
2. Add a "Bank loan" of ฿100,000 at 12% per year over 12 months. The preview shows ฿8,885.
3. On EasyCash, record the suggested ฿2,067. The history shows fee 100, interest 300, principal 1,667, and the badge turns "Paid this cycle".
4. Delete that payment. The overdue badge comes back.
5. Pay ฿5,000 on SPayLater. A toast reports the ฿1,250 excess, and the debt moves to "Paid off".

Run `pnpm db:seed` afterwards.

- [ ] **Step 8: Commit**

```bash
git add cashflowkub
git commit -m "feat(debt): add-debt dialog, due badges and payment history UI"
```

---

### Task 8: Smart plan screen (DSR + simulator) and dashboard DSR

**Files:**
- Create: `src/app/(app)/debts/plan/page.tsx`, `src/app/(app)/debts/plan/income-dialog.tsx`
- Modify: `src/app/(app)/page.tsx` (DSR line on the debt card)
- Modify: `tests/e2e/pages.test.ts`

**Interfaces:**
- Consumes: `getSmartPlan`, `getPayoffComparison`, `parsePlanningParams`, `getDsr` (Task 6); `listActiveDebtViews` (Task 5); `PUT /api/v1/settings`; `fill`, `pickLabel` (Task 7).
- Produces: the `/debts/plan` page (reads `?strategy=&extra=&target=`) and `<IncomeDialog income />`.

- [ ] **Step 1: Add the failing e2e rows**

```ts
  ['/debts/plan', 'Debt service ratio', 'ภาระหนี้ต่อรายได้'],
  ['/debts/plan?strategy=snowball&extra=2000', 'Interest saved', 'ประหยัดดอกเบี้ย'],
  ['/debts/plan?extra=-5', 'Debt service ratio', 'ภาระหนี้ต่อรายได้'],
```

The last row checks that a bad query falls back to defaults instead of crashing the page.

- [ ] **Step 2: Income dialog**

`src/app/(app)/debts/plan/income-dialog.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';

export function IncomeDialog({ income }: { income: number }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(income));
  const [pending, startTransition] = useTransition();
  const n = Math.round(Number(value));

  const save = () =>
    startTransition(async () => {
      try {
        await apiFetch('/settings', { method: 'PUT', body: { monthlyIncome: n } });
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setValue(String(income)); setOpen(true); }}>
        <Icon name="pencil" size={15} />
        {ui.editIncome}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ui.monthlyIncome}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="income">{ui.monthlyIncome} (฿)</Label>
            <Input id="income" type="number" min={0} step={1} value={value} onChange={(e) => setValue(e.target.value)} className="text-lg font-bold tabular-nums" />
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!(n >= 0) || pending} onClick={save}>{ui.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 3: Smart plan page**

`src/app/(app)/debts/plan/page.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Donut } from '@/components/cfk/charts';
import { Icon } from '@/components/cfk/icon';
import { PageTitle } from '@/components/cfk/page-title';
import { ToneBadge, type Tone } from '@/components/cfk/tone-badge';
import { fmt, pct } from '@/lib/format';
import { fill, localized, type Dict, type Lang } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import type { SearchParamsRecord } from '@/lib/search-params';
import { cn } from '@/lib/utils';
import type { DsrBand, SmartAction } from '@/server/debt/dsr';
import { getPayoffComparison, getSmartPlan, parsePlanningParams } from '@/server/debt/planning';
import { listActiveDebtViews } from '@/server/debt/service';
import { HttpError } from '@/server/errors';
import type { DebtView } from '@/server/views';
import { IncomeDialog } from './income-dialog';

const BAND_TONE: Record<DsrBand, Tone> = { healthy: 'success', manageable: 'info', high: 'warning', critical: 'danger' };
const BAND_COLOR: Record<DsrBand, string> = {
  healthy: 'var(--type-xls-fg)', manageable: 'var(--type-doc-fg)', high: 'var(--type-folder-fg)', critical: 'var(--destructive)',
};

function toParams(sp: SearchParamsRecord): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') out.set(k, v);
  return out;
}

/** Invalid query values fall back to defaults instead of erroring the page. */
function safeParams(sp: SearchParamsRecord) {
  try {
    return parsePlanningParams(toParams(sp));
  } catch (err) {
    if (err instanceof HttpError) return parsePlanningParams(new URLSearchParams());
    throw err;
  }
}

function actionText(a: SmartAction, ui: Dict, lang: Lang, debts: Map<number, DebtView>): string {
  const d = a.debtId !== undefined ? debts.get(a.debtId) : undefined;
  return fill(ui.action[a.key], { debt: d ? localized(lang, d.name, d.th) : '', amount: fmt(a.amount ?? 0) });
}

export default async function SmartPlanPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const { ui, lang } = await getI18n();
  const { strategy, extra, target } = safeParams(await searchParams);
  const [plan, comparison, debts] = await Promise.all([getSmartPlan(target), getPayoffComparison(strategy, extra), listActiveDebtViews()]);
  const byId = new Map(debts.map((d) => [d.id, d]));
  const { dsr } = plan;

  return (
    <>
      <PageTitle title={ui.smartPlan} back="/debts" />

      <Card className="gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><Icon name="gauge" size={17} />{ui.dsrTitle}</h2>
            <p className="text-xs text-muted-foreground">{ui.dsrSub}</p>
          </div>
          <IncomeDialog income={dsr.income} />
        </div>
        {dsr.ratio === null || dsr.band === null ? (
          <p className="rounded-xl bg-secondary p-4 text-sm">{ui.setIncomeFirst}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-5">
            <Donut size={120} stroke={14} segments={[{ value: Math.min(1, dsr.ratio), color: BAND_COLOR[dsr.band] }]} centerValue={pct(dsr.ratio)} />
            <div className="grid flex-1 gap-2 text-sm">
              <ToneBadge label={ui.dsrBand[dsr.band]} tone={BAND_TONE[dsr.band]} className="w-fit" />
              <div className="flex justify-between"><span className="text-muted-foreground">{ui.monthlyIncome}</span><span className="font-semibold tabular-nums">{fmt(dsr.income)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{ui.monthlyDebtPay}</span><span className="font-semibold tabular-nums">{fmt(dsr.monthlyDebt)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{ui.targetDsr}</span><span className="font-semibold tabular-nums">{pct(plan.targetDsr)}</span></div>
            </div>
          </div>
        )}
      </Card>

      <Card className="gap-3 p-5">
        <h2 className="flex items-center gap-2 font-bold"><Icon name="lightbulb" size={17} />{ui.actionsTitle}</h2>
        <ol className="grid gap-2">
          {plan.actions.map((a, i) => (
            <li key={`${a.key}-${a.debtId ?? i}`} className={cn('rounded-xl p-3 text-sm', a.key === 'payOverdue' ? 'bg-type-pdf-bg text-type-pdf-fg' : 'bg-secondary')}>
              {actionText(a, ui, lang, byId)}
            </li>
          ))}
        </ol>
        {plan.quickWins.length > 0 && dsr.ratio !== null ? (
          <div className="grid gap-1.5 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.quickWins}</p>
            {plan.quickWins.map((q) => {
              const d = byId.get(q.id);
              return (
                <div key={q.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{d ? localized(lang, d.name, d.th) : q.id}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmt(q.remaining)} → {ui.dsrAfter} {q.dsrAfter === null ? '—' : pct(q.dsrAfter)}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      <Card className="gap-4 p-5">
        <h2 className="font-bold">{ui.simulator}</h2>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {ui.strategy}
            <select name="strategy" defaultValue={strategy} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground">
              <option value="avalanche">{ui.avalanche}</option>
              <option value="snowball">{ui.snowball}</option>
              <option value="custom">{ui.custom}</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {ui.extraPerMonth}
            <Input name="extra" type="number" min={0} step={100} defaultValue={extra} className="w-36" />
          </label>
          <input type="hidden" name="target" value={target} />
          <Button type="submit">{ui.simulate}</Button>
        </form>
        <div className="grid gap-3 sm:grid-cols-2">
          {([[ui.minimumOnly, comparison.baseline], [ui.withPlan, comparison.plan]] as const).map(([label, r]) => (
            <div key={label} className="rounded-xl bg-secondary p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-extrabold tabular-nums">{r.neverPaysOff ? '—' : `${r.months} ${ui.monthsUnit}`}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{ui.interest} {fmt(r.totalInterest)}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <div><p className="text-xs text-muted-foreground">{ui.interestSaved}</p><p className="font-bold text-type-xls-fg tabular-nums">{fmt(Math.max(0, comparison.interestSaved))}</p></div>
          <div><p className="text-xs text-muted-foreground">{ui.monthsSaved}</p><p className="font-bold text-type-xls-fg tabular-nums">{Math.max(0, comparison.monthsSaved)}</p></div>
        </div>
        <div className="grid gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.payoffOrder}</p>
          {comparison.plan.order.map((id, i) => {
            const d = byId.get(id);
            const month = comparison.plan.payoffMonth[id];
            return (
              <div key={id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate">{d ? localized(lang, d.name, d.th) : id}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{month ? fill(ui.monthN, { n: month }) : '—'}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
```

`/debts/plan` is a static segment, so it takes precedence over `/debts/[id]`.

- [ ] **Step 4: Show DSR on the dashboard**

In `src/app/(app)/page.tsx`:
- import `getDsr` from `@/server/debt/planning` and `pct` from `@/lib/format`;
- add `getDsr()` to the `Promise.all` (destructure it as `dsr`);
- inside the debts card, below the focus link, add:

```tsx
          <Link href="/debts/plan" className="flex items-center justify-between rounded-xl border p-3 text-sm hover:opacity-90">
            <span className="text-muted-foreground">{ui.dsrTitle}</span>
            <span className="font-bold tabular-nums">{dsr.ratio === null ? '—' : `${pct(dsr.ratio)} · ${ui.dsrBand[dsr.band ?? 'healthy']}`}</span>
          </Link>
```

Append to `PAGES` the dashboard check `['/', 'Debt service ratio', 'ภาระหนี้ต่อรายได้'],`.

- [ ] **Step 5: Build and run all checks**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
pnpm db:seed
pnpm start &
pnpm test:e2e
kill %1
```

Expected: all PASS.

Then check by hand:
1. `/debts/plan` shows DSR 23% "Healthy", with the actions "Pay Shopee EasyCash now: ฿2,067 …", "Put any extra money into Kbank Nano 2 …" and "Consider refinancing KrungThai Personal …".
2. Set income to 0. The DSR card asks for income and the first action is "Set your monthly income …".
3. Set income back to 62000.
4. Simulate snowball with ฿2,000 extra. "With this plan" is shorter than "Minimums only", and the payoff order lists 7 debts.

Run `pnpm db:seed` afterwards.

- [ ] **Step 6: Commit**

```bash
git add cashflowkub
git commit -m "feat(debt): smart plan screen with DSR, actions and payoff simulator"
```

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
  it('charges no fee exactly graceDays late, a fee one day after', () => {
    expect(dueStatus(terms({ dueDay: 10, lateFee: 100, graceDays: 8 }), [], TODAY)).toMatchObject({ daysLate: 8, lateFee: 0 });
    expect(dueStatus(terms({ dueDay: 10, lateFee: 100, graceDays: 7 }), [], TODAY)).toMatchObject({ daysLate: 8, lateFee: 100 });
  });
  it('ignores the time of day on today', () => {
    expect(dueStatus(terms({ dueDay: 20 }), [], new Date('2026-06-20T15:30:00Z'))).toMatchObject({ state: 'dueToday', daysUntil: 0, daysLate: 0 });
  });
});

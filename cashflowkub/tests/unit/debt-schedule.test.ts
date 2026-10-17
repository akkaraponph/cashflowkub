import { describe, expect, it } from 'vitest';
import { paymentForTarget, payoffLabel, projectSchedule } from '@/server/debt/schedule';
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

describe('sheet golden figures', () => {
  it('Krungthai 45,700 @25% reducing, 21 months', () => {
    const s = projectSchedule(terms({ original: 45700, apr: 25, calc: 'reducing', termMonths: 21 }));
    expect(s.rows).toHaveLength(21);
    expect(s.rows[0]).toMatchObject({ payment: 2709, principal: 1757, interest: 952, balance: 43943 });
    expect(s.totalInterest).toBe(11189);
  });
  it('KKB Nano 53,824 @33% flat, 36 months closes in exactly 36 rows', () => {
    const s = projectSchedule(terms({ original: 53824, apr: 33, calc: 'flat', termMonths: 36 }));
    expect(s.rows).toHaveLength(36);
    expect(s.rows.every((r) => r.interest === 1480)).toBe(true);
    expect(s.rows[0].payment).toBe(2976);
  });
  it('SPEC 28,663 @33% flat, 10 months', () => {
    expect(projectSchedule(terms({ original: 28663, apr: 33, calc: 'flat', termMonths: 10 })).rows).toHaveLength(10);
  });
  it('กยศ 186,150 @5% reducing, 96 months', () => {
    expect(projectSchedule(terms({ original: 186150, apr: 5, calc: 'reducing', termMonths: 96 })).rows).toHaveLength(96);
  });
});

describe('paymentForTarget', () => {
  it('reducing from scratch fits the target', () => {
    const d = terms({ original: 45700, apr: 25, calc: 'reducing' });
    const p = paymentForTarget(d, 21);
    expect(p).toBe(2710);
    expect(projectSchedule({ ...d, fixedPayment: p }).rows.length).toBeLessThanOrEqual(21);
  });
  it('reducing, partly paid, 12 months', () => {
    const d = terms({ original: 70000, paid: 24300, apr: 25, calc: 'reducing' });
    const p = paymentForTarget(d, 12);
    expect(p).toBeGreaterThan(2783);
    expect(projectSchedule({ ...d, fixedPayment: p }).rows.length).toBeLessThanOrEqual(12);
  });
  it('flat, partly paid', () => {
    expect(paymentForTarget(terms({ original: 20000, paid: 5000, apr: 18, calc: 'flat' }), 5)).toBe(3300);
  });
  it('zero rate', () => {
    expect(paymentForTarget(terms({ original: 1000 }), 3)).toBe(334);
  });
  it('closed debt needs nothing', () => {
    expect(paymentForTarget(terms({ original: 100, paid: 100 }), 3)).toBe(0);
  });
  it.each([0, -1, 1.5])('rejects months=%s', (m) => {
    expect(() => paymentForTarget(terms(), m)).toThrow(RangeError);
  });
});

describe('projectSchedule per-month overrides', () => {
  const d = terms({ original: 70000, paid: 24300, apr: 25, calc: 'reducing', monthly: 2783 });
  it('a bigger payment in one month cuts balance and shortens the schedule', () => {
    const s = projectSchedule(d, { 1: 5000 });
    expect(s.rows[0]).toEqual({ month: 1, payment: 5000, principal: 4048, interest: 952, balance: 41652 });
    expect(s.rows[1].payment).toBe(2783);
    expect(s.rows.length).toBeLessThan(projectSchedule(d).rows.length);
  });
  it('a zero payment capitalises the interest instead of aborting', () => {
    const s = projectSchedule(d, { 1: 0 });
    expect(s.rows[0]).toMatchObject({ payment: 0, principal: -952, balance: 46652 });
    expect(s.neverPaysOff).toBe(false);
  });
  it('an override above what is owed closes the debt that month', () => {
    const s = projectSchedule(d, { 1: 1_000_000 });
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({ payment: 46652, balance: 0 });
  });
  it('overrides past the end are ignored', () => {
    expect(projectSchedule(d, { 99: 10 })).toEqual(projectSchedule(d));
  });
});

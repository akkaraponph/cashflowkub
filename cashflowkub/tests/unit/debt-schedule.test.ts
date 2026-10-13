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

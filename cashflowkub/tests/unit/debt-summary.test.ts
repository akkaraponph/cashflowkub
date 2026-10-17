import { describe, expect, it } from 'vitest';
import { debtSummary, planVsActual } from '@/server/debt/summary';
import type { DebtTerms } from '@/server/debt/terms';

const terms = (o: Partial<DebtTerms> = {}): DebtTerms => ({ original: 10000, paid: 0, apr: 0, calc: 'reducing', monthly: 0, fixedPayment: 0, termMonths: 0, ...o });

describe('debtSummary', () => {
  it('weights the average rate by remaining balance', () => {
    const s = debtSummary([
      { remaining: 45700, original: 70000, paid: 24300, installment: 2709, apr: 25 },
      { remaining: 53824, original: 53824, paid: 0, installment: 2976, apr: 33 },
    ]);
    expect(s).toMatchObject({ count: 2, totalRemaining: 99524, totalPaid: 24300, totalOriginal: 123824, monthlyTotal: 5685 });
    expect(s.avgApr).toBeCloseTo((25 * 45700 + 33 * 53824) / 99524, 5);
    expect(s.avgMonthlyRate).toBeCloseTo(s.avgApr / 12, 5);
    expect(s.progress).toBeCloseTo(24300 / 123824, 5);
  });
  it('is all zeros with no debts', () => {
    expect(debtSummary([])).toEqual({ count: 0, totalRemaining: 0, totalOriginal: 0, totalPaid: 0, monthlyTotal: 0, progress: 0, avgApr: 0, avgMonthlyRate: 0 });
  });
});

describe('planVsActual', () => {
  const d = terms({ original: 45700, apr: 25, termMonths: 21 });
  it('untouched debt: remaining equals plan, actual is zero', () => {
    const r = planVsActual(d, []);
    expect(r.planned).toEqual({ months: 21, interest: 11189, principal: 45700, payment: 56889 });
    expect(r.actual).toEqual({ payment: 0, principal: 0, interest: 0, fees: 0 });
    expect(r.remaining).toEqual(r.planned);
  });
  it('after one payment', () => {
    const r = planVsActual({ ...d, paid: 1757 }, [{ amount: 2709, principal: 1757, interest: 952, fee: 0 }]);
    expect(r.actual).toEqual({ payment: 2709, principal: 1757, interest: 952, fees: 0 });
    expect(r.remaining?.principal).toBe(43943);
  });
  it('opening paid counts as principal-only payment', () => {
    const r = planVsActual({ ...d, paid: 1000 }, []);
    expect(r.actual).toEqual({ payment: 1000, principal: 1000, interest: 0, fees: 0 });
  });
  it('never-pays-off has no plan', () => {
    const r = planVsActual(terms({ original: 10000, apr: 60, monthly: 100 }), []);
    expect(r.planned).toBeNull();
    expect(r.remaining).toBeNull();
  });
});

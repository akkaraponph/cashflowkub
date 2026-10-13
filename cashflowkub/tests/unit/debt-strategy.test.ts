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
  it('throws RangeError on invalid inputs', () => {
    expect(() => simulatePayoff([sim({ balance: Number.NaN })], 'avalanche', 0)).toThrow(RangeError);
    expect(() => simulatePayoff([sim({})], 'avalanche', -1)).toThrow(RangeError);
    expect(() => simulatePayoff([sim({ minPayment: -1 })], 'avalanche', 0)).toThrow(RangeError);
    expect(() => simulatePayoff([sim({ sort: Number.NaN })], 'avalanche', 0)).toThrow(RangeError);
  });
  it('skips a debt with zero balance', () => {
    const r = simulatePayoff([sim({ balance: 0 }), sim({ id: 2 })], 'avalanche', 0);
    expect(r.order).toEqual([2]);
  });
  it('flags neverPaysOff when minimums do not cover interest', () => {
    const r = simulatePayoff([sim({ balance: 10000, original: 10000, apr: 120, minPayment: 100 })], 'snowball', 0);
    expect(r.neverPaysOff).toBe(true);
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
  it('flags baseline neverPaysOff while the plan pays off', () => {
    const d = [sim({ balance: 10000, original: 10000, apr: 60, minPayment: 400 })];
    const c = comparePayoff(d, 'avalanche', 2000);
    expect(c.baseline.neverPaysOff).toBe(true);
    expect(c.plan.neverPaysOff).toBe(false);
  });
  describe('minimums-only baseline is independent per debt', () => {
    const multi = [
      sim({ id: 1, balance: 250, original: 250, apr: 24, minPayment: 100, sort: 1 }),
      sim({ id: 2, balance: 1000, original: 1000, apr: 12, minPayment: 100, sort: 2 }),
      sim({ id: 3, balance: 730, original: 730, apr: 30, minPayment: 90, sort: 3 }),
    ];
    it('is identical for every strategy', () => {
      const [a, s, c] = (['avalanche', 'snowball', 'custom'] as const).map((st) => comparePayoff(multi, st, 0).baseline);
      expect([s.months, s.totalInterest]).toEqual([a.months, a.totalInterest]);
      expect([c.months, c.totalInterest]).toEqual([a.months, a.totalInterest]);
    });
    it('equals the sum of single-debt simulations', () => {
      const solo = multi.map((d) => simulatePayoff([d], 'custom', 0, { rollover: false }));
      const b = comparePayoff(multi, 'avalanche', 0).baseline;
      expect(b.months).toBe(Math.max(...solo.map((r) => r.months)));
      expect(b.totalInterest).toBe(solo.reduce((n, r) => n + r.totalInterest, 0));
    });
    it('still pours an explicit extra into the strategy target without rollover', () => {
      const r = simulatePayoff(multi, 'avalanche', 100, { rollover: false });
      expect(r.months).toBeLessThan(simulatePayoff(multi, 'avalanche', 0, { rollover: false }).months);
    });
  });
});

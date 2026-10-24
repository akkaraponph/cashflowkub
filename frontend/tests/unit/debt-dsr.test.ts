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

describe('guards', () => {
  const bad = [-1, NaN, Infinity];
  it('dsrBand rejects negative / non-finite ratio', () => {
    for (const r of bad) expect(() => dsrBand(r)).toThrow(RangeError);
  });
  it('computeDsr and buildSmartPlan reject negative / non-finite income', () => {
    for (const i of bad) {
      expect(() => computeDsr([pd({ id: 1 })], i)).toThrow(RangeError);
      expect(() => buildSmartPlan([pd({ id: 1 })], i)).toThrow(RangeError);
    }
  });
  it('rejects negative / non-finite debt fields', () => {
    for (const v of bad) {
      for (const k of ['apr', 'remaining', 'installment'] as const) {
        expect(() => computeDsr([pd({ id: 1, [k]: v })], 1000)).toThrow(RangeError);
        expect(() => buildSmartPlan([pd({ id: 1, [k]: v })], 1000)).toThrow(RangeError);
      }
    }
  });
  it('rejects negative / non-finite targetDsr', () => {
    for (const t of bad) expect(() => buildSmartPlan([pd({ id: 1 })], 1000, t)).toThrow(RangeError);
  });
  it('unset income (0) is not an error and the plan asks for it', () => {
    const p = buildSmartPlan([pd({ id: 1, installment: 1000 })], 0);
    expect(p.dsr.ratio).toBeNull();
    expect(p.monthlyCut).toBe(0);
    expect(Number.isFinite(p.incomeNeeded)).toBe(true);
    expect(p.incomeNeeded).toBe(2500);
    expect(p.quickWins[0].dsrAfter).toBeNull();
  });
  it('cap overdue amount at zero when overpaid', () => {
    const d = pd({ id: 1, due: { state: 'overdue', amountDue: 1000, paidThisCycle: 1500, lateFee: 50 } });
    expect(buildSmartPlan([d], 10000).actions[0]).toEqual({ key: 'payOverdue', debtId: 1, amount: 50 });
  });
});

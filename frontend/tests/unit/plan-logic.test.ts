import { describe, expect, it } from 'vitest';
import { buildPlan, buildSnapshots } from '@/server/plan/logic';
import { nwPoint, planItem, snapshot } from '../fixtures';

describe('buildPlan', () => {
  const items = [
    planItem({ id: 1, type: 'income', planned: 60000, actual: 62000 }),
    planItem({ id: 2, type: 'income', planned: 5000, actual: 3200 }),
    planItem({ id: 3, type: 'expense', planned: 5000, actual: 6500 }),
    planItem({ id: 4, type: 'savings', planned: 8000, actual: 8000 }),
    planItem({ id: 5, type: 'unknown', planned: 999, actual: 999 }),
  ];
  const plan = buildPlan(items);
  it('partitions and totals each group', () => {
    expect(plan.income).toMatchObject({ type: 'income', totalPlanned: 65000, totalActual: 65200, variance: 200 });
    expect(plan.income.items.map((i) => i.id)).toEqual([1, 2]);
    expect(plan.expense).toMatchObject({ totalPlanned: 5000, totalActual: 6500, variance: 1500 });
  });
  it('rolls up net and ratios, ignoring unknown types', () => {
    expect(plan.summary).toMatchObject({ plannedNet: 52000, actualNet: 50700, netVariance: -1300, expenseUsage: 130, savingsRatio: 100 });
    expect(plan.summary.incomeRatio).toBeCloseTo(100.3077, 3);
  });
  it('reports 0% when nothing is planned', () => {
    expect(buildPlan([]).summary.incomeRatio).toBe(0);
  });
});

describe('buildSnapshots', () => {
  it('groups in first-seen order with per-group and overall totals', () => {
    const v = buildSnapshots(
      [
        snapshot({ id: 1, group: 'bank', prev: 100, curr: 150 }),
        snapshot({ id: 2, group: 'invest', prev: 300, curr: 250 }),
        snapshot({ id: 3, group: 'bank', prev: 10, curr: 20 }),
      ],
      [nwPoint({ value: 5 })],
    );
    expect(v.groups.map((g) => [g.group, g.prev, g.curr])).toEqual([['bank', 110, 170], ['invest', 300, 250]]);
    expect(v).toMatchObject({ prev: 410, curr: 420, delta: 10 });
    expect(v.history).toHaveLength(1);
    expect(v.labels).toEqual({ prev: 'May 2026', curr: 'Jun 2026', prevTh: 'พ.ค. 2026', currTh: 'มิ.ย. 2026', lastUpdate: 'May 31, 2026' });
  });
});

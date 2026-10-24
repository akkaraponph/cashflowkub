import { describe, expect, it } from 'vitest';
import { buildDashboard, buildNetWorth, buildReports, netWorthTotals, spendingByCategory, topMerchants } from '@/server/analytics/logic';
import { asset, billView, budget, cashflow, category, debtView, goal, nwPoint, tx } from '../fixtures';

const cats = [category({ key: 'food', label: 'Food', tint: 'folder' }), category({ id: 2, key: 'fun', label: 'Fun', tint: 'video' })];
const budgets = [budget({ cat: 'food', spent: 750 }), budget({ id: 2, cat: 'fun', spent: 250 }), budget({ id: 3, cat: 'ghost', spent: 0 })];
const active = [
  debtView({ id: 1, original: 1000, paid: 400, apr: 0 }),
  debtView({ id: 2, original: 500, paid: 100, apr: 33 }),
  debtView({ id: 3, original: 300, paid: 0, apr: 33 }),
];

describe('spendingByCategory', () => {
  it('joins budget spend to category metadata with percentages', () => {
    const { items, total } = spendingByCategory(budgets, cats);
    expect(total).toBe(1000);
    expect(items[0]).toMatchObject({ cat: 'food', label: 'Food', tint: 'folder', spent: 750, pct: 75 });
    expect(items[2]).toMatchObject({ cat: 'ghost', label: '', pct: 0 });
  });
  it('returns 0% everywhere when nothing was spent', () => {
    expect(spendingByCategory([budget({ spent: 0 })], cats).items[0].pct).toBe(0);
  });
});

describe('netWorthTotals', () => {
  it('subtracts remaining active debt from assets', () => {
    expect(netWorthTotals([asset({ value: 2000 }), asset({ id: 2, value: 500 })], active)).toEqual({ totalAssets: 2500, totalLiab: 1300, netWorth: 1200 });
  });
});

describe('topMerchants', () => {
  it('sums expenses per merchant and keeps the top six', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name, i) => tx({ id: i + 1, name, amount: -(i + 1) * 100 }));
    rows.push(tx({ id: 99, name: 'A', amount: -1000 }));
    const top = topMerchants(rows);
    expect(top).toHaveLength(6);
    expect(top[0]).toEqual({ name: 'A', cat: 'food', total: 1100 });
    expect(top.map((m) => m.name)).not.toContain('B');
  });
});

describe('buildDashboard', () => {
  const view = buildDashboard({
    assets: [asset({ value: 2000 })],
    activeDebts: active,
    budgets,
    categories: cats,
    cashflow: [cashflow({ income: 1, expense: 1 }), cashflow({ id: 2, income: 62000, expense: 17700 })],
    unpaidBills: [billView({ id: 6, dueDay: 16, status: 'overdue' }), billView({ id: 7, dueDay: 20 })],
    goals: [goal()],
    netWorthHist: [nwPoint()],
  });
  it('uses the latest cashflow month', () => expect(view.month).toEqual({ income: 62000, expense: 17700, net: 44300 }));
  it('rolls up debt and focuses the first highest-APR debt', () => {
    expect(view.debt).toMatchObject({ original: 1800, paid: 500, remaining: 1300 });
    expect(view.debt.progress).toBeCloseTo(500 / 1800);
    expect(view.debt.focus?.id).toBe(2);
  });
  it('surfaces the first unpaid bill with status', () => expect(view.nextBill).toMatchObject({ id: 6, status: 'overdue' }));
  it('handles empty inputs', () => {
    const empty = buildDashboard({ assets: [], activeDebts: [], budgets: [], categories: [], cashflow: [], unpaidBills: [], goals: [], netWorthHist: [] });
    expect(empty).toMatchObject({ netWorth: 0, month: { income: 0, expense: 0, net: 0 }, nextBill: null, debt: { progress: 0, focus: null } });
  });
});

describe('buildNetWorth / buildReports', () => {
  it('sorts liabilities by remaining, largest first', () => {
    const v = buildNetWorth({ assets: [], activeDebts: active, history: [] });
    expect(v.liabilities.map((d) => d.id)).toEqual([1, 2, 3]);
    expect(v.totalLiab).toBe(1300);
  });
  it('assembles the reports view', () => {
    const r = buildReports({ budgets, categories: cats, expenseTx: [tx()], monthly: [cashflow()] });
    expect(r.spendTotal).toBe(1000);
    expect(r.topMerchants).toEqual([{ name: 'Coffee', cat: 'food', total: 100 }]);
    expect(r.monthly).toHaveLength(1);
  });
});

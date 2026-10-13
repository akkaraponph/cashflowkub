import { beforeEach, describe, expect, it } from 'vitest';
import { GET as dashboard } from '@/app/api/v1/dashboard/route';
import { GET as networth } from '@/app/api/v1/networth/route';
import { GET as reports } from '@/app/api/v1/reports/route';
import { GET as setup } from '@/app/api/v1/setup/route';
import * as plan from '@/app/api/v1/plan/route';
import * as planItem from '@/app/api/v1/plan/[id]/route';
import { GET as snapshots } from '@/app/api/v1/plan/snapshots/route';
import { PATCH as payBill } from '@/app/api/v1/bills/[id]/pay/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('GET /api/v1/dashboard', () => {
  it('aggregates the home screen', async () => {
    const { json } = await call(dashboard);
    expect(json).toMatchObject({ netWorth: 106783, totalAssets: 363930, totalLiab: 257147, month: { income: 62000, expense: 17700, net: 44300 }, spendTotal: 17700 });
    expect(json.spending[0]).toMatchObject({ cat: 'shopping', label: 'Shopping', spent: 6500 });
    expect(json.debt).toMatchObject({ original: 313743, paid: 56596, remaining: 257147 });
    expect(json.debt.focus).toMatchObject({ id: 3, name: 'Kbank Nano 3' });
    expect(json.nextBill).toMatchObject({ id: 6, status: 'overdue' });
    expect(json.cashflow).toHaveLength(6);
    expect(json.goals).toHaveLength(3);
  });
  it('moves nextBill after the overdue bill is paid', async () => {
    await call(payBill, { method: 'PATCH', params: { id: '6' }, body: { paid: true } });
    expect((await call(dashboard)).json.nextBill).toMatchObject({ name: 'MEA Water', status: 'dueSoon' });
  });
});

describe('net worth and reports', () => {
  it('breaks down assets and liabilities', async () => {
    const { json } = await call(networth);
    expect(json).toMatchObject({ netWorth: 106783 });
    expect(json.assets[0]).toMatchObject({ name: 'Kasikorn Savings', value: 128400 });
    expect(json.liabilities.map((d: { id: number }) => d.id)).toEqual([1, 2, 16, 3, 4, 15, 5]);
    expect(json.history).toHaveLength(6);
  });
  it('ranks top merchants', async () => {
    const { json } = await call(reports);
    expect(json.topMerchants.map((m: { name: string }) => m.name)).toEqual(['Central Ladprao', 'Fitness First', 'PEA Electricity', 'Lazada', 'Boots Pharmacy', 'Netflix']);
    expect(json.spendTotal).toBe(17700);
  });
});

describe('GET /api/v1/setup', () => {
  it('partitions the configuration', async () => {
    const { json } = await call(setup);
    expect(json.incomeCategories).toHaveLength(1);
    expect(json.expenseCategories).toHaveLength(6);
    expect(json.incomeSources).toHaveLength(9);
    expect(json.debts.closing.map((d: { id: number }) => d.id)).toEqual([1, 2, 4, 16]);
    expect(json.debts.revolving.map((d: { id: number }) => d.id)).toEqual([3, 5, 15]);
    expect(json.goals.retirement).toMatchObject({ currentAge: 23, retireAge: 60 });
    expect(json.goals.retirement.channels).toHaveLength(3);
    expect(json.goals.custom).toHaveLength(3);
  });
});

describe('plan', () => {
  it('builds the monthly plan with totals', async () => {
    const { json } = await call(plan.GET, { url: '/api/v1/plan?month=2026-06' });
    expect(json.income).toMatchObject({ totalPlanned: 66500, totalActual: 67020 });
    expect(json.expense).toMatchObject({ totalPlanned: 19000, totalActual: 17700 });
    expect(json.savings).toMatchObject({ totalPlanned: 26500, totalActual: 25000 });
    expect(json.summary).toMatchObject({ plannedNet: 21000, actualNet: 24320, netVariance: 3320 });
  });
  it('returns empty groups for a month without items and 400s a malformed month', async () => {
    expect((await call(plan.GET, { url: '/api/v1/plan?month=2025-01' })).json.income.items).toEqual([]);
    expect((await call(plan.GET, { url: '/api/v1/plan?month=June' })).status).toBe(400);
  });
  it('creates, updates and deletes plan items', async () => {
    const created = await call(plan.POST, { method: 'POST', body: { type: 'expense', name: 'Gifts', planned: 1000, month: '2026-06' } });
    expect(created.status).toBe(201);
    const id = String(created.json.id);
    expect((await call(planItem.PATCH, { method: 'PATCH', params: { id }, body: { actual: 400 } })).json.actual).toBe(400);
    expect((await call(planItem.DELETE, { method: 'DELETE', params: { id } })).status).toBe(204);
    expect((await call(plan.POST, { method: 'POST', body: { type: 'other', name: 'X', month: '2026-06' } })).status).toBe(400);
  });
  it('groups asset snapshots', async () => {
    const { json } = await call(snapshots);
    expect(json.groups.map((g: { group: string }) => g.group)).toEqual(['bank', 'savings', 'invest', 'other']);
    expect(json).toMatchObject({ prev: 530200, curr: 541930, delta: 11730 });
  });
});

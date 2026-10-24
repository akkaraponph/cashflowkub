import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/bills/route';
import { GET as summary } from '@/app/api/v1/bills/summary/route';
import { PATCH as pay } from '@/app/api/v1/bills/[id]/pay/route';
import * as item from '@/app/api/v1/bills/[id]/route';
import { GET as dashboard } from '@/app/api/v1/dashboard/route';
import { prisma } from '@/lib/db';
import { asDemo, call, resetDb } from './helpers';

beforeEach(resetDb);

describe('bills', () => {
  it('lists with derived status, filtered by paid flag', async () => {
    const all = (await call(collection.GET, { url: '/api/v1/bills' })).json.data;
    expect(all).toHaveLength(13);
    expect(all.find((b: { id: number }) => b.id === 6)).toMatchObject({ status: 'overdue', daysDiff: -2 });
    expect((await call(collection.GET, { url: '/api/v1/bills?status=paid' })).json.data).toHaveLength(5);
    expect((await call(collection.GET, { url: '/api/v1/bills?status=unpaid' })).json.data).toHaveLength(8);
  });
  it('summarizes the month', async () => {
    const { json } = await call(summary);
    expect(json).toMatchObject({ total: 27621, paid: 14398, remaining: 13223, count: 13, month: '2026-06', today: 18 });
    expect(json.nextBill).toMatchObject({ id: 6, name: 'KTC Credit Card' });
    expect(json.daySpend).toHaveLength(11);
  });
  it('toggles with an empty body and sets with an explicit flag', async () => {
    expect((await call(pay, { method: 'PATCH', params: { id: '6' }, body: '' })).json).toMatchObject({ paid: true, status: 'paid' });
    expect((await call(pay, { method: 'PATCH', params: { id: '6' }, body: { paid: true } })).json.paid).toBe(true);
    expect((await call(pay, { method: 'PATCH', params: { id: '6' } })).json.paid).toBe(false);
    expect((await call(pay, { method: 'PATCH', params: { id: '9999' } })).status).toBe(404);
  });
  it('creates, edits and deletes', async () => {
    const created = await call(collection.POST, { method: 'POST', body: { name: 'Gym', amount: 1500, dueDay: 3 } });
    expect(created.status).toBe(201);
    const id = String(created.json.id);
    expect((await call(item.PATCH, { method: 'PATCH', params: { id }, body: { amount: 1600 } })).json.amount).toBe(1600);
    expect((await call(item.DELETE, { method: 'DELETE', params: { id } })).status).toBe(204);
    expect((await call(collection.POST, { method: 'POST', body: { name: 'Bad', amount: 1, dueDay: 32 } })).status).toBe(400);
  });
});

describe('subscriptions', () => {
  it('defaults to a bill and accepts a subscription kind', async () => {
    expect((await call(collection.POST, { method: 'POST', body: { name: 'Gym', amount: 1500, dueDay: 3 } })).json.kind).toBe('bill');
    const sub = await call(collection.POST, { method: 'POST', body: { name: 'YouTube Premium', amount: 179, dueDay: 12, kind: 'subscription', cat: 'fun' } });
    expect(sub.status).toBe(201);
    expect(sub.json).toMatchObject({ kind: 'subscription', amount: 179 });
  });
  it('rejects an unknown kind', async () => {
    const r = await call(collection.POST, { method: 'POST', body: { name: 'X', amount: 1, dueDay: 1, kind: 'gift' } });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe('validation');
  });
  it('turns a bill into a subscription and back', async () => {
    const id = '3';
    expect((await call(item.PATCH, { method: 'PATCH', params: { id }, body: { kind: 'subscription' } })).json.kind).toBe('subscription');
    expect((await call(item.PATCH, { method: 'PATCH', params: { id }, body: { kind: 'bill' } })).json.kind).toBe('bill');
  });
  it('filters the list by kind', async () => {
    const subs = (await call(collection.GET, { url: '/api/v1/bills?kind=subscription' })).json.data;
    expect(subs.map((b: { name: string }) => b.name).sort()).toEqual(['Netflix Premium', 'Spotify Family', 'iCloud+ 200GB']);
    expect((await call(collection.GET, { url: '/api/v1/bills?kind=bill' })).json.data).toHaveLength(10);
  });
  it('summarizes subscriptions per month', async () => {
    expect((await call(summary)).json).toMatchObject({ subscriptionsCount: 3, subscriptionsTotal: 667 });
  });
});

describe('recurring bills by month', () => {
  const mk = (b: object) => call(collection.POST, { method: 'POST', body: { name: 'Insurance', amount: 3000, dueDay: 10, ...b } });
  const listIn = async (m: string) => (await call(collection.GET, { url: `/api/v1/bills?month=${m}` })).json.data as { id: number; name: string; paid: boolean }[];
  const names = async (m: string) => (await listIn(m)).map((b) => b.name);

  it('lists only bills that occur in the month', async () => {
    const r = await mk({ everyMonths: 3, startMonth: '2026-06' });
    expect(r.json).toMatchObject({ startMonth: '2026-06', endMonth: '', everyMonths: 3 });
    expect(await names('2026-09')).toContain('Insurance');
    expect(await names('2026-07')).not.toContain('Insurance');
    expect(await names('2026-03')).not.toContain('Insurance');
  });
  it('defaults a new bill to a monthly bill starting in the current month', async () => {
    expect((await mk({})).json).toMatchObject({ startMonth: '2026-06', endMonth: '', everyMonths: 1, freq: 'monthly' });
  });
  it('a one-time bill and an ended bill drop out of other months', async () => {
    await mk({ name: 'Fine', freq: 'once', startMonth: '2026-08', dueDay: 23 });
    await mk({ name: 'Trial', startMonth: '2026-06', endMonth: '2026-07' });
    expect(await names('2026-08')).toContain('Fine');
    expect(await names('2026-09')).not.toContain('Fine');
    expect(await names('2026-07')).toContain('Trial');
    expect(await names('2026-08')).not.toContain('Trial');
  });
  it('rejects a malformed month and bad recurrence', async () => {
    expect((await call(collection.GET, { url: '/api/v1/bills?month=2026-13' })).status).toBe(400);
    expect((await call(summary, { url: '/api/v1/bills/summary?month=nope' })).status).toBe(400);
    expect((await mk({ everyMonths: 0 })).status).toBe(400);
    expect((await mk({ everyMonths: 13 })).status).toBe(400);
    expect((await mk({ startMonth: 'soon' })).status).toBe(400);
    expect((await mk({ startMonth: '2026-08', endMonth: '2026-07' })).status).toBe(400);
  });
  it('paid is tracked per month', async () => {
    const r = await call(pay, { method: 'PATCH', params: { id: '6' }, body: { paid: true, month: '2026-07' } });
    expect(r.json).toMatchObject({ paid: true, month: '2026-07', status: 'paid' });
    expect((await listIn('2026-06')).find((b) => b.id === 6)?.paid).toBe(false);
    expect((await listIn('2026-07')).find((b) => b.id === 6)?.paid).toBe(true);
  });
  it('refuses to pay a bill in a month it does not occur', async () => {
    const r = await call(pay, { method: 'PATCH', params: { id: '6' }, body: { paid: true, month: '2026-05' } });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe('billNotInMonth');
  });
  it('summarizes any month', async () => {
    expect((await call(summary, { url: '/api/v1/bills/summary?month=2026-07' })).json).toMatchObject({ month: '2026-07', paid: 0, count: 13 });
  });
  it('payments survive an edit that hides the month', async () => {
    await call(pay, { method: 'PATCH', params: { id: '6' }, body: { paid: true } });
    const total = (await call(summary)).json.total;
    await call(item.PATCH, { method: 'PATCH', params: { id: '6' }, body: { startMonth: '2026-07' } });
    expect((await listIn('2026-06')).some((b) => b.id === 6)).toBe(false);
    expect((await call(summary)).json).toMatchObject({ count: 12 });
    expect((await call(summary)).json.total).toBeLessThan(total);
    await call(item.PATCH, { method: 'PATCH', params: { id: '6' }, body: { startMonth: '2026-06' } });
    expect((await listIn('2026-06')).find((b) => b.id === 6)?.paid).toBe(true);
  });
  it('checks the end month against the stored start month on a partial update', async () => {
    expect((await call(item.PATCH, { method: 'PATCH', params: { id: '6' }, body: { endMonth: '2026-05' } })).status).toBe(400);
  });
  it('deleting a bill removes its payments', async () => {
    await call(pay, { method: 'PATCH', params: { id: '6' }, body: { paid: true } });
    expect(await asDemo(() => prisma.billPayment.count({ where: { billId: 6 } }))).toBe(1);
    await call(item.DELETE, { method: 'DELETE', params: { id: '6' } });
    expect(await asDemo(() => prisma.billPayment.count({ where: { billId: 6 } }))).toBe(0);
  });
  it('dashboard next bill ignores bills not due this month', async () => {
    await mk({ name: 'Early', amount: 10, dueDay: 1, startMonth: '2026-07' });
    expect((await call(dashboard)).json.nextBill).toMatchObject({ id: 6 });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/bills/route';
import { GET as summary } from '@/app/api/v1/bills/summary/route';
import { PATCH as pay } from '@/app/api/v1/bills/[id]/pay/route';
import * as item from '@/app/api/v1/bills/[id]/route';
import { call, resetDb } from './helpers';

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

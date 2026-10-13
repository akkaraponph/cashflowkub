import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/debts/route';
import * as item from '@/app/api/v1/debts/[id]/route';
import { GET as schedule } from '@/app/api/v1/debts/[id]/schedule/route';
import { POST as pay } from '@/app/api/v1/debts/[id]/pay/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('GET /api/v1/debts', () => {
  it('filters by status with derived remaining/progress', async () => {
    const active = (await call(collection.GET, { url: '/api/v1/debts?status=active' })).json.data;
    expect(active).toHaveLength(5);
    expect(active[0]).toMatchObject({ id: 1, remaining: 178375 });
    expect((await call(collection.GET, { url: '/api/v1/debts?status=paid' })).json.data).toHaveLength(9);
    expect((await call(collection.GET, { url: '/api/v1/debts' })).json.data).toHaveLength(14);
  });
});

describe('debt by id', () => {
  it('gets one and 404s a missing one', async () => {
    expect((await call(item.GET, { params: { id: '2' } })).json).toMatchObject({ name: 'KrungThai Personal', remaining: 45700 });
    expect((await call(item.GET, { params: { id: '9999' } })).status).toBe(404);
    expect((await call(item.GET, { params: { id: 'abc' } })).status).toBe(400);
  });
  it('builds the amortization schedule', async () => {
    const { json } = await call(schedule, { params: { id: '2' } });
    expect(json.schedule[0]).toEqual({ month: 1, payment: 2783, principal: 1831, interest: 952, balance: 43869 });
    expect(json.months).toBe(json.schedule.length);
  });
});

describe('POST /api/v1/debts/:id/pay', () => {
  it('pays the monthly minimum when the body is empty', async () => {
    const { status, json } = await call(pay, { method: 'POST', params: { id: '4' }, body: '' });
    expect(status).toBe(200);
    expect(json).toMatchObject({ paid: 6907, monthsLeft: 2, done: false });
  });
  it('caps an overpayment and closes the debt', async () => {
    const { json } = await call(pay, { method: 'POST', params: { id: '4' }, body: { amount: 999999 } });
    expect(json).toMatchObject({ paid: 9593, remaining: 0, done: true, monthsLeft: 0 });
  });
  it('rejects a negative amount', async () => {
    expect((await call(pay, { method: 'POST', params: { id: '4' }, body: { amount: -5 } })).status).toBe(400);
  });
});

describe('debt create / update / delete', () => {
  it('creates, edits and removes a debt', async () => {
    const created = await call(collection.POST, { method: 'POST', body: { name: 'Shopee SPayLater', original: 6000, monthly: 1000, calc: 'flat' } });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ id: 15, paid: 0, remaining: 6000 });
    const id = String(created.json.id);
    expect((await call(item.PATCH, { method: 'PATCH', params: { id }, body: { apr: 12 } })).json.apr).toBe(12);
    expect((await call(item.DELETE, { method: 'DELETE', params: { id } })).status).toBe(204);
  });
  it('rejects an unknown calc method', async () => {
    expect((await call(collection.POST, { method: 'POST', body: { name: 'X', original: 1, calc: 'magic' } })).status).toBe(400);
  });
});

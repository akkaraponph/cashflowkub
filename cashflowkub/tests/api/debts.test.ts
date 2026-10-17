import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/debts/route';
import * as item from '@/app/api/v1/debts/[id]/route';
import { GET as schedule } from '@/app/api/v1/debts/[id]/schedule/route';
import * as payments from '@/app/api/v1/debts/[id]/payments/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('GET /api/v1/debts', () => {
  it('filters by status with derived remaining/progress', async () => {
    const active = (await call(collection.GET, { url: '/api/v1/debts?status=active' })).json.data;
    expect(active).toHaveLength(7);
    expect(active[0]).toMatchObject({ id: 1, remaining: 178375 });
    expect((await call(collection.GET, { url: '/api/v1/debts?status=paid' })).json.data).toHaveLength(9);
    expect((await call(collection.GET, { url: '/api/v1/debts' })).json.data).toHaveLength(16);
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

describe('debt create / update / delete', () => {
  it('creates, edits and removes a debt', async () => {
    const created = await call(collection.POST, { method: 'POST', body: { name: 'Shopee SPayLater', original: 6000, monthly: 1000, calc: 'flat' } });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ id: 17, paid: 0, remaining: 6000 });
    const id = String(created.json.id);
    expect((await call(item.PATCH, { method: 'PATCH', params: { id }, body: { apr: 12 } })).json.apr).toBe(12);
    expect((await call(item.DELETE, { method: 'DELETE', params: { id } })).status).toBe(204);
  });
  it('starts paid at openingPaid and rejects openingPaid above original', async () => {
    const ok = await call(collection.POST, { method: 'POST', body: { name: 'Bank', original: 1000, openingPaid: 400, kind: 'bankloan', dueDay: 31 } });
    expect(ok.json).toMatchObject({ paid: 400, remaining: 600, kind: 'bankloan', dueDay: 31 });
    expect((await call(collection.POST, { method: 'POST', body: { name: 'X', original: 100, openingPaid: 101 } })).status).toBe(400);
    expect((await call(collection.POST, { method: 'POST', body: { name: 'X', original: 100, kind: 'loan-shark' } })).status).toBe(400);
  });
  it('rejects an unknown calc method', async () => {
    expect((await call(collection.POST, { method: 'POST', body: { name: 'X', original: 1, calc: 'magic' } })).status).toBe(400);
  });
});

describe('error codes', () => {
  it('404 carries notFound', async () => {
    expect((await call(item.GET, { params: { id: '9999' } })).json).toMatchObject({ code: 'notFound' });
  });
  it('zod failures carry validation', async () => {
    expect((await call(collection.POST, { method: 'POST', body: {} })).json.code).toBe('validation');
  });
  it('openingPaid above original carries openingPaidExceeds and keeps the English text', async () => {
    const r = await call(collection.POST, { method: 'POST', body: { name: 'X', original: 100, openingPaid: 101 } });
    expect(r.json).toEqual({ error: 'openingPaid cannot exceed original', code: 'openingPaidExceeds' });
    const patch = await call(item.PATCH, { method: 'PATCH', params: { id: '2' }, body: { openingPaid: 999999 } });
    expect(patch.json.code).toBe('openingPaidExceeds');
  });
  it('original below repaid principal carries originalBelowRepaid', async () => {
    const { json: d } = await call(collection.POST, { method: 'POST', body: { name: 'Loan', original: 1000 } });
    const id = String(d.id);
    await call(payments.POST, { method: 'POST', params: { id }, body: { amount: 500 } });
    const r = await call(item.PATCH, { method: 'PATCH', params: { id }, body: { original: 300 } });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe('originalBelowRepaid');
  });
  it('a bad payment date carries invalidDate', async () => {
    const r = await call(payments.POST, { method: 'POST', params: { id: '2' }, body: { amount: 100, date: 'garbage' } });
    expect(r.json.code).toBe('invalidDate');
  });
});

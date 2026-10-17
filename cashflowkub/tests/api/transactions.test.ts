import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/transactions/route';
import * as item from '@/app/api/v1/transactions/[id]/route';
import * as batch from '@/app/api/v1/transactions/batch/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('GET /api/v1/transactions', () => {
  it('lists newest first with derived date and group', async () => {
    const { json } = await call(collection.GET, { url: '/api/v1/transactions' });
    expect(json.data).toHaveLength(12);
    expect(json.data[0]).toEqual({ id: 3, name: 'Grab', cat: 'transport', acct: 'TrueMoney', amount: -120, note: 'Ride to office', date: 'Jun 18, 2026', group: 'Today', interest: 0, fee: 0, goal: '', isoDate: '2026-06-18' });
    expect(json.data[3].group).toBe('Yesterday');
  });
  it('filters by type, category, date range and limit', async () => {
    const get = async (qs: string) => (await call(collection.GET, { url: `/api/v1/transactions?${qs}` })).json.data;
    expect(await get('type=income')).toHaveLength(1);
    expect((await get('type=expense')).every((t: { amount: number }) => t.amount < 0)).toBe(true);
    expect(await get('category=food')).toHaveLength(3);
    expect(await get('from=2026-06-15&to=2026-06-15')).toHaveLength(3);
    expect(await get('limit=5')).toHaveLength(5);
  });
  it('pages with offset', async () => {
    const get = async (qs: string) => (await call(collection.GET, { url: `/api/v1/transactions?${qs}` })).json.data;
    const all = await get('');
    const page = await get('limit=5&offset=5');
    expect(page).toHaveLength(5);
    expect(page[0].id).toBe(all[5].id);
    expect(await get('offset=100')).toEqual([]);
  });
  it('400s an invalid date filter', async () => {
    expect((await call(collection.GET, { url: '/api/v1/transactions?from=nope' })).status).toBe(400);
  });
});

describe('POST /api/v1/transactions', () => {
  it('records a transaction dated today by default', async () => {
    const { status, json } = await call(collection.POST, { method: 'POST', body: { name: 'Lunch', cat: 'food', acct: 'Cash Wallet', amount: -90 } });
    expect(status).toBe(201);
    expect(json).toMatchObject({ id: 13, name: 'Lunch', date: 'Jun 18, 2026', group: 'Today', note: '' });
  });
  it('accepts an explicit date', async () => {
    const { json } = await call(collection.POST, { method: 'POST', body: { name: 'Gift', cat: 'income', acct: 'Cash Wallet', amount: 500, date: 'Jun 1, 2026' } });
    expect(json).toMatchObject({ date: 'Jun 1, 2026', group: 'Jun 1' });
  });
  it('stores loan interest, fee and saving goal', async () => {
    const post = (body: object) => call(collection.POST, { method: 'POST', body });
    const { status, json } = await post({ name: 'KTC', cat: 'debt', acct: 'SCB Current', amount: -1358, interest: 120, fee: 15 });
    expect(status).toBe(201);
    expect(json).toMatchObject({ interest: 120, fee: 15, goal: '' });
    expect((await post({ name: 'KTC', cat: 'debt', acct: 'SCB Current', amount: -1, interest: -1 })).status).toBe(400);
  });
  it('rejects zero amounts, blank names and bad dates', async () => {
    const post = (body: object) => call(collection.POST, { method: 'POST', body });
    expect((await post({ name: 'X', cat: 'food', acct: 'Cash', amount: 0 })).status).toBe(400);
    expect((await post({ name: ' ', cat: 'food', acct: 'Cash', amount: -1 })).status).toBe(400);
    expect((await post({ name: 'X', cat: 'food', acct: 'Cash', amount: -1, date: '2026-02-30' })).status).toBe(400);
  });
});

describe('/api/v1/transactions/:id', () => {
  it('gets, updates and deletes', async () => {
    expect((await call(item.GET, { params: { id: '1' } })).json).toMatchObject({ name: 'Monthly Salary', amount: 62000 });
    expect((await call(item.PATCH, { method: 'PATCH', params: { id: '1' }, body: { note: 'June' } })).json).toMatchObject({ name: 'Monthly Salary', note: 'June' });
    expect((await call(item.DELETE, { method: 'DELETE', params: { id: '1' } })).status).toBe(204);
    expect((await call(item.GET, { params: { id: '1' } })).status).toBe(404);
  });
  it('400s a bad id', async () => {
    expect((await call(item.GET, { params: { id: '1.5' } })).status).toBe(400);
  });
});

describe('POST /api/v1/transactions/batch', () => {
  const row = (o: object = {}) => ({ name: 'Lunch', cat: 'food', acct: 'Cash Wallet', amount: -90, date: '2026-06-01', ...o });
  const post = (items: unknown[]) => call(batch.POST, { method: 'POST', body: { items } });
  const count = async () => (await call(collection.GET, { url: '/api/v1/transactions' })).json.data.length;

  it('creates every item', async () => {
    const { status, json } = await post([row(), row({ amount: -10 }), row({ cat: 'debt', interest: 5, fee: 1 })]);
    expect(status).toBe(201);
    expect(json.data).toHaveLength(3);
    expect(json.data[2]).toMatchObject({ interest: 5, fee: 1 });
    expect(await count()).toBe(15);
  });
  it('is all-or-nothing', async () => {
    expect((await post([row(), row(), row({ amount: 0 })])).status).toBe(400);
    expect(await count()).toBe(12);
  });
  it('rejects an empty list', async () => {
    expect((await post([])).status).toBe(400);
  });
});

describe('decimal amounts', () => {
  it('stores satang and returns numbers', async () => {
    const { status, json } = await call(collection.POST, { method: 'POST', body: { name: 'Coffee', cat: 'food', acct: 'Cash Wallet', amount: -45.5 } });
    expect(status).toBe(201);
    expect(json.amount).toBe(-45.5);
    expect((await call(item.GET, { params: { id: String(json.id) } })).json.amount).toBe(-45.5);
    const debt = await call(collection.POST, { method: 'POST', body: { name: 'KTC', cat: 'debt', acct: 'SCB Current', amount: -1358.25, interest: 120.75, fee: 15.1 } });
    expect(debt.json).toMatchObject({ amount: -1358.25, interest: 120.75, fee: 15.1 });
  });
  it('rejects more than two decimal places', async () => {
    const post = (body: object) => call(collection.POST, { method: 'POST', body: { name: 'X', cat: 'food', acct: 'Cash', ...body } });
    expect((await post({ amount: -12.345 })).status).toBe(400);
    expect((await post({ amount: -1, interest: 0.001 })).status).toBe(400);
  });
});

describe('DELETE /api/v1/transactions/batch', () => {
  const del = (body: unknown) => call(batch.DELETE, { method: 'DELETE', body });
  const count = async () => (await call(collection.GET, { url: '/api/v1/transactions' })).json.data.length;
  it('deletes the listed ids and reports the count', async () => {
    const { status, json } = await del({ ids: [1, 2, 3] });
    expect(status).toBe(200);
    expect(json).toEqual({ deleted: 3 });
    expect(await count()).toBe(9);
    expect((await call(item.GET, { params: { id: '2' } })).status).toBe(404);
  });
  it('skips unknown ids', async () => {
    expect((await del({ ids: [4, 9999] })).json).toEqual({ deleted: 1 });
  });
  it('rejects empty, oversized and malformed id lists', async () => {
    for (const body of [{ ids: [] }, { ids: Array.from({ length: 501 }, (_, i) => i + 1) }, { ids: [0] }, { ids: [1.5] }, {}]) {
      expect((await del(body)).status).toBe(400);
    }
    expect(await count()).toBe(12);
  });
});

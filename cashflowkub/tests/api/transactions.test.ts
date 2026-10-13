import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/transactions/route';
import * as item from '@/app/api/v1/transactions/[id]/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('GET /api/v1/transactions', () => {
  it('lists newest first with derived date and group', async () => {
    const { json } = await call(collection.GET, { url: '/api/v1/transactions' });
    expect(json.data).toHaveLength(12);
    expect(json.data[0]).toEqual({ id: 3, name: 'Grab', cat: 'transport', acct: 'TrueMoney', amount: -120, note: 'Ride to office', date: 'Jun 18, 2026', group: 'Today' });
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

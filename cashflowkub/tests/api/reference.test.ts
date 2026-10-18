import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/[resource]/route';
import * as item from '@/app/api/v1/[resource]/[id]/route';
import { GET as health } from '@/app/api/health/route';
import * as transactions from '@/app/api/v1/transactions/route';
import { prisma } from '@/lib/db';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

describe('GET /api/v1/:resource', () => {
  it('lists rows in sort order inside a data envelope', async () => {
    const { status, json } = await call(collection.GET, { params: { resource: 'categories' } });
    expect(status).toBe(200);
    expect(json.data).toHaveLength(9);
    expect(json.data[0]).toMatchObject({ id: 1, key: 'food', label: 'Food & Dining' });
  });
  it('404s an unknown resource', async () => {
    expect((await call(collection.GET, { params: { resource: 'secrets' } })).status).toBe(404);
  });
});

describe('POST /api/v1/:resource', () => {
  it('creates with defaults and returns 201', async () => {
    const { status, json } = await call(collection.POST, { method: 'POST', params: { resource: 'goals' }, body: { name: 'Car', target: 300000 } });
    expect(status).toBe(201);
    expect(json).toMatchObject({ id: 4, name: 'Car', target: 300000, saved: 0, icon: 'target' });
  });
  it('rejects an empty body, invalid JSON and schema violations with 400', async () => {
    const base = { method: 'POST', params: { resource: 'goals' } };
    expect((await call(collection.POST, { ...base, body: '' })).status).toBe(400);
    expect((await call(collection.POST, { ...base, body: '{nope' })).status).toBe(400);
    const bad = await call(collection.POST, { ...base, body: { name: '', target: 'lots' } });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/name|target/);
  });
  it('409s a duplicate category key', async () => {
    const r = await call(collection.POST, { method: 'POST', params: { resource: 'categories' }, body: { key: 'food', label: 'Dup' } });
    expect(r.status).toBe(409);
  });
});

describe('/api/v1/:resource/:id', () => {
  it('gets, patches (keeping omitted fields) and deletes', async () => {
    // Cash Wallet has transactions, so it can be patched but not deleted (see tests/api/accounts.test.ts); delete an unused account instead.
    expect((await call(item.GET, { params: { resource: 'accounts', id: '3' } })).json).toMatchObject({ name: 'Cash Wallet', balance: 3200 });
    expect((await call(item.PATCH, { method: 'PATCH', params: { resource: 'accounts', id: '3' }, body: { balance: 0 } })).json).toMatchObject({ name: 'Cash Wallet', balance: 0 });
    const params = { resource: 'accounts', id: String((await call(collection.POST, { method: 'POST', params: { resource: 'accounts' }, body: { name: 'Temp' } })).json.id) };
    expect((await call(item.DELETE, { method: 'DELETE', params })).status).toBe(204);
    expect((await call(item.GET, { params })).status).toBe(404);
  });
  it('400s a non-numeric id and 404s a missing one on every verb', async () => {
    for (const handler of [item.GET, item.PUT, item.PATCH, item.DELETE]) {
      expect((await call(handler, { method: 'PUT', params: { resource: 'assets', id: 'abc' }, body: {} })).status).toBe(400);
      expect((await call(handler, { method: 'PUT', params: { resource: 'assets', id: '9999' }, body: {} })).status).toBe(404);
    }
  });
});

describe('GET /api/health', () => {
  it('reports ok', async () => {
    expect((await call(health)).json).toEqual({ status: 'ok', service: 'cashflowkub' });
  });
});

describe('renaming categories', () => {
  const patch = (resource: string, id: string, body: unknown) => call(item.PATCH, { method: 'PATCH', params: { resource, id }, body });

  it('renames an expense category without touching its key', async () => {
    const { status, json } = await patch('categories', '1', { label: 'Groceries', th: 'ของชำ' });
    expect(status).toBe(200);
    expect(json).toMatchObject({ key: 'food', label: 'Groceries', th: 'ของชำ' });
  });
  it('clears only the Thai name when asked', async () => {
    const { json } = await patch('categories', '1', { th: '' });
    expect(json).toMatchObject({ th: '', label: 'Food & Dining' });
  });
  it('rejects a blank English name', async () => {
    const r = await patch('categories', '1', { label: '   ' });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe('validation');
  });
  it('renames an income source', async () => {
    const { status, json } = await patch('income-categories', '1', { name: 'Day job', th: '' });
    expect(status).toBe(200);
    expect(json).toMatchObject({ name: 'Day job', th: '' });
  });
  it('leaves transactions and budgets that reference the key untouched', async () => {
    const before = (await call(transactions.GET, { url: '/api/v1/transactions' })).json.data.filter((t: { cat: string }) => t.cat === 'food');
    await patch('categories', '1', { label: 'Groceries' });
    const after = (await call(transactions.GET, { url: '/api/v1/transactions' })).json.data.filter((t: { cat: string }) => t.cat === 'food');
    expect(before.length).toBeGreaterThan(0);
    expect(after.map((t: { id: number; name: string }) => [t.id, t.name])).toEqual(before.map((t: { id: number; name: string }) => [t.id, t.name]));
    const budgets = (await call(collection.GET, { params: { resource: 'budgets' } })).json.data;
    expect(budgets.some((b: { cat: string }) => b.cat === 'food')).toBe(true);
  });
});

describe.each([
  { resource: 'channels', id: '8', name: 'Gold savings', activity: 'save', amount: -100, taken: 'channelNameTaken', inUse: 'channelInUse' },
  { resource: 'income-categories', id: '4', name: 'Freelance work', activity: 'receive', amount: 100, taken: 'incomeNameTaken', inUse: 'incomeInUse' },
])('transaction item guards on $resource', ({ resource, id, name, activity, amount, taken, inUse }) => {
  const params = { resource, id };
  const use = () => call(transactions.POST, { method: 'POST', body: { name: 'x', activity, item: name, acct: 'SCB Current', amount } });
  const rowItem = async () => (await prisma.transaction.findFirstOrThrow({ where: { activity }, orderBy: { id: 'desc' } })).item;

  it('refuses a duplicate name ignoring case and spaces', async () => {
    const r = await call(collection.POST, { method: 'POST', params: { resource }, body: { name: ` ${name.toUpperCase()} ` } });
    expect([r.status, r.json.code]).toEqual([409, taken]);
  });
  it('renames the item on transactions that use it', async () => {
    expect((await use()).status).toBe(201);
    expect((await call(item.PATCH, { method: 'PATCH', params, body: { name: 'Renamed' } })).status).toBe(200);
    expect(await rowItem()).toBe('Renamed');
  });
  it('refuses to delete one that transactions use, and deletes an unused one', async () => {
    await use();
    const r = await call(item.DELETE, { method: 'DELETE', params });
    expect([r.status, r.json.code]).toEqual([409, inUse]);
    const fresh = await call(collection.POST, { method: 'POST', params: { resource }, body: { name: 'Temp' } });
    expect((await call(item.DELETE, { method: 'DELETE', params: { resource, id: String(fresh.json.id) } })).status).toBe(204);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/[resource]/route';
import * as item from '@/app/api/v1/[resource]/[id]/route';
import * as transactions from '@/app/api/v1/transactions/route';
import { prisma } from '@/lib/db';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

const post = (body: unknown) => call(collection.POST, { method: 'POST', params: { resource: 'accounts' }, body });
const patch = (id: string, body: unknown) => call(item.PATCH, { method: 'PATCH', params: { resource: 'accounts', id }, body });
const del = (id: string) => call(item.DELETE, { method: 'DELETE', params: { resource: 'accounts', id } });
const get = (id: string) => call(item.GET, { params: { resource: 'accounts', id } });
const txOn = async (acct: string) => (await call(transactions.GET, { url: '/api/v1/transactions?limit=500' })).json.data.filter((t: { acct: string }) => t.acct === acct);

describe('create', () => {
  it('creates an account with defaults', async () => {
    const r = await post({ name: 'Savings 2', kind: 'ewallet', balance: 500 });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ name: 'Savings 2', kind: 'ewallet', balance: 500, sub: '' });
  });
  it('rejects a missing name and an unknown kind', async () => {
    expect((await post({ balance: 1 })).json.code).toBe('validation');
    expect((await post({ name: 'X', kind: 'crypto' })).status).toBe(400);
  });
  it('rejects a duplicate name, ignoring case and spaces', async () => {
    const r = await post({ name: '  kasikorn savings ' });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe('accountNameTaken');
  });
});

describe('update', () => {
  it('renaming cascades to the transactions that use the account', async () => {
    const before = await txOn('Kasikorn Savings');
    expect(before.length).toBeGreaterThan(0);
    const r = await patch('1', { name: 'KBank Main' });
    expect(r.json.name).toBe('KBank Main');
    expect(await txOn('Kasikorn Savings')).toHaveLength(0);
    expect(await txOn('KBank Main')).toHaveLength(before.length);
  });
  it('changes balance without touching the name or transactions', async () => {
    expect((await patch('1', { balance: 999 })).json).toMatchObject({ balance: 999, name: 'Kasikorn Savings' });
  });
  it('allows re-saving the same name but not taking another account\'s name', async () => {
    expect((await patch('1', { name: 'Kasikorn Savings' })).status).toBe(200);
    const r = await patch('1', { name: 'scb current' });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe('accountNameTaken');
    expect((await get('1')).json.name).toBe('Kasikorn Savings');
  });
});

describe('delete', () => {
  it('refuses to delete an account that transactions use', async () => {
    const r = await del('1');
    expect(r.status).toBe(409);
    expect(r.json.code).toBe('accountInUse');
    expect((await get('1')).status).toBe(200);
  });
  it('deletes an unused account', async () => {
    const { json } = await post({ name: 'Temp' });
    expect((await del(String(json.id))).status).toBe(204);
    const gone = await get(String(json.id));
    expect(gone.status).toBe(404);
    expect(gone.json.code).toBe('notFound');
  });
});

describe('transfers', () => {
  const transfer = () => call(transactions.POST, { method: 'POST', body: { name: 'ATM', activity: 'transfer', item: 'SCB Current', acct: 'Cash Wallet', amount: 500 } });
  it('renames the source of a transfer and guards its deletion', async () => {
    expect((await transfer()).status).toBe(201);
    expect((await patch('2', { name: 'SCB Main' })).status).toBe(200);
    const rows = (await call(transactions.GET, { url: '/api/v1/transactions?activity=transfer' })).json.data;
    expect(rows.map((t: { item: string }) => t.item)).toEqual(['SCB Main']);
    const r = await del('2');
    expect([r.status, r.json.code]).toEqual([409, 'accountInUse']);
  });
  it('refuses to delete a source account even when no row names it as acct', async () => {
    await call(transactions.POST, { method: 'POST', body: { name: 'x', activity: 'transfer', item: 'Cash Wallet', acct: 'TrueMoney', amount: 5 } });
    await prisma.transaction.deleteMany({ where: { acct: 'Cash Wallet' } });
    expect((await del('3')).json.code).toBe('accountInUse');
  });
});

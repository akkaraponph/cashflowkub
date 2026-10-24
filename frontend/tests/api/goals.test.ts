import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/[resource]/route';
import * as item from '@/app/api/v1/[resource]/[id]/route';
import * as transactions from '@/app/api/v1/transactions/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

const post = (body: unknown) => call(collection.POST, { method: 'POST', params: { resource: 'goals' }, body });
const patch = (id: string, body: unknown) => call(item.PATCH, { method: 'PATCH', params: { resource: 'goals', id }, body });
const del = (id: string) => call(item.DELETE, { method: 'DELETE', params: { resource: 'goals', id } });
const get = (id: string) => call(item.GET, { params: { resource: 'goals', id } });
const tagTx = (goal: string) =>
  call(transactions.POST, { method: 'POST', body: { name: 'Save', cat: 'saving', acct: 'Cash Wallet', amount: -1000, goal } });
const txTagged = async (goal: string) =>
  (await call(transactions.GET, { url: '/api/v1/transactions?limit=500' })).json.data.filter((t: { goal: string }) => t.goal === goal);

describe('create', () => {
  it('rejects a duplicate name, ignoring case and spaces', async () => {
    const r = await post({ name: '  japan trip ', target: 1000 });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe('goalNameTaken');
  });
});

describe('update', () => {
  it('renaming cascades to tagged transactions', async () => {
    expect((await tagTx('Japan Trip')).status).toBe(201);
    const r = await patch('2', { name: 'Tokyo 2026', th: 'Tokyo 2026' });
    expect(r.json.name).toBe('Tokyo 2026');
    expect(await txTagged('Japan Trip')).toHaveLength(0);
    expect(await txTagged('Tokyo 2026')).toHaveLength(1);
  });
  it('changes the target without touching the name', async () => {
    expect((await patch('2', { target: 150000 })).json).toMatchObject({ target: 150000, name: 'Japan Trip' });
  });
  it("allows re-saving the same name but not taking another goal's name", async () => {
    expect((await patch('2', { name: 'Japan Trip' })).status).toBe(200);
    const r = await patch('2', { name: 'new iphone' });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe('goalNameTaken');
  });
});

describe('delete', () => {
  it('refuses to delete a goal that transactions use', async () => {
    await tagTx('Japan Trip');
    const r = await del('2');
    expect(r.status).toBe(409);
    expect(r.json.code).toBe('goalInUse');
    expect((await get('2')).status).toBe(200);
  });
  it('deletes an unused goal', async () => {
    expect((await del('3')).status).toBe(204);
    expect((await get('3')).status).toBe(404);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import * as collection from '@/app/api/v1/[resource]/route';
import * as item from '@/app/api/v1/[resource]/[id]/route';
import { GET as health } from '@/app/api/health/route';
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
    const params = { resource: 'accounts', id: '3' };
    expect((await call(item.GET, { params })).json).toMatchObject({ name: 'Cash Wallet', balance: 3200 });
    const patched = await call(item.PATCH, { method: 'PATCH', params, body: { balance: 0 } });
    expect(patched.json).toMatchObject({ name: 'Cash Wallet', balance: 0 });
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

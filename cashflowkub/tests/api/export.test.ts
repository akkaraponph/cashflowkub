import { beforeEach, describe, expect, it } from 'vitest';
import * as exportRoute from '@/app/api/v1/me/export/route';
import * as txCollection from '@/app/api/v1/transactions/route';
import { basePrisma } from '@/lib/db';
import { OWNED_MODELS } from '@/server/tenancy';
import { call, resetDb, signUpCookie } from './helpers';

beforeEach(resetDb);

const exportOf = (cookie?: string) => call(exportRoute.GET, { url: '/api/v1/me/export', ...(cookie ? { cookie } : {}) });

describe('GET /api/v1/me/export', () => {
  it('export contains every owned table key', async () => {
    const { status, json } = await exportOf();
    expect(status).toBe(200);
    expect(json).toMatchObject({ format: 'cashflowkub-export', version: 1 });
    expect(Object.keys(json.data).sort()).toEqual(
      ['accounts', 'asset_snapshots', 'assets', 'bill_payments', 'bills', 'budgets', 'categories', 'channels', 'day_spends', 'debt_payments', 'debts',
        'goals', 'income_categories', 'monthly_cashflows', 'net_worth_histories', 'plan_items', 'settings', 'setup_goal_channels', 'setup_goals', 'transactions'],
    );
    expect(Object.keys(json.data)).toHaveLength(OWNED_MODELS.size); // a new owned model must be added to TABLES in me/service.ts
    expect(json.user).toEqual({ email: 'demo@cashflowkub.local', name: expect.any(String), created_at: expect.any(String) });
    expect(json.privacy).toEqual({ version: expect.any(String), accepted_at: expect.any(String) });
  });

  it('rows match what the API lists', async () => {
    const { json } = await exportOf();
    const [{ n }] = await basePrisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM transactions`;
    expect(json.data.transactions.length).toBe(n);
    expect(n).toBeGreaterThan(0);
    expect(json.data.transactions[0]).toHaveProperty('amount');
    expect(json.data.transactions[0]).not.toHaveProperty('userId');
  });

  it('notes are decrypted', async () => {
    await call(txCollection.POST, { method: 'POST', body: { name: 'ยืมแม่', note: 'ค่าหมอ', cat: 'food', acct: 'Cash Wallet', amount: -90 } });
    const { json } = await exportOf();
    const row = json.data.transactions.find((t: { name: string }) => t.name === 'ยืมแม่');
    expect(row.note).toBe('ค่าหมอ');
    expect(JSON.stringify(json)).not.toContain('enc:v1:');
  });

  it('there is no password, session token, auth_accounts or verification anywhere', async () => {
    const { json } = await exportOf();
    const text = JSON.stringify(json);
    expect(text).not.toMatch(/password|token/i);
    expect(text).not.toMatch(/\$argon|scrypt|:[0-9a-f]{32}/);
    expect(Object.keys(json)).not.toContain('auth_accounts');
    expect(Object.keys(json.data)).not.toContain('auth_accounts');
    expect(Object.keys(json.data)).not.toContain('verifications');
  });

  it("B's export contains none of A's rows", async () => {
    const b = await signUpCookie('b@example.com');
    const { json } = await exportOf(b);
    expect(json.data.transactions).toEqual([]);
    expect(json.data.debts).toEqual([]);
    expect(json.user.email).toBe('b@example.com');
    expect(JSON.stringify(json)).not.toContain('Monthly Salary');
  });

  it('is a download with the date in the file name, and needs a session', async () => {
    const res = await exportRoute.GET(new Request('http://test/api/v1/me/export', { headers: { Cookie: await (await import('./helpers')).demoCookie() } }));
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="cashflowkub-export-\d{4}-\d{2}-\d{2}\.json"$/);
    const anon = await call(exportRoute.GET, { url: '/api/v1/me/export', cookie: null });
    expect(anon.status).toBe(401);
  });
});

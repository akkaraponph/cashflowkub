// Tenancy: user B must never read, change or delete user A's (the demo user's) rows.
import { beforeAll, describe, expect, it } from 'vitest';
import * as resource from '@/app/api/v1/[resource]/route';
import * as resourceItem from '@/app/api/v1/[resource]/[id]/route';
import * as bills from '@/app/api/v1/bills/route';
import * as billItem from '@/app/api/v1/bills/[id]/route';
import { PATCH as payBill } from '@/app/api/v1/bills/[id]/pay/route';
import * as debts from '@/app/api/v1/debts/route';
import * as debtItem from '@/app/api/v1/debts/[id]/route';
import * as debtPayments from '@/app/api/v1/debts/[id]/payments/route';
import { DELETE as deleteDebtPayment } from '@/app/api/v1/debts/[id]/payments/[paymentId]/route';
import * as planItem from '@/app/api/v1/plan/[id]/route';
import * as settings from '@/app/api/v1/settings/route';
import * as transactions from '@/app/api/v1/transactions/route';
import * as txItem from '@/app/api/v1/transactions/[id]/route';
import * as txBatch from '@/app/api/v1/transactions/batch/route';
import { GET as health } from '@/app/api/health/route';
import { basePrisma } from '@/lib/db';
import { DEFAULT_CATEGORIES } from '../../prisma/seed-data';
import { call, demoCookie, demoUserId, resetDb, signUpCookie } from './helpers';

let b: string;

beforeAll(async () => {
  await resetDb();
  b = await signUpCookie('b@test.local');
});

/** A's view of a row, read with the demo cookie. */
const asA = <P>(handler: Parameters<typeof call<P>>[0], params: P) => call(handler, { params });

describe('tenancy isolation', () => {
  it('a new user starts with the default categories and nothing else', async () => {
    const cats = await call(resource.GET, { params: { resource: 'categories' }, cookie: b });
    expect(cats.status).toBe(200);
    expect(cats.json.data).toHaveLength(DEFAULT_CATEGORIES.length);
    for (const [handler, params] of [
      [transactions.GET, {}],
      [resource.GET, { resource: 'accounts' }],
      [debts.GET, {}],
      [bills.GET, {}],
      [resource.GET, { resource: 'goals' }],
    ] as const) {
      const res = await call(handler as typeof resource.GET, { params: params as { resource: string }, cookie: b });
      expect(res.status).toBe(200);
      expect(res.json.data).toEqual([]);
    }
  });

  it('B gets 404 for A\'s rows', async () => {
    const before = {
      tx: (await asA(txItem.GET, { id: '1' })).json,
      account: (await asA(resourceItem.GET, { resource: 'accounts', id: '1' })).json,
      debt: (await asA(debtItem.GET, { id: '15' })).json,
      plan: await basePrisma.planItem.findUniqueOrThrow({ where: { id: 1 } }),
      bill: await basePrisma.bill.findUniqueOrThrow({ where: { id: 6 } }),
    };
    expect(before.tx.id).toBe(1);

    const tries: [string, Promise<{ status: number }>][] = [
      ['GET tx', call(txItem.GET, { params: { id: '1' }, cookie: b })],
      ['PATCH tx', call(txItem.PATCH, { method: 'PATCH', params: { id: '1' }, body: { note: 'B was here' }, cookie: b })],
      ['DELETE tx', call(txItem.DELETE, { method: 'DELETE', params: { id: '1' }, cookie: b })],
      ['GET account', call(resourceItem.GET, { params: { resource: 'accounts', id: '1' }, cookie: b })],
      ['PATCH account', call(resourceItem.PATCH, { method: 'PATCH', params: { resource: 'accounts', id: '1' }, body: { name: 'Stolen' }, cookie: b })],
      ['DELETE account', call(resourceItem.DELETE, { method: 'DELETE', params: { resource: 'accounts', id: '1' }, cookie: b })],
      ['GET debt', call(debtItem.GET, { params: { id: '15' }, cookie: b })],
      ['PATCH debt', call(debtItem.PATCH, { method: 'PATCH', params: { id: '15' }, body: { name: 'Stolen' }, cookie: b })],
      ['DELETE debt', call(debtItem.DELETE, { method: 'DELETE', params: { id: '15' }, cookie: b })],
      ['GET debt payments', call(debtPayments.GET, { params: { id: '15' }, cookie: b })],
      ['POST debt payment', call(debtPayments.POST, { method: 'POST', params: { id: '15' }, body: { amount: 100 }, cookie: b })],
      ['PATCH plan', call(planItem.PATCH, { method: 'PATCH', params: { id: '1' }, body: { actual: 1 }, cookie: b })],
      ['DELETE plan', call(planItem.DELETE, { method: 'DELETE', params: { id: '1' }, cookie: b })],
      ['PATCH bill', call(billItem.PATCH, { method: 'PATCH', params: { id: '6' }, body: { amount: 1 }, cookie: b })],
      ['DELETE bill', call(billItem.DELETE, { method: 'DELETE', params: { id: '6' }, cookie: b })],
    ];
    for (const [label, res] of tries) expect((await res).status, label).toBe(404);

    expect((await asA(txItem.GET, { id: '1' })).json).toEqual(before.tx);
    expect((await asA(resourceItem.GET, { resource: 'accounts', id: '1' })).json).toEqual(before.account);
    expect((await asA(debtItem.GET, { id: '15' })).json).toEqual(before.debt);
    expect(await basePrisma.planItem.findUniqueOrThrow({ where: { id: 1 } })).toEqual(before.plan);
    expect(await basePrisma.bill.findUniqueOrThrow({ where: { id: 6 } })).toEqual(before.bill);
  });

  it('B cannot batch-delete A\'s transactions', async () => {
    const res = await call(txBatch.DELETE, { method: 'DELETE', body: { ids: [1, 2, 3] }, cookie: b });
    expect(res.json).toEqual({ deleted: 0 });
    expect(await basePrisma.transaction.count({ where: { id: { in: [1, 2, 3] } } })).toBe(3);
  });

  it('B can reuse A\'s names', async () => {
    const res = await call(resource.POST, { method: 'POST', params: { resource: 'accounts' }, body: { name: 'Cash Wallet' }, cookie: b });
    expect(res.status).toBe(201);
    expect((await call(resource.POST, { method: 'POST', params: { resource: 'accounts' }, body: { name: 'Cash' }, cookie: b })).status).toBe(201);
    expect((await call(resource.POST, { method: 'POST', params: { resource: 'accounts' }, body: { name: 'Cash' }, cookie: b })).status).toBe(409);
  });

  it('B\'s settings do not touch A\'s', async () => {
    const before = (await call(settings.GET)).json;
    expect((await call(settings.PUT, { method: 'PUT', body: { monthlyIncome: 1 }, cookie: b })).json).toEqual({ monthlyIncome: 1 });
    expect((await call(settings.GET)).json).toEqual(before);
    expect((await call(settings.GET, { cookie: b })).json).toEqual({ monthlyIncome: 1 });
  });

  it('B cannot tick A\'s bill or delete A\'s debt payment', async () => {
    const demoId = await demoUserId();
    const counts = async () => ({
      bill: await basePrisma.billPayment.count({ where: { userId: demoId } }),
      debt: await basePrisma.debtPayment.count({ where: { userId: demoId } }),
    });
    const before = await counts();
    const paidBill = await basePrisma.billPayment.findFirstOrThrow({ where: { userId: demoId } });
    const payment = await basePrisma.debtPayment.findFirstOrThrow({ where: { userId: demoId } });

    expect((await call(payBill, { method: 'PATCH', params: { id: '6' }, body: { paid: true }, cookie: b })).status).toBe(404);
    expect((await call(payBill, { method: 'PATCH', params: { id: String(paidBill.billId) }, body: { paid: false }, cookie: b })).status).toBe(404);
    const params = { id: String(payment.debtId), paymentId: String(payment.id) };
    expect((await call(deleteDebtPayment, { method: 'DELETE', params, cookie: b })).status).toBe(404);
    expect(await counts()).toEqual(before);
  });

  it('no cookie gets 401 on a /api/v1 route', async () => {
    const res = await call(transactions.GET, { cookie: null });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'not signed in', code: 'unauthorized' });
    expect((await call(transactions.GET, { cookie: 'better-auth.session_token=forged' })).status).toBe(401);
  });

  it('health stays public', async () => {
    expect((await call(health, { cookie: null })).status).toBe(200);
  });

  it('API rows do not expose userId', async () => {
    const { json } = await call(transactions.GET);
    expect(json.data.length).toBeGreaterThan(0);
    for (const row of json.data) expect(row).not.toHaveProperty('userId');
    expect((await call(debtItem.GET, { params: { id: '15' } })).json).not.toHaveProperty('userId');
  });

  it('the seed\'s setup-goal channels belong to the demo user', async () => {
    const demoId = await demoUserId();
    const rows = await basePrisma.setupGoalChannel.findMany();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.userId).toBe(demoId);
    expect(await demoCookie()).toContain('session_token');
  });
});

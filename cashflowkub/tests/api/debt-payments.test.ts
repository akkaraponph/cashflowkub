import { beforeEach, describe, expect, it } from 'vitest';
import * as payments from '@/app/api/v1/debts/[id]/payments/route';
import { DELETE as removePayment } from '@/app/api/v1/debts/[id]/payments/[paymentId]/route';
import { GET as getDebt } from '@/app/api/v1/debts/[id]/route';
import { call, resetDb } from './helpers';

beforeEach(resetDb);

const post = (id: string, body: unknown) => call(payments.POST, { method: 'POST', params: { id }, body });

describe('debt views expose terms and due state', () => {
  it('EasyCash is overdue with a late fee; SPayLater is paid this cycle', async () => {
    expect((await call(getDebt, { params: { id: '16' } })).json).toMatchObject({
      installment: 1967, remaining: 14999, monthsLeft: 9, payoff: 'Mar 2027',
      due: { state: 'overdue', daysLate: 13, lateFee: 100, amountDue: 1967 },
    });
    expect((await call(getDebt, { params: { id: '15' } })).json.due).toMatchObject({ state: 'paid', dueDate: '2026-07-01' });
  });
});

describe('POST /api/v1/debts/:id/payments', () => {
  it('splits fee → interest → principal and clears the overdue state', async () => {
    const { status, json } = await post('16', { amount: 2067 });
    expect(status).toBe(201);
    expect(json.payment).toMatchObject({ id: 7, date: '2026-06-18', amount: 2067, fee: 100, interest: 300, principal: 1667 });
    expect(json.debt).toMatchObject({ paid: 6668, due: { state: 'paid', dueDate: '2026-07-05' } });
    expect(json.excess).toBe(0);
  });
  it('closes the debt on overpayment and reports the excess', async () => {
    const { json } = await post('15', { amount: 5000, note: 'Pay off' });
    expect(json.payment).toMatchObject({ amount: 3750, principal: 3750 });
    expect(json.debt).toMatchObject({ paid: 7500, remaining: 0, done: true, due: { state: 'closed' } });
    expect(json.excess).toBe(1250);
  });
  it('accepts a back-dated payment', async () => {
    expect((await post('16', { amount: 1967, date: '2026-06-05' })).json.payment).toMatchObject({ date: '2026-06-05', fee: 0 });
  });
  it('rejects bad input and closed debts', async () => {
    expect((await post('16', { amount: 0 })).status).toBe(400);
    expect((await post('16', { amount: 100, date: '2026-02-30' })).status).toBe(400);
    expect((await post('16', '')).status).toBe(400);
    expect((await post('6', { amount: 100 })).status).toBe(409);
    expect((await post('9999', { amount: 100 })).status).toBe(404);
  });
});

describe('payment history', () => {
  it('lists newest first', async () => {
    const { json } = await call(payments.GET, { params: { id: '16' } });
    expect(json.data.map((p: { date: string }) => p.date)).toEqual(['2026-05-05', '2026-04-05', '2026-03-05']);
  });
  it('deleting a payment recomputes the balance and reopens a closed debt', async () => {
    const paidOff = await post('15', { amount: 3750 });
    expect(paidOff.json.debt.done).toBe(true);
    const { status, json } = await call(removePayment, { method: 'DELETE', params: { id: '15', paymentId: String(paidOff.json.payment.id) } });
    expect(status).toBe(200);
    expect(json).toMatchObject({ paid: 3750, done: false, remaining: 3750 });
  });
  it("404s a payment that belongs to another debt", async () => {
    expect((await call(removePayment, { method: 'DELETE', params: { id: '16', paymentId: '1' } })).status).toBe(404);
  });
});

describe('concurrency', () => {
  const ledgerOk = async (id: number) => {
    const { prisma } = await import('@/lib/db');
    const d = await prisma.debt.findUniqueOrThrow({ where: { id }, include: { payments: true } });
    const principal = d.payments.reduce((s, p) => s + p.principal, 0);
    expect(d.paid).toBe(d.openingPaid + principal);
    expect(d.paid).toBeLessThanOrEqual(d.original);
    expect(d.openingPaid + principal).toBeLessThanOrEqual(d.original);
    return d;
  };
  it('concurrent full-balance payments: one wins, the rest are rejected', async () => {
    const res = await Promise.all(Array.from({ length: 6 }, () => post('15', { amount: 3750 })));
    expect(res.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
    const d = await ledgerOk(15);
    expect(d).toMatchObject({ paid: 7500, done: true });
  });
  it('POST racing DELETE ends consistent', async () => {
    const first = await post('15', { amount: 1000 });
    const [, del] = await Promise.all([
      post('15', { amount: 2000 }),
      call(removePayment, { method: 'DELETE', params: { id: '15', paymentId: String(first.json.payment.id) } }),
    ]);
    expect(del.status).toBe(200);
    await ledgerOk(15);
  });
});

describe('PATCH /api/v1/debts/:id', () => {
  it('rejects shrinking original below principal already repaid', async () => {
    const item = await import('@/app/api/v1/debts/[id]/route');
    const r = await call(item.PATCH, { method: 'PATCH', params: { id: '16' }, body: { original: 5000 } });
    expect(r.status).toBe(400);
  });
});

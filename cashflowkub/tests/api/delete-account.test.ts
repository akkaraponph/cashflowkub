// Account deletion: Better Auth's /delete-user plus the ON DELETE CASCADE from every owned table.
import { beforeAll, describe, expect, it } from 'vitest';
import * as transactions from '@/app/api/v1/transactions/route';
import { basePrisma } from '@/lib/db';
import { auth } from '@/server/auth/auth';
import { OWNED_MODELS } from '@/server/tenancy';
import { authPost, call, cookieFrom, demoUserId, resetDb, signUpCookie } from './helpers';

const EMAIL = 'b@delete.test';
const PASSWORD = 'password-for-tests';

const deleteUser = (cookie: string, password: string): Promise<Response> =>
  auth.handler(
    new Request('http://test/api/auth/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://test', Cookie: cookie },
      body: JSON.stringify({ password }),
    }),
  );

type Counter = { count: (a: { where: Record<string, string> }) => Promise<number> };
const delegates = basePrisma as unknown as Record<string, Counter>;
const lower = (m: string): string => m[0].toLowerCase() + m.slice(1);

/** Row counts for one user: every owned table, plus the four auth tables. */
async function countsFor(userId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const m of OWNED_MODELS) out[m] = await delegates[lower(m)].count({ where: { userId } });
  out.user = await basePrisma.user.count({ where: { id: userId } });
  out.session = await basePrisma.session.count({ where: { userId } });
  out.authAccount = await basePrisma.authAccount.count({ where: { userId } });
  out.verification = await basePrisma.verification.count({ where: { identifier: EMAIL } });
  return out;
}

let bId: string;
let cookie1: string;
let cookie2: string;
let demoBefore: Record<string, number>;

beforeAll(async () => {
  await resetDb();
  cookie1 = await signUpCookie(EMAIL, PASSWORD);
  const second = await authPost('sign-in/email', { email: EMAIL, password: PASSWORD });
  cookie2 = cookieFrom(second);
  bId = (await basePrisma.user.findUniqueOrThrow({ where: { email: EMAIL }, select: { id: true } })).id;
  const userId = bId;
  await basePrisma.transaction.create({ data: { userId, name: 'ยืมแม่', cat: 'food', acct: 'Cash', amount: -90, date: new Date('2026-06-01'), note: 'x' } });
  const debt = await basePrisma.debt.create({ data: { userId, name: 'Loan', original: 1000 } });
  await basePrisma.debtPayment.create({ data: { userId, debtId: debt.id, date: new Date('2026-06-01'), amount: 100, principal: 90, interest: 10, fee: 0 } });
  const bill = await basePrisma.bill.create({ data: { userId, name: 'Rent', amount: 500, dueDay: 1 } });
  await basePrisma.billPayment.create({ data: { userId, billId: bill.id, month: '2026-06' } });
  const goal = await basePrisma.setupGoal.create({ data: { userId, kind: 'custom', name: 'Trip' } });
  await basePrisma.setupGoalChannel.create({ data: { userId, setupGoalId: goal.id, name: 'Savings', pct: 100 } });
  demoBefore = await countsFor(await demoUserId());
});

describe('delete my account', () => {
  it('B has rows in the tables the test needs, and two sessions', async () => {
    const c = await countsFor(bId);
    for (const m of ['Transaction', 'Debt', 'DebtPayment', 'Bill', 'BillPayment', 'SetupGoal', 'SetupGoalChannel']) expect(c[m], m).toBeGreaterThan(0);
    expect(c.session).toBe(2);
    expect(demoBefore.Transaction).toBeGreaterThan(0);
  });

  it('a wrong password is refused and nothing is deleted', async () => {
    const before = await countsFor(bId);
    const res = await deleteUser(cookie1, 'not-the-password');
    expect(res.status).toBe(400);
    expect(await countsFor(bId)).toEqual(before);
    expect((await call(transactions.GET, { cookie: cookie1 })).status).toBe(200);
  });

  it('the correct password deletes B everywhere, and B\'s other session stops working at once', async () => {
    const res = await deleteUser(cookie1, PASSWORD);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'User deleted' });
    const after = await countsFor(bId);
    expect(Object.values(after).every((n) => n === 0), JSON.stringify(after)).toBe(true);
    expect((await call(transactions.GET, { cookie: cookie2 })).status).toBe(401);
    expect((await call(transactions.GET, { cookie: cookie1 })).status).toBe(401);
  });

  it("the demo user's row counts are unchanged", async () => {
    expect(await countsFor(await demoUserId())).toEqual(demoBefore);
  });

  it('B can no longer sign in', async () => {
    expect((await authPost('sign-in/email', { email: EMAIL, password: PASSWORD })).status).toBe(401);
  });
});

describe('delete-user needs the password', () => {
  const EMAIL2 = 'nopw@delete.test';
  const post = (path: string, cookie: string, body: unknown): Promise<Response> =>
    auth.handler(new Request(`http://test/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://test', Cookie: cookie }, body: JSON.stringify(body) }));

  it.each([[{}], [{ password: '' }]])('a request with %j is rejected and deletes nothing', async (body) => {
    await resetDb();
    const cookie = await signUpCookie(EMAIL2, PASSWORD);
    const id = (await basePrisma.user.findUniqueOrThrow({ where: { email: EMAIL2 }, select: { id: true } })).id;
    const before = await basePrisma.category.count({ where: { userId: id } });
    expect((await post('delete-user', cookie, body)).status).toBe(400);
    expect(await basePrisma.user.count({ where: { id } })).toBe(1);
    expect(await basePrisma.category.count({ where: { userId: id } })).toBe(before);
    expect((await auth.handler(new Request('http://test/api/auth/get-session', { headers: { Cookie: cookie } }))).status).toBe(200);
    expect((await call((await import('@/app/api/v1/transactions/route')).GET, { cookie })).status).toBe(200);
  });
});

describe('privacy fields cannot be changed through update-user', () => {
  it('rejects privacyVersion and leaves the value; /me/privacy still works', async () => {
    await resetDb();
    const cookie = await signUpCookie('upd@delete.test', PASSWORD);
    const read = () => basePrisma.user.findUniqueOrThrow({ where: { email: 'upd@delete.test' }, select: { privacyVersion: true } });
    await basePrisma.user.update({ where: { email: 'upd@delete.test' }, data: { privacyVersion: '2020-01-01' } });
    const res = await post2('update-user', cookie, { privacyVersion: '2026-10-19' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await read()).privacyVersion).toBe('2020-01-01');
    const ok = await call((await import('@/app/api/v1/me/privacy/route')).POST, { method: 'POST', cookie, body: { privacy_version: '2026-10-19' } });
    expect(ok.status).toBe(200);
    expect((await read()).privacyVersion).toBe('2026-10-19');
  });
});

const post2 = (path: string, cookie: string, body: unknown): Promise<Response> =>
  auth.handler(new Request(`http://test/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://test', Cookie: cookie }, body: JSON.stringify(body) }));

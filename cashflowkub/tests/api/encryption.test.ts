import { beforeEach, describe, expect, it } from 'vitest';
import * as txCollection from '@/app/api/v1/transactions/route';
import * as txItem from '@/app/api/v1/transactions/[id]/route';
import * as txBatch from '@/app/api/v1/transactions/batch/route';
import * as debts from '@/app/api/v1/debts/route';
import * as debtItem from '@/app/api/v1/debts/[id]/route';
import * as payments from '@/app/api/v1/debts/[id]/payments/route';
import { basePrisma, prisma } from '@/lib/db';
import { runAsSystem, runAsUser } from '@/lib/user-context';
import { claimLegacyData, LEGACY_OWNER } from '../../scripts/claim-legacy-data';
import * as resource from '@/app/api/v1/[resource]/route';
import { asDemo, call, demoUserId, resetDb, signUpCookie } from './helpers';

beforeEach(resetDb);

const raw = <T>(strings: TemplateStringsArray, ...values: unknown[]) => basePrisma.$queryRaw<T[]>(strings, ...values);

describe('free text is encrypted at rest', () => {
  it('transaction name and note are ciphertext in the table and plaintext in the API', async () => {
    const { status, json } = await call(txCollection.POST, { method: 'POST', body: { name: 'ค่าหมอลูก', note: 'ค่าหมอ', cat: 'food', acct: 'Cash Wallet', amount: -90 } });
    expect(status).toBe(201);
    expect(json).toMatchObject({ name: 'ค่าหมอลูก', note: 'ค่าหมอ' });
    const [row] = await raw<{ name: string; note: string }>`SELECT name, note FROM transactions WHERE id = ${json.id}`;
    expect(row!.note).toMatch(/^enc:v1:/);
    expect(row!.note).not.toContain('ค่าหมอ');
    expect(row!.name).toMatch(/^enc:v1:/);
  });

  it('the transaction list returns decrypted names, including seeded plaintext rows', async () => {
    await call(txCollection.POST, { method: 'POST', body: { name: 'ยืมแม่', cat: 'food', acct: 'Cash Wallet', amount: -10 } });
    const { json } = await call(txCollection.GET, { url: '/api/v1/transactions?limit=500' });
    const names = json.data.map((t: { name: string }) => t.name);
    expect(names).toContain('ยืมแม่');
    expect(names).toContain('Monthly Salary');
    expect(names.some((n: string) => n.startsWith('enc:v1:'))).toBe(false);
  });

  it('a partial PATCH re-encrypts and keeps the untouched fields', async () => {
    const created = (await call(txCollection.POST, { method: 'POST', body: { name: 'Lunch', note: 'a', cat: 'food', acct: 'Cash Wallet', amount: -90 } })).json;
    const patched = await call(txItem.PATCH, { method: 'PATCH', params: { id: String(created.id) }, body: { note: 'ค่าหมอ' } });
    expect(patched.json).toMatchObject({ name: 'Lunch', note: 'ค่าหมอ' });
    const [row] = await raw<{ note: string }>`SELECT note FROM transactions WHERE id = ${created.id}`;
    expect(row!.note).toMatch(/^enc:v1:/);
    expect((await call(txItem.GET, { params: { id: String(created.id) } })).json.note).toBe('ค่าหมอ');
  });

  it('the batch endpoint encrypts every row', async () => {
    const { status, json } = await call(txBatch.POST, { method: 'POST', body: { items: [
      { name: 'ก', note: 'หนึ่ง', cat: 'food', acct: 'Cash Wallet', amount: -1 },
      { name: 'ข', note: 'สอง', cat: 'food', acct: 'Cash Wallet', amount: -2 },
    ] } });
    expect(status).toBe(201);
    const ids = (json.data as { id: number }[]).map((t) => t.id);
    const rows = await raw<{ name: string; note: string }>`SELECT name, note FROM transactions WHERE id IN (${ids[0]}, ${ids[1]})`;
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.name + r.note).not.toMatch(/[ก-ฮ]/);
  });

  it('debt lender and payment note are ciphertext; nested payments decrypt', async () => {
    const created = await call(debts.POST, { method: 'POST', body: { name: 'Mom loan', lender: 'แม่', original: 5000, monthly: 1000, calc: 'flat' } });
    expect(created.json.lender).toBe('แม่');
    const id = String(created.json.id);
    const paid = await call(payments.POST, { method: 'POST', params: { id }, body: { amount: 1000, note: 'ค่าหมอ' } });
    expect(paid.status).toBe(201);
    expect(paid.json.payment.note).toBe('ค่าหมอ');
    const [d] = await raw<{ lender: string }>`SELECT lender FROM debts WHERE id = ${created.json.id}`;
    const [p] = await raw<{ note: string }>`SELECT note FROM debt_payments WHERE id = ${paid.json.payment.id}`;
    expect(d!.lender).toMatch(/^enc:v1:/);
    expect(d!.lender).not.toContain('แม่');
    expect(p!.note).toMatch(/^enc:v1:/);
    const got = await call(debtItem.GET, { params: { id } });
    expect(got.json.lender).toBe('แม่');
    // listPayments reads the debt with its `payments` include, so this covers nested decryption.
    const listed = (await call(payments.GET, { params: { id } })).json.data;
    expect(listed).toHaveLength(1);
    expect(listed[0].note).toBe('ค่าหมอ');
  });

  it('a tampered ciphertext fails to read instead of returning garbage', async () => {
    const created = (await call(txCollection.POST, { method: 'POST', body: { name: 'Lunch', note: 'secret', cat: 'food', acct: 'Cash Wallet', amount: -9 } })).json;
    const [row] = await raw<{ note: string }>`SELECT note FROM transactions WHERE id = ${created.id}`;
    const parts = row!.note.split(':');
    parts[4] = (parts[4]![0] === 'A' ? 'B' : 'A') + parts[4]!.slice(1);
    await basePrisma.$executeRaw`UPDATE transactions SET note = ${parts.join(':')} WHERE id = ${created.id}`;
    expect((await call(txItem.GET, { params: { id: String(created.id) } })).status).toBe(500);
  });

  it('a write with no key throws instead of storing plaintext', async () => {
    const key = process.env.DATA_ENCRYPTION_KEY;
    delete process.env.DATA_ENCRYPTION_KEY;
    try {
      const res = await call(txCollection.POST, { method: 'POST', body: { name: 'Lunch', cat: 'food', acct: 'Cash Wallet', amount: -9 } });
      expect(res.status).toBe(500);
    } finally {
      process.env.DATA_ENCRYPTION_KEY = key;
    }
    const rows = await raw<{ n: number }>`SELECT count(*)::int AS n FROM transactions WHERE name = 'Lunch'`;
    expect(rows[0]!.n).toBe(0);
  });
});

describe('encryption scope and write paths', () => {
  it('user text that starts with the prefix in unencrypted columns reads back unchanged', async () => {
    const typed = 'enc:v1:abc';
    for (const [name, body] of [['accounts', { name: typed }], ['goals', { name: typed, target: 100 }], ['categories', { key: 'zz', label: typed }]] as const) {
      const made = await call(resource.POST, { method: 'POST', params: { resource: name }, body });
      expect(made.status).toBe(201);
    }
    const debt = await call(debts.POST, { method: 'POST', body: { name: typed, original: 100, monthly: 10, calc: 'flat' } });
    expect(debt.status).toBe(201);
    expect((await call(debts.GET)).json.data.map((d: { name: string }) => d.name)).toContain(typed);
    for (const [name, field] of [['accounts', 'name'], ['goals', 'name'], ['categories', 'label']] as const) {
      const list = await call(resource.GET, { params: { resource: name } });
      expect(list.status).toBe(200);
      expect(list.json.data.map((r: Record<string, string>) => r[field])).toContain(typed);
    }
  });

  it('createMany and upsert encrypt through the extension', async () => {
    const userId = await demoUserId();
    await asDemo(async () => {
      await prisma.transaction.createMany({ data: [{ userId, name: 'ก', note: 'หนึ่ง', cat: 'food', acct: 'Cash Wallet', amount: -1, date: new Date('2026-06-01') }] });
      await prisma.transaction.upsert({
        where: { id: 99999 }, update: {},
        create: { userId, id: 99999, name: 'ข', note: 'สอง', cat: 'food', acct: 'Cash Wallet', amount: -2, date: new Date('2026-06-01') },
      });
      const back = await prisma.transaction.findUnique({ where: { id: 99999 } });
      expect(back).toMatchObject({ name: 'ข', note: 'สอง' });
      await prisma.transaction.upsert({ where: { id: 99999 }, create: { userId, id: 99999, name: 'x', cat: 'food', acct: 'Cash Wallet', amount: -2, date: new Date('2026-06-01') }, update: { note: { set: 'สาม' } } });
    });
    const many = await raw<{ name: string }>`SELECT name FROM transactions WHERE amount = -1 AND date = '2026-06-01'`;
    expect(many.length).toBeGreaterThan(0);
    expect(many.every((r) => r.name !== 'ก')).toBe(true);
    expect(many.some((r) => r.name.startsWith('enc:v1:'))).toBe(true);
    const all = await raw<{ name: string; note: string }>`SELECT name, note FROM transactions WHERE id = 99999`;
    expect(all[0]!.note).toMatch(/^enc:v1:/);
    expect(all[0]!.note).not.toContain('สาม');
    expect(await asDemo(() => prisma.transaction.findUniqueOrThrow({ where: { id: 99999 } }))).toMatchObject({ note: 'สาม' });
  });
});

describe('claim-legacy-data', () => {
  it('moves legacy rows to the account, encrypts plaintext and deletes the placeholder', async () => {
    await signUpCookie('owner@test.local');
    const owner = await basePrisma.user.findUniqueOrThrow({ where: { email: 'owner@test.local' } });
    await basePrisma.user.upsert({
      where: { id: LEGACY_OWNER }, update: {},
      create: { id: LEGACY_OWNER, name: 'Legacy owner', email: 'legacy-owner@localhost', privacyVersion: '2026-10-19', privacyAcceptedAt: new Date() },
    });
    await basePrisma.$executeRaw`DELETE FROM categories WHERE user_id = ${LEGACY_OWNER}`;
    await runAsSystem(async () => {
      await basePrisma.account.create({ data: { userId: LEGACY_OWNER, name: 'Old Wallet', balance: 100, sort: 1 } });
      await basePrisma.category.create({ data: { userId: LEGACY_OWNER, key: 'food', label: 'Food' } });
      const debt = await basePrisma.debt.create({ data: { userId: LEGACY_OWNER, name: 'Mom', lender: 'แม่', original: 1000 } });
      await basePrisma.debtPayment.create({ data: { userId: LEGACY_OWNER, debtId: debt.id, date: new Date('2026-06-02'), amount: 100, principal: 100, interest: 0, fee: 0, note: 'ค่าหมอ' } });
      await basePrisma.transaction.create({ data: { userId: LEGACY_OWNER, name: 'ยืมแม่', note: 'ค่าหมอ', cat: 'food', acct: 'Old Wallet', amount: -50, date: new Date('2026-06-01') } });
    });
    const ownerDefaults = await basePrisma.category.count({ where: { userId: owner.id } });
    expect(ownerDefaults).toBeGreaterThan(1);
    const [before] = await raw<{ note: string }>`SELECT note FROM transactions WHERE user_id = ${LEGACY_OWNER}`;
    expect(before!.note).toBe('ค่าหมอ');

    const counts = await claimLegacyData('owner@test.local');

    expect(counts).toMatchObject({ Account: 1, Transaction: 1, Category: 1 });
    expect(await raw`SELECT 1 FROM transactions WHERE user_id = ${LEGACY_OWNER}`).toHaveLength(0);
    const [after] = await raw<{ user_id: string; name: string; note: string }>`SELECT user_id, name, note FROM transactions WHERE user_id = ${owner.id}`;
    expect(after!.user_id).toBe(owner.id);
    expect(after!.note).toMatch(/^enc:v1:/);
    expect(after!.name).toMatch(/^enc:v1:/);
    expect(await basePrisma.user.findUnique({ where: { id: LEGACY_OWNER } })).toBeNull();
    const cats = await basePrisma.category.findMany({ where: { userId: owner.id } });
    expect(cats).toHaveLength(ownerDefaults); // legacy 'food' replaced the default 'food'; other defaults remain
    expect(cats.filter((c) => c.key === 'food')).toHaveLength(1);
    const [lender] = await raw<{ lender: string }>`SELECT lender FROM debts WHERE user_id = ${owner.id}`;
    const [pnote] = await raw<{ note: string }>`SELECT note FROM debt_payments WHERE user_id = ${owner.id}`;
    expect(lender!.lender).toMatch(/^enc:v1:/);
    expect(pnote!.note).toMatch(/^enc:v1:/);
    expect(counts).toMatchObject({ Debt: 1, DebtPayment: 1 });
    const seen = await runAsUser(owner.id, () => basePrisma.account.findMany({ where: { userId: owner.id } }));
    expect(seen.map((a) => a.name)).toEqual(['Old Wallet']);
  });

  it('rejects an unknown email', async () => {
    await expect(claimLegacyData('nobody@test.local')).rejects.toThrow('no user with email');
  });
});

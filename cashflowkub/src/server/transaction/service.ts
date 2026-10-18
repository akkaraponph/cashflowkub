import { z } from 'zod';
import { prisma } from '@/lib/db';
import { today } from '@/lib/clock';
import { clampPage } from '@/lib/pagination';
import type { Prisma } from '@/generated/prisma/client';
import { ACTIVITIES, checkActivity, fixedCat, legacyActivity, type Activity } from '@/lib/activity';
import { badRequest, notFound } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { hasAtMostTwoDecimals, parseFlexDate, toPlain, toTxView, type TxFilter, type TxPlain, type TxView } from './logic';
import { assertActivityRefs } from './refs';

const money = z.number().finite().refine(hasAtMostTwoDecimals, 'at most 2 decimal places').refine((n) => Math.abs(n) < 1e12, 'amount too large');

const txSchema = z.object({
  name: z.string().trim().min(1),
  cat: z.string().optional(),
  activity: z.enum(ACTIVITIES).optional(),
  item: z.string().trim().optional(),
  acct: z.string().min(1),
  amount: money.refine((n) => n !== 0, 'amount must not be zero'),
  note: z.string().optional(),
  interest: money.min(0).optional(),
  fee: money.min(0).optional(),
  goal: z.string().optional(),
  date: z.string().optional(),
});

function toDate(raw: string | undefined): Date | undefined {
  if (raw === undefined) return undefined;
  const d = parseFlexDate(raw);
  if (!d) throw badRequest(`invalid date: ${raw}`);
  return d;
}

function buildWhere(f: TxFilter): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {};
  if (f.type === 'income') where.activity = 'receive';
  if (f.type === 'expense') where.activity = { in: ['pay', 'save', 'pay_debt'] };
  if (f.activity) where.activity = f.activity;
  if (f.category) where.cat = f.category;
  if (f.account) where.acct = f.account;
  if (f.from || f.to) where.date = { gte: f.from, lte: f.to };
  return where;
}

const ORDER: Prisma.TransactionOrderByWithRelationInput[] = [{ date: 'desc' }, { id: 'desc' }];

export async function listTransactions(f: TxFilter): Promise<TxView[]> {
  const rows = await prisma.transaction.findMany({ where: buildWhere(f), orderBy: ORDER, take: f.limit, skip: f.offset });
  const now = today();
  return rows.map((t) => toTxView(toPlain(t), now));
}

/** One page of the filtered list; `page` is clamped to the last page and the clamped value is returned. */
export async function listTransactionPage(f: TxFilter, page: number, size: number): Promise<{ rows: TxView[]; total: number; page: number }> {
  const where = buildWhere(f);
  const total = await prisma.transaction.count({ where });
  const current = clampPage(page, total, size);
  const rows = await prisma.transaction.findMany({ where, orderBy: ORDER, skip: (current - 1) * size, take: size });
  const now = today();
  return { rows: rows.map((t) => toTxView(toPlain(t), now)), total, page: current };
}

export async function getTransaction(id: number): Promise<TxView> {
  const row = await prisma.transaction.findUnique({ where: { id } });
  if (!row) throw notFound();
  return toTxView(toPlain(row), today());
}

type Input = z.infer<typeof txSchema>;

interface Resolved {
  name: string;
  cat: string;
  acct: string;
  amount: number;
  note: string;
  interest: number;
  fee: number;
  goal: string;
  activity: Activity;
  item: string;
}

/**
 * Merges a body over the current row (if any), settles activity and category, and enforces the activity rules.
 * A body without `activity` on create keeps working as before: the activity is inferred and a missing item is allowed.
 */
async function resolveRow(tx: Prisma.TransactionClient, input: Partial<Input>, current?: TxPlain): Promise<Resolved> {
  const cat = input.cat ?? current?.cat ?? '';
  const amount = input.amount ?? current?.amount ?? 0;
  let activity = input.activity ?? (current?.activity as Activity | undefined);
  if (activity === undefined) {
    if (cat === '') throw badRequest('cat or activity required', 'validation');
    const category = await tx.category.findUnique({ where: { key: cat }, select: { sub: true } });
    activity = legacyActivity(amount, category?.sub ?? '');
  }
  const row = {
    name: input.name ?? current?.name ?? '',
    cat: fixedCat(activity) ?? cat,
    acct: input.acct ?? current?.acct ?? '',
    amount,
    note: input.note ?? current?.note ?? '',
    interest: input.interest ?? current?.interest ?? 0,
    fee: input.fee ?? current?.fee ?? 0,
    goal: input.goal ?? current?.goal ?? '',
    activity,
    item: input.item ?? current?.item ?? '',
  };
  const catSub = fixedCat(activity) === null ? (await tx.category.findUnique({ where: { key: row.cat }, select: { sub: true } }))?.sub : '';
  const touched = input.activity !== undefined || input.item !== undefined;
  const problem = checkActivity(row, catSub, { requireItem: current ? touched : input.activity !== undefined });
  if (problem) throw badRequest(problem, 'activityMismatch');
  await assertActivityRefs(tx, row, current ? { acct: input.acct !== undefined, item: touched } : undefined);
  return row;
}

export async function createTransaction(body: unknown): Promise<TxView> {
  const { date, ...input } = parseBody(txSchema, body);
  const row = await prisma.$transaction(async (tx) => tx.transaction.create({ data: { ...(await resolveRow(tx, input)), date: toDate(date) ?? today() } }));
  return toTxView(toPlain(row), today());
}

const batchSchema = z.object({ items: z.array(txSchema).min(1).max(500) });

/** Creates all items in one database transaction: any invalid item rejects the whole batch. */
export async function createTransactions(body: unknown): Promise<TxView[]> {
  const { items } = parseBody(batchSchema, body);
  const fallback = today();
  const dated = items.map(({ date, ...input }) => ({ input, date: toDate(date) ?? fallback }));
  const rows = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const { input, date } of dated) out.push(await tx.transaction.create({ data: { ...(await resolveRow(tx, input)), date } }));
    return out;
  });
  return rows.map((t) => toTxView(toPlain(t), fallback));
}

const deleteSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) });

/** Deletes every listed id in one statement; unknown ids are skipped. */
export async function deleteTransactions(body: unknown): Promise<{ deleted: number }> {
  const { ids } = parseBody(deleteSchema, body);
  const { count } = await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
  return { deleted: count };
}

export async function updateTransaction(id: number, body: unknown): Promise<TxView> {
  const { date, ...input } = parseBody(txSchema.partial(), body);
  const when = toDate(date);
  const row = await prisma.$transaction(async (tx) => {
    const found = await tx.transaction.findUnique({ where: { id } });
    if (!found) throw notFound();
    return tx.transaction.update({ where: { id }, data: { ...(await resolveRow(tx, input, toPlain(found))), date: when } });
  });
  return toTxView(toPlain(row), today());
}

export async function deleteTransaction(id: number): Promise<void> {
  await prisma.transaction.delete({ where: { id } });
}

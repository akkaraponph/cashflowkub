import { z } from 'zod';
import { prisma } from '@/lib/db';
import { today } from '@/lib/clock';
import type { Prisma } from '@/generated/prisma/client';
import { badRequest, notFound } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { parseFlexDate, toTxView, type TxFilter, type TxView } from './logic';

const txSchema = z.object({
  name: z.string().trim().min(1),
  cat: z.string().min(1),
  acct: z.string().min(1),
  amount: z.number().int().refine((n) => n !== 0, 'amount must not be zero'),
  note: z.string().optional(),
  date: z.string().optional(),
});

function toDate(raw: string | undefined): Date | undefined {
  if (raw === undefined) return undefined;
  const d = parseFlexDate(raw);
  if (!d) throw badRequest(`invalid date: ${raw}`);
  return d;
}

export async function listTransactions(f: TxFilter): Promise<TxView[]> {
  const where: Prisma.TransactionWhereInput = {};
  if (f.type === 'income') where.amount = { gt: 0 };
  if (f.type === 'expense') where.amount = { lt: 0 };
  if (f.category) where.cat = f.category;
  if (f.account) where.acct = f.account;
  if (f.from || f.to) where.date = { gte: f.from, lte: f.to };
  const rows = await prisma.transaction.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: f.limit });
  const now = today();
  return rows.map((t) => toTxView(t, now));
}

export async function getTransaction(id: number): Promise<TxView> {
  const row = await prisma.transaction.findUnique({ where: { id } });
  if (!row) throw notFound();
  return toTxView(row, today());
}

export async function createTransaction(body: unknown): Promise<TxView> {
  const { date, ...input } = parseBody(txSchema, body);
  const row = await prisma.transaction.create({ data: { ...input, date: toDate(date) ?? today() } });
  return toTxView(row, today());
}

export async function updateTransaction(id: number, body: unknown): Promise<TxView> {
  const { date, ...input } = parseBody(txSchema.partial(), body);
  const row = await prisma.transaction.update({ where: { id }, data: { ...input, date: toDate(date) } });
  return toTxView(row, today());
}

export async function deleteTransaction(id: number): Promise<void> {
  await prisma.transaction.delete({ where: { id } });
}

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { CURRENT_MONTH, todayDay } from '@/lib/clock';
import { notFound } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { toBillView, type BillView } from '@/server/views';
import { applyPaid, buildBillSummary, type BillSummary } from './logic';

const text = z.string().optional();
const billSchema = z.object({
  name: z.string().trim().min(1),
  th: text, icon: text, tint: text,
  amount: z.number().int().nonnegative(),
  dueDay: z.number().int().min(1).max(31),
  paid: z.boolean().optional(),
  freq: z.enum(['monthly', 'once']).optional(),
  cat: text,
  kind: z.enum(['bill', 'subscription']).optional(),
  sort: z.number().int().optional(),
});
const toggleSchema = z.object({ paid: z.boolean().optional() });
const ORDER = [{ dueDay: 'asc' as const }, { sort: 'asc' as const }];

export async function listBills(status?: string, kind?: string): Promise<BillView[]> {
  const where = {
    ...(status === 'paid' ? { paid: true } : status === 'unpaid' ? { paid: false } : {}),
    ...(kind === 'bill' || kind === 'subscription' ? { kind } : {}),
  };
  const rows = await prisma.bill.findMany({ where, orderBy: ORDER });
  const day = todayDay();
  return rows.map((b) => toBillView(b, day));
}

export async function getBillSummary(): Promise<BillSummary> {
  const [bills, days] = await Promise.all([
    prisma.bill.findMany({ orderBy: ORDER }),
    prisma.daySpend.findMany({ where: { month: CURRENT_MONTH }, orderBy: { day: 'asc' } }),
  ]);
  return buildBillSummary(bills, days, todayDay(), CURRENT_MONTH);
}

export async function toggleBillPaid(id: number, body: unknown): Promise<BillView> {
  const { paid } = parseBody(toggleSchema, body);
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) throw notFound();
  const saved = await prisma.bill.update({ where: { id }, data: { paid: applyPaid(bill, paid).paid } });
  return toBillView(saved, todayDay());
}

export async function createBill(body: unknown): Promise<BillView> {
  return toBillView(await prisma.bill.create({ data: parseBody(billSchema, body) }), todayDay());
}

export async function updateBill(id: number, body: unknown): Promise<BillView> {
  return toBillView(await prisma.bill.update({ where: { id }, data: parseBody(billSchema.partial(), body) }), todayDay());
}

export async function deleteBill(id: number): Promise<void> {
  await prisma.bill.delete({ where: { id } });
}

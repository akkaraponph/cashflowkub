import { z } from 'zod';
import type { Bill } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { isMonth, occursIn } from '@/lib/bill-schedule';
import { CURRENT_MONTH, today, todayDay } from '@/lib/clock';
import { badRequest, notFound } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { toBillView, type BillView } from '@/server/views';
import { buildBillSummary, type BillSummary } from './logic';

const text = z.string().optional();
const month = z.string().refine(isMonth, 'must be a month like 2026-06');
const billFields = z.object({
  name: z.string().trim().min(1),
  th: text, icon: text, tint: text,
  amount: z.number().int().nonnegative(),
  dueDay: z.number().int().min(1).max(31),
  freq: z.enum(['monthly', 'once']).optional(),
  cat: text,
  kind: z.enum(['bill', 'subscription']).optional(),
  startMonth: month.optional(),
  endMonth: z.union([z.literal(''), month]).optional(),
  everyMonths: z.number().int().min(1).max(12).optional(),
  sort: z.number().int().optional(),
});
const endAfterStart = (b: { startMonth?: string; endMonth?: string }): boolean =>
  b.startMonth === undefined || b.endMonth === undefined || b.endMonth === '' || b.endMonth >= b.startMonth;
const END_MSG = { message: 'endMonth must not be before startMonth', path: ['endMonth'] };
const createSchema = billFields.refine(endAfterStart, END_MSG);
const updateSchema = billFields.partial();
const payBody = z.object({ paid: z.boolean().optional(), month: month.optional() });
const ORDER = [{ dueDay: 'asc' as const }, { sort: 'asc' as const }];

/** `month` query/body values: absent means the current month, malformed is a 400. */
function monthOrCurrent(raw: string | undefined): string {
  if (raw === undefined) return CURRENT_MONTH;
  if (!isMonth(raw)) throw badRequest('invalid month', 'validation');
  return raw;
}

type BillWithPayments = Bill & { payments: { month: string }[] };

function viewsFor(rows: BillWithPayments[], m: string): BillView[] {
  const now = today();
  return rows
    .filter((b) => occursIn(b, m))
    .map((b) => toBillView(b, { month: m, paid: b.payments.length > 0, today: now }));
}

const forMonth = (m: string) => ({ payments: { where: { month: m }, select: { month: true } } });

export async function listBills(opts: { month?: string; status?: 'paid' | 'unpaid'; kind?: string } = {}): Promise<BillView[]> {
  const m = monthOrCurrent(opts.month);
  const rows = await prisma.bill.findMany({
    where: opts.kind === 'bill' || opts.kind === 'subscription' ? { kind: opts.kind } : {},
    orderBy: ORDER,
    include: forMonth(m),
  });
  const views = viewsFor(rows, m);
  return opts.status === 'paid' ? views.filter((b) => b.paid) : opts.status === 'unpaid' ? views.filter((b) => !b.paid) : views;
}

export async function getBillSummary(rawMonth?: string): Promise<BillSummary> {
  const m = monthOrCurrent(rawMonth);
  const [rows, days] = await Promise.all([
    prisma.bill.findMany({ orderBy: ORDER, include: forMonth(m) }),
    prisma.daySpend.findMany({ where: { month: m }, orderBy: { day: 'asc' } }),
  ]);
  return buildBillSummary(viewsFor(rows, m), days, todayDay(), m);
}

/** Marks a bill paid (or unpaid) for one month. `paid` omitted toggles. */
export async function toggleBillPaid(id: number, body: unknown): Promise<BillView> {
  const parsed = parseBody(payBody, body);
  const m = monthOrCurrent(parsed.month);
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) throw notFound();
  if (!occursIn(bill, m)) throw badRequest('bill does not occur in that month', 'billNotInMonth');
  const existing = await prisma.billPayment.findUnique({ where: { billId_month: { billId: id, month: m } } });
  const paid = parsed.paid ?? !existing;
  if (paid && !existing) await prisma.billPayment.create({ data: { billId: id, month: m } });
  if (!paid && existing) await prisma.billPayment.delete({ where: { id: existing.id } });
  return toBillView(bill, { month: m, paid, today: today() });
}

const currentView = (b: Bill, paid: boolean): BillView => toBillView(b, { month: CURRENT_MONTH, paid, today: today() });

export async function createBill(body: unknown): Promise<BillView> {
  const data = parseBody(createSchema, body);
  return currentView(await prisma.bill.create({ data: { ...data, startMonth: data.startMonth ?? CURRENT_MONTH } }), false);
}

export async function updateBill(id: number, body: unknown): Promise<BillView> {
  const data = parseBody(updateSchema, body);
  const current = await prisma.bill.findUnique({ where: { id } });
  if (!current) throw notFound();
  const merged = { startMonth: data.startMonth ?? current.startMonth, endMonth: data.endMonth ?? current.endMonth };
  if (!endAfterStart(merged)) throw badRequest('endMonth must not be before startMonth', 'validation');
  const saved = await prisma.bill.update({ where: { id }, data });
  const paid = (await prisma.billPayment.count({ where: { billId: id, month: CURRENT_MONTH } })) > 0;
  return currentView(saved, paid);
}

export async function deleteBill(id: number): Promise<void> {
  await prisma.bill.delete({ where: { id } });
}

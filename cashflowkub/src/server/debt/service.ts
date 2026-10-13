import { z } from 'zod';
import { prisma } from '@/lib/db';
import { notFound } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { toDebtView, type DebtView } from '@/server/views';
import { applyPayment, buildSchedule, type ScheduleView } from './logic';

const text = z.string().optional();
const debtSchema = z.object({
  name: z.string().trim().min(1),
  th: text, icon: text, tint: text,
  original: z.number().int().positive(),
  paid: z.number().int().nonnegative().optional(),
  apr: z.number().min(0).max(1000).optional(),
  monthly: z.number().int().nonnegative().optional(),
  calc: z.enum(['flat', 'reducing']).optional(),
  payoff: text, payoffTh: text,
  monthsLeft: z.number().int().nonnegative().optional(),
  done: z.boolean().optional(),
  revolving: z.boolean().optional(),
  sort: z.number().int().optional(),
});
const paySchema = z.object({ amount: z.number().int().nonnegative().optional() });

async function findDebt(id: number) {
  const row = await prisma.debt.findUnique({ where: { id } });
  if (!row) throw notFound();
  return row;
}

export async function listDebts(status?: string): Promise<DebtView[]> {
  const where = status === 'active' ? { done: false } : status === 'paid' ? { done: true } : {};
  const rows = await prisma.debt.findMany({ where, orderBy: [{ done: 'asc' }, { sort: 'asc' }] });
  return rows.map(toDebtView);
}

export async function listActiveDebtViews(): Promise<DebtView[]> {
  const rows = await prisma.debt.findMany({ where: { done: false }, orderBy: { sort: 'asc' } });
  return rows.map(toDebtView);
}

export async function getDebt(id: number): Promise<DebtView> {
  return toDebtView(await findDebt(id));
}

export async function getDebtSchedule(id: number): Promise<ScheduleView> {
  return buildSchedule(await findDebt(id));
}

export async function payDebt(id: number, body: unknown): Promise<DebtView> {
  const { amount = 0 } = parseBody(paySchema, body);
  const next = applyPayment(await findDebt(id), amount);
  const saved = await prisma.debt.update({ where: { id }, data: { paid: next.paid, done: next.done, monthsLeft: next.monthsLeft } });
  return toDebtView(saved);
}

export async function createDebt(body: unknown): Promise<DebtView> {
  return toDebtView(await prisma.debt.create({ data: parseBody(debtSchema, body) }));
}

export async function updateDebt(id: number, body: unknown): Promise<DebtView> {
  return toDebtView(await prisma.debt.update({ where: { id }, data: parseBody(debtSchema.partial(), body) }));
}

export async function deleteDebt(id: number): Promise<void> {
  await prisma.debt.delete({ where: { id } });
}

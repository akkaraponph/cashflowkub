import { z } from 'zod';
import { prisma } from '@/lib/db';
import { today } from '@/lib/clock';
import type { DebtPayment, Prisma } from '@/generated/prisma/client';
import { badRequest, HttpError, notFound } from '@/server/errors';
import { parseFlexDate } from '@/server/transaction/logic';
import { parseBody } from '@/server/validate';
import { toDebtView, type DebtView } from '@/server/views';
import { buildSchedule, type ScheduleView } from './logic';
import { isoDate } from './cycle';
import { splitPayment } from './payment';
import { assertDebtNameFree, assertDebtUnused, renameDebtInTransactions } from './refs';
import { deriveFixedApr } from './terms';

export const DEBT_KINDS = ['paylater', 'cashloan', 'bankloan', 'creditcard', 'personal'] as const;
export type DebtKind = (typeof DEBT_KINDS)[number];

const text = z.string().optional();
const money = z.number().int().nonnegative().optional();
const debtFields = z.object({
  name: z.string().trim().min(1),
  th: text, icon: text, tint: text,
  kind: z.enum(DEBT_KINDS).optional(),
  lender: text,
  original: z.number().int().positive(),
  openingPaid: money,
  apr: z.number().min(0).max(200).optional(),
  calc: z.enum(['flat', 'reducing', 'fixed']).optional(),
  monthly: money,
  fixedPayment: money,
  termMonths: z.number().int().min(0).max(600).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  graceDays: z.number().int().min(0).max(60).optional(),
  lateFee: money,
  penaltyApr: z.number().min(0).max(200).optional(),
  revolving: z.boolean().optional(),
  sort: z.number().int().optional(),
});
const paymentSchema = z.object({
  amount: z.number().int().positive(),
  date: z.string().optional(),
  note: z.string().max(200).optional(),
});

export interface PaymentView {
  id: number;
  debtId: number;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
  principal: number;
  interest: number;
  fee: number;
  note: string;
}

export interface DebtDetail extends ScheduleView {
  payments: PaymentView[];
}

const withPayments = { payments: { orderBy: [{ date: 'asc' as const }, { id: 'asc' as const }] } };
const toPaymentView = (p: DebtPayment): PaymentView => ({ ...p, date: isoDate(p.date) });

async function findDebt(id: number, db: Prisma.TransactionClient = prisma) {
  const row = await db.debt.findUnique({ where: { id }, include: withPayments });
  if (!row) throw notFound();
  return row;
}

/** Serialises writers of one debt: row lock held until the surrounding transaction ends. */
async function lockDebt(db: Prisma.TransactionClient, id: number): Promise<void> {
  const rows = await db.$queryRaw<{ id: number }[]>`SELECT id FROM debts WHERE id = ${id} FOR UPDATE`;
  if (rows.length === 0) throw notFound();
}

/** Recomputes paid/done from the opening balance plus the ledger. */
async function syncPaid(db: Prisma.TransactionClient, id: number) {
  const debt = await findDebt(id, db);
  const principal = debt.payments.reduce((s, p) => s + p.principal, 0);
  const paid = Math.min(debt.original, debt.openingPaid + principal);
  return db.debt.update({ where: { id }, data: { paid, done: paid >= debt.original }, include: withPayments });
}

export async function listDebts(status?: string): Promise<DebtView[]> {
  const where = status === 'active' ? { done: false } : status === 'paid' ? { done: true } : {};
  const rows = await prisma.debt.findMany({ where, orderBy: [{ done: 'asc' }, { sort: 'asc' }], include: withPayments });
  const now = today();
  return rows.map((d) => toDebtView(d, now));
}

export async function listActiveDebtViews(): Promise<DebtView[]> {
  return listDebts('active');
}

export async function getDebt(id: number): Promise<DebtView> {
  return toDebtView(await findDebt(id), today());
}

export async function getDebtSchedule(id: number): Promise<ScheduleView> {
  return buildSchedule(await findDebt(id), today());
}

export async function getDebtDetail(id: number): Promise<DebtDetail> {
  const debt = await findDebt(id);
  return { ...buildSchedule(debt, today()), payments: [...debt.payments].reverse().map(toPaymentView) };
}

export async function listPayments(debtId: number): Promise<PaymentView[]> {
  return (await getDebtDetail(debtId)).payments;
}

export async function recordPayment(debtId: number, body: unknown): Promise<{ payment: PaymentView; debt: DebtView; excess: number }> {
  const input = parseBody(paymentSchema, body);
  let date = today();
  if (input.date !== undefined) {
    const parsed = parseFlexDate(input.date);
    if (!parsed) throw badRequest(`invalid date: ${input.date}`, 'invalidDate');
    date = parsed;
  }
  return prisma.$transaction(async (tx) => {
    await lockDebt(tx, debtId);
    const debt = await findDebt(debtId, tx);
    if (debt.done) throw new HttpError(409, 'this debt is already paid off');
    const { excess, ...split } = splitPayment(debt, debt.payments, input.amount, date);
    const applied = split.fee + split.interest + split.principal;
    const created = await tx.debtPayment.create({ data: { debtId, date, amount: applied, ...split, note: input.note ?? '' } });
    const saved = await syncPaid(tx, debtId);
    return { payment: toPaymentView(created), debt: toDebtView(saved, today()), excess };
  });
}

export async function deletePayment(debtId: number, paymentId: number): Promise<DebtView> {
  return prisma.$transaction(async (tx) => {
    await lockDebt(tx, debtId);
    const found = await tx.debtPayment.findFirst({ where: { id: paymentId, debtId } });
    if (!found) throw notFound();
    await tx.debtPayment.delete({ where: { id: paymentId } });
    return toDebtView(await syncPaid(tx, debtId), today());
  });
}

/** For calc 'fixed' the rate is derived from the instalment x term, never taken from the client. */
function withFixedApr<T extends { original: number; calc: string; fixedPayment: number; termMonths: number }>(merged: T): { apr: number } | Record<string, never> {
  if (merged.calc !== 'fixed') return {};
  if (merged.fixedPayment <= 0 || merged.termMonths <= 0) {
    throw badRequest('a fixed instalment needs fixedPayment and termMonths', 'fixedTermsRequired');
  }
  if (merged.fixedPayment * merged.termMonths < merged.original) {
    throw badRequest('fixedPayment x termMonths cannot be less than original', 'fixedTotalBelowOriginal');
  }
  return { apr: deriveFixedApr(merged.original, merged.fixedPayment, merged.termMonths) };
}

export async function createDebt(body: unknown): Promise<DebtView> {
  const input = parseBody(debtFields, body);
  const openingPaid = input.openingPaid ?? 0;
  if (openingPaid > input.original) throw badRequest('openingPaid cannot exceed original', 'openingPaidExceeds');
  const fixed = withFixedApr({ original: input.original, calc: input.calc ?? 'reducing', fixedPayment: input.fixedPayment ?? 0, termMonths: input.termMonths ?? 0 });
  const row = await prisma.$transaction(async (tx) => {
    await assertDebtNameFree(tx, input.name);
    return tx.debt.create({ data: { ...input, ...fixed, paid: openingPaid, done: openingPaid >= input.original }, include: withPayments });
  });
  return toDebtView(row, today());
}

export async function updateDebt(id: number, body: unknown): Promise<DebtView> {
  const input = parseBody(debtFields.partial(), body);
  return prisma.$transaction(async (tx) => {
    await lockDebt(tx, id);
    const current = await findDebt(id, tx);
    const original = input.original ?? current.original;
    const openingPaid = input.openingPaid ?? current.openingPaid;
    if (openingPaid > original) throw badRequest('openingPaid cannot exceed original', 'openingPaidExceeds');
    const ledger = current.payments.reduce((sum, p) => sum + p.principal, 0);
    if (original < openingPaid + ledger) throw badRequest('original cannot be below principal already repaid', 'originalBelowRepaid');
    const fixed = withFixedApr({
      original,
      calc: input.calc ?? current.calc,
      fixedPayment: input.fixedPayment ?? current.fixedPayment,
      termMonths: input.termMonths ?? current.termMonths,
    });
    if (input.name !== undefined && input.name !== current.name) {
      await assertDebtNameFree(tx, input.name, id);
      await renameDebtInTransactions(tx, current.name, input.name);
    }
    await tx.debt.update({ where: { id }, data: { ...input, ...fixed } });
    return toDebtView(await syncPaid(tx, id), today());
  });
}

export async function deleteDebt(id: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockDebt(tx, id);
    await assertDebtUnused(tx, (await findDebt(id, tx)).name);
    await tx.debt.delete({ where: { id } });
  });
}

/** Names for the transaction sheet's debt picker. */
export function listDebtNames(): Promise<{ name: string; done: boolean }[]> {
  return prisma.debt.findMany({ select: { name: true, done: true }, orderBy: { sort: 'asc' } });
}

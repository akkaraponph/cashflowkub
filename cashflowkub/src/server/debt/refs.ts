// Debts are referenced by NAME from transactions (the row's `item`), so renaming and deleting need extra rules.
import type { Prisma } from '@/generated/prisma/client';
import { conflict } from '@/server/errors';

type Tx = Prisma.TransactionClient;

/** Debt names must be unique ignoring case and surrounding spaces, because transactions point at the name. */
export async function assertDebtNameFree(tx: Tx, name: string, exceptId?: number): Promise<void> {
  const clash = await tx.debt.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
    select: { id: true },
  });
  if (clash) throw conflict('debt name already exists', 'debtNameTaken');
}

export async function renameDebtInTransactions(tx: Tx, from: string, to: string): Promise<void> {
  await tx.transaction.updateMany({ where: { activity: 'pay_debt', item: from }, data: { item: to } });
}

/** Debt that transactions still use cannot be deleted; that would orphan them. */
export async function assertDebtUnused(tx: Tx, name: string): Promise<void> {
  if ((await tx.transaction.count({ where: { activity: 'pay_debt', item: name } })) > 0) throw conflict('debt is used by transactions', 'debtInUse');
}

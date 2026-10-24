// Income items are referenced by NAME from transactions (the row's `item`), so renaming and deleting need extra rules.
import type { DbTx } from '@/lib/db';
import { conflict } from '@/server/errors';

type Tx = DbTx;

/** Income item names must be unique ignoring case and surrounding spaces, because transactions point at the name. */
export async function assertIncomeNameFree(tx: Tx, name: string, exceptId?: number): Promise<void> {
  const clash = await tx.incomeCategory.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
    select: { id: true },
  });
  if (clash) throw conflict('income item name already exists', 'incomeNameTaken');
}

export async function renameIncomeInTransactions(tx: Tx, from: string, to: string): Promise<void> {
  await tx.transaction.updateMany({ where: { activity: 'receive', item: from }, data: { item: to } });
}

/** Income item that transactions still use cannot be deleted; that would orphan them. */
export async function assertIncomeUnused(tx: Tx, name: string): Promise<void> {
  if ((await tx.transaction.count({ where: { activity: 'receive', item: name } })) > 0) throw conflict('income item is used by transactions', 'incomeInUse');
}

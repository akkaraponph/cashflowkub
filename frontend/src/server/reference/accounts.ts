// Accounts are referenced by NAME from transactions, so renaming and deleting need extra rules.
import type { DbTx } from '@/lib/db';
import { conflict } from '@/server/errors';

type Tx = DbTx;

/** Account names must be unique ignoring case and surrounding spaces, because transactions point at the name. */
export async function assertAccountNameFree(tx: Tx, name: string, exceptId?: number): Promise<void> {
  const clash = await tx.account.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
    select: { id: true },
  });
  if (clash) throw conflict('account name already exists', 'accountNameTaken');
}

export async function renameAccountInTransactions(tx: Tx, from: string, to: string): Promise<void> {
  await tx.transaction.updateMany({ where: { acct: from }, data: { acct: to } });
  await tx.transaction.updateMany({ where: { activity: 'transfer', item: from }, data: { item: to } });
}

/** An account that transactions still use, as the account or as a transfer's source, cannot be deleted; that would orphan them. */
export async function assertAccountUnused(tx: Tx, name: string): Promise<void> {
  if ((await tx.transaction.count({ where: { OR: [{ acct: name }, { activity: 'transfer', item: name }] } })) > 0) throw conflict('account is used by transactions', 'accountInUse');
}

// Accounts are referenced by NAME from transactions, so renaming and deleting need extra rules.
import type { Prisma } from '@/generated/prisma/client';
import { conflict } from '@/server/errors';

type Tx = Prisma.TransactionClient;

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
}

/** An account that transactions still use cannot be deleted; that would orphan them. */
export async function assertAccountUnused(tx: Tx, name: string): Promise<void> {
  if ((await tx.transaction.count({ where: { acct: name } })) > 0) throw conflict('account is used by transactions', 'accountInUse');
}

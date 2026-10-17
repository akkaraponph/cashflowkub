// Goals are referenced by NAME from transactions (the savings goal tag), so renaming and deleting need extra rules.
import type { Prisma } from '@/generated/prisma/client';
import { conflict } from '@/server/errors';

type Tx = Prisma.TransactionClient;

/** Goal names must be unique ignoring case and surrounding spaces, because transactions point at the name. */
export async function assertGoalNameFree(tx: Tx, name: string, exceptId?: number): Promise<void> {
  const clash = await tx.goal.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
    select: { id: true },
  });
  if (clash) throw conflict('goal name already exists', 'goalNameTaken');
}

export async function renameGoalInTransactions(tx: Tx, from: string, to: string): Promise<void> {
  await tx.transaction.updateMany({ where: { goal: from }, data: { goal: to } });
}

/** A goal that transactions are still tagged with cannot be deleted; that would orphan the tags. */
export async function assertGoalUnused(tx: Tx, name: string): Promise<void> {
  if ((await tx.transaction.count({ where: { goal: name } })) > 0) throw conflict('goal is used by transactions', 'goalInUse');
}

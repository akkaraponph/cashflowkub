// Channels are referenced by NAME from transactions (the row's `item`), so renaming and deleting need extra rules.
import type { DbTx } from '@/lib/db';
import { conflict } from '@/server/errors';

type Tx = DbTx;

/** Channel names must be unique ignoring case and surrounding spaces, because transactions point at the name. */
export async function assertChannelNameFree(tx: Tx, name: string, exceptId?: number): Promise<void> {
  const clash = await tx.channel.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
    select: { id: true },
  });
  if (clash) throw conflict('channel name already exists', 'channelNameTaken');
}

export async function renameChannelInTransactions(tx: Tx, from: string, to: string): Promise<void> {
  await tx.transaction.updateMany({ where: { activity: { in: ['save', 'withdraw'] }, item: from }, data: { item: to } });
}

/** Channel that transactions still use cannot be deleted; that would orphan them. */
export async function assertChannelUnused(tx: Tx, name: string): Promise<void> {
  if ((await tx.transaction.count({ where: { activity: { in: ['save', 'withdraw'] }, item: name } })) > 0) throw conflict('channel is used by transactions', 'channelInUse');
}

// Checks that a transaction row's account and item point at things that exist.
import { itemListFor, type Activity } from '@/lib/activity';
import type { Prisma } from '@/generated/prisma/client';
import { badRequest } from '@/server/errors';

type Tx = Prisma.TransactionClient;

const named = (name: string) => ({ name: { equals: name.trim(), mode: 'insensitive' as const } });

/** `only` limits the check to the fields a PATCH actually touched, so a legacy row's stale references do not block unrelated edits. */
export async function assertActivityRefs(
  tx: Tx,
  row: { activity: Activity; acct: string; item: string },
  only: { acct: boolean; item: boolean } = { acct: true, item: true },
): Promise<void> {
  if (only.acct && !(await tx.account.findFirst({ where: named(row.acct), select: { id: true } }))) {
    throw badRequest('unknown account', 'unknownAccount');
  }
  const list = itemListFor(row.activity);
  if (!only.item || list === null || row.item.trim() === '') return;
  const where = named(row.item);
  const found =
    list === 'income' ? await tx.incomeCategory.findFirst({ where, select: { id: true } })
    : list === 'channel' ? await tx.channel.findFirst({ where, select: { id: true } })
    : list === 'debt' ? await tx.debt.findFirst({ where, select: { id: true } })
    : await tx.account.findFirst({ where, select: { id: true } });
  if (!found) throw badRequest('unknown item', 'unknownItem');
}

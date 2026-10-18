// Checks that a transaction row's account and item point at things that exist.
import { itemListFor, type Activity } from '@/lib/activity';
import type { Prisma } from '@/generated/prisma/client';
import { badRequest } from '@/server/errors';

type Tx = Prisma.TransactionClient;

const named = (name: string) => ({ name: { equals: name.trim(), mode: 'insensitive' as const } });

/**
 * Returns the stored spelling of the account and item, so rename and in-use checks that compare names exactly keep finding the row.
 * `only` limits the check to the fields a PATCH actually touched, so a legacy row's stale references do not block unrelated edits. */
export async function assertActivityRefs(
  tx: Tx,
  row: { activity: Activity; acct: string; item: string },
  only: { acct: boolean; item: boolean } = { acct: true, item: true },
): Promise<{ acct: string; item: string }> {
  let acct = row.acct;
  if (only.acct) {
    const found = await tx.account.findFirst({ where: named(row.acct), select: { name: true } });
    if (!found) throw badRequest('unknown account', 'unknownAccount');
    acct = found.name;
  }
  const list = itemListFor(row.activity);
  if (!only.item || list === null || row.item.trim() === '') return { acct, item: row.item };
  const where = named(row.item);
  const select = { name: true };
  const found =
    list === 'income' ? await tx.incomeCategory.findFirst({ where, select })
    : list === 'channel' ? await tx.channel.findFirst({ where, select })
    : list === 'debt' ? await tx.debt.findFirst({ where, select })
    : await tx.account.findFirst({ where, select });
  if (!found) throw badRequest('unknown item', 'unknownItem');
  return { acct, item: found.name };
}

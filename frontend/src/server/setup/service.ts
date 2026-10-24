import { prisma } from '@/lib/db';
import { listActiveDebtViews } from '@/server/debt/service';
import { buildSetup, type SetupView } from './logic';

const bySort = { orderBy: { sort: 'asc' as const } };

export async function getSetup(): Promise<SetupView> {
  const [categories, incomeSources, channels, accounts, activeDebts, setupGoals] = await Promise.all([
    prisma.category.findMany(bySort),
    prisma.incomeCategory.findMany(bySort),
    prisma.channel.findMany(bySort),
    prisma.account.findMany(bySort),
    listActiveDebtViews(),
    prisma.setupGoal.findMany({ ...bySort, include: { channels: { orderBy: { id: 'asc' } } } }),
  ]);
  return buildSetup({ categories, incomeSources, channels, accounts, activeDebts, setupGoals });
}

import type { PrismaClient } from '../src/generated/prisma/client';
import * as data from './seed-data';

const TABLES = [
  'debt_payments', 'settings', 'setup_goal_channels', 'setup_goals', 'day_spends', 'monthly_cashflows', 'net_worth_histories',
  'asset_snapshots', 'plan_items', 'income_categories', 'channels', 'bills', 'assets', 'debts',
  'goals', 'budgets', 'transactions', 'categories', 'accounts',
];

/** Replaces all data with the canonical demo set. Idempotent; ids restart at 1. */
export async function seedDatabase(db: PrismaClient): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    await tx.category.createMany({ data: data.categories });
    await tx.account.createMany({ data: data.accounts });
    await tx.transaction.createMany({ data: data.transactions });
    await tx.budget.createMany({ data: data.budgets });
    await tx.goal.createMany({ data: data.goals });
    await tx.debt.createMany({ data: data.debts });
    await tx.debtPayment.createMany({ data: data.debtPayments });
    await tx.setting.createMany({ data: data.settings });
    await tx.asset.createMany({ data: data.assets });
    await tx.bill.createMany({ data: data.bills });
    await tx.channel.createMany({ data: data.channels });
    await tx.incomeCategory.createMany({ data: data.incomeCategories });
    await tx.planItem.createMany({ data: data.planItems });
    await tx.assetSnapshot.createMany({ data: data.assetSnapshots });
    await tx.netWorthHistory.createMany({ data: data.netWorthHistory });
    await tx.monthlyCashflow.createMany({ data: data.monthlyCashflow });
    await tx.daySpend.createMany({ data: data.daySpend });
    for (const { channels, ...goal } of data.setupGoals) {
      await tx.setupGoal.create({ data: { ...goal, channels: { create: channels } } });
    }
  });
}

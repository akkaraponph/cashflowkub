import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import type { PrismaClient } from '../src/generated/prisma/client';
import { CURRENT_MONTH } from '../src/lib/clock';
import { runAsSystem } from '../src/lib/user-context';
import { PRIVACY_VERSION } from '../src/lib/privacy';
import * as data from './seed-data';

export const DEMO_EMAIL = 'demo@cashflowkub.local';
const DEMO_NAME = 'Ploy';

const TABLES = [
  'debt_payments', 'settings', 'setup_goal_channels', 'setup_goals', 'day_spends', 'monthly_cashflows', 'net_worth_histories',
  'asset_snapshots', 'plan_items', 'income_categories', 'channels', 'bill_payments', 'bills', 'assets', 'debts',
  'goals', 'budgets', 'transactions', 'categories', 'accounts',
  'verifications', 'auth_accounts', 'sessions', 'users',
];

/**
 * Replaces all data, every user included, with the canonical demo set owned by the demo user
 * (demo@cashflowkub.local, password from SEED_DEMO_PASSWORD). Idempotent; ids restart at 1.
 * Takes the unscoped client: it writes userId itself.
 */
export async function seedDatabase(db: PrismaClient): Promise<void> {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error('SEED_DEMO_PASSWORD is not set (see .env.example)');
  const hash = await hashPassword(password);
  await runAsSystem(() =>
    db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
      const userId = randomUUID();
      await tx.user.create({
        data: { id: userId, name: DEMO_NAME, email: DEMO_EMAIL, privacyVersion: PRIVACY_VERSION, privacyAcceptedAt: new Date() },
      });
      await tx.authAccount.create({ data: { id: randomUUID(), userId, providerId: 'credential', accountId: userId, password: hash } });

      const own = <T extends object>(rows: T[]): (T & { userId: string })[] => rows.map((row) => ({ ...row, userId }));
      await tx.category.createMany({ data: own(data.DEFAULT_CATEGORIES) });
      await tx.account.createMany({ data: own(data.accounts) });
      await tx.transaction.createMany({ data: own(data.transactions) });
      await tx.budget.createMany({ data: own(data.budgets) });
      await tx.goal.createMany({ data: own(data.goals) });
      await tx.debt.createMany({ data: own(data.debts) });
      await tx.debtPayment.createMany({ data: own(data.debtPayments) });
      await tx.setting.createMany({ data: own(data.settings) });
      await tx.asset.createMany({ data: own(data.assets) });
      await tx.bill.createMany({ data: own(data.bills) });
      // The seed marks bills paid with `paid: true`; per-month payment rows are what the app reads.
      const paidIds = (await tx.bill.findMany({ where: { userId, paid: true }, select: { id: true } })).map((b) => b.id);
      await tx.billPayment.createMany({ data: own(paidIds.map((billId) => ({ billId, month: CURRENT_MONTH }))) });
      await tx.channel.createMany({ data: own(data.channels) });
      await tx.incomeCategory.createMany({ data: own(data.incomeCategories) });
      await tx.planItem.createMany({ data: own(data.planItems) });
      await tx.assetSnapshot.createMany({ data: own(data.assetSnapshots) });
      await tx.netWorthHistory.createMany({ data: own(data.netWorthHistory) });
      await tx.monthlyCashflow.createMany({ data: own(data.monthlyCashflow) });
      await tx.daySpend.createMany({ data: own(data.daySpend) });
      for (const { channels, ...goal } of data.setupGoals) {
        // Nested rows are not seen by the tenancy extension: each channel names its owner here.
        await tx.setupGoal.create({ data: { ...goal, userId, channels: { create: own(channels) } } });
      }
    }),
  );
}

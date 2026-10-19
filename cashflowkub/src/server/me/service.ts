// The signed-in user's own account data.
import { prisma } from '@/lib/db';
import { requireUserId } from '@/lib/user-context';
import { DEFAULT_CATEGORIES } from '../../../prisma/seed-data';

/**
 * Gives a user the default categories. Runs inside runAsUser(userId), so the scoped client checks the owner.
 * Idempotent (skipDuplicates), so it can also repair a sign-up whose after-hook failed.
 */
export async function defaultDataFor(userId: string): Promise<void> {
  await prisma.category.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })), skipDuplicates: true });
}

export type UserExport = {
  format: 'cashflowkub-export';
  version: 1;
  exported_at: string;
  privacy: { version: string; accepted_at: string };
  user: { email: string; name: string; created_at: string };
  data: Record<string, unknown[]>;
};

// Table key (the schema's @@map name) -> scoped Prisma delegate. The test pins this to OWNED_MODELS.
const TABLES = {
  accounts: 'Account', categories: 'Category', transactions: 'Transaction', budgets: 'Budget', goals: 'Goal', debts: 'Debt',
  debt_payments: 'DebtPayment', settings: 'Setting', assets: 'Asset', bills: 'Bill', bill_payments: 'BillPayment', channels: 'Channel',
  income_categories: 'IncomeCategory', plan_items: 'PlanItem', asset_snapshots: 'AssetSnapshot', net_worth_histories: 'NetWorthHistory',
  monthly_cashflows: 'MonthlyCashflow', day_spends: 'DaySpend', setup_goals: 'SetupGoal', setup_goal_channels: 'SetupGoalChannel',
} as const;

type Delegate = { findMany(): Promise<Record<string, unknown>[]> };

// Rows keep every column except userId: it is the caller's own id and redundant here. (http.ts strips it from API
// responses too, but this download is built outside those helpers, so the export drops it itself.)
const withoutOwner = (row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'userId'));

/** Everything the signed-in user owns, decrypted. Reads go through the scoped client, so only their rows come back. */
export async function exportUserData(): Promise<UserExport> {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, createdAt: true, privacyVersion: true, privacyAcceptedAt: true },
  });
  const client = prisma as unknown as Record<string, Delegate>;
  const entries = await Promise.all(
    Object.entries(TABLES).map(async ([table, model]) => {
      const rows = await client[model.charAt(0).toLowerCase() + model.slice(1)]!.findMany();
      return [table, rows.map(withoutOwner)] as const;
    }),
  );
  return {
    format: 'cashflowkub-export',
    version: 1,
    exported_at: new Date().toISOString(),
    privacy: { version: user.privacyVersion, accepted_at: user.privacyAcceptedAt.toISOString() },
    user: { email: user.email, name: user.name, created_at: user.createdAt.toISOString() },
    data: Object.fromEntries(entries),
  };
}

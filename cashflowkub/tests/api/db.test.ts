import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';

describe('database', () => {
  it('connects to the test database with every table migrated', async () => {
    const [{ current_database }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    expect(current_database).toBe('cashflowkub_test');
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
    expect(tables.map((t) => t.tablename)).toEqual([
      'accounts', 'asset_snapshots', 'assets', 'bills', 'budgets', 'categories', 'channels', 'day_spends',
      'debts', 'goals', 'income_categories', 'monthly_cashflows', 'net_worth_histories', 'plan_items',
      'setup_goal_channels', 'setup_goals', 'transactions',
    ]);
  });
});

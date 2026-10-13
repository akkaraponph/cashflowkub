import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { seedDatabase } from '../../prisma/seed-lib';

describe('seedDatabase', () => {
  beforeAll(async () => {
    await seedDatabase(prisma);
    await seedDatabase(prisma); // idempotent: second run must not duplicate rows or shift ids
  });

  it('loads the canonical row counts', async () => {
    expect({
      categories: await prisma.category.count(),
      accounts: await prisma.account.count(),
      transactions: await prisma.transaction.count(),
      budgets: await prisma.budget.count(),
      goals: await prisma.goal.count(),
      debts: await prisma.debt.count(),
      debtPayments: await prisma.debtPayment.count(),
      settings: await prisma.setting.count(),
      assets: await prisma.asset.count(),
      bills: await prisma.bill.count(),
      channels: await prisma.channel.count(),
      incomeCategories: await prisma.incomeCategory.count(),
      planItems: await prisma.planItem.count(),
      assetSnapshots: await prisma.assetSnapshot.count(),
      netWorthHistory: await prisma.netWorthHistory.count(),
      monthlyCashflow: await prisma.monthlyCashflow.count(),
      daySpend: await prisma.daySpend.count(),
      setupGoals: await prisma.setupGoal.count(),
      setupGoalChannels: await prisma.setupGoalChannel.count(),
    }).toEqual({
      categories: 7, accounts: 5, transactions: 12, budgets: 6, goals: 3, debts: 16, debtPayments: 6, settings: 1, assets: 8, bills: 13,
      channels: 9, incomeCategories: 9, planItems: 16, assetSnapshots: 14, netWorthHistory: 6,
      monthlyCashflow: 6, daySpend: 11, setupGoals: 6, setupGoalChannels: 11,
    });
  });

  it('keeps paid = openingPaid + ledger principal for every debt', async () => {
    const debts = await prisma.debt.findMany({ include: { payments: true } });
    for (const d of debts) {
      expect(d.paid, d.name).toBe(d.openingPaid + d.payments.reduce((s, p) => s + p.principal, 0));
    }
  });

  it('assigns deterministic ids', async () => {
    expect((await prisma.debt.findUniqueOrThrow({ where: { id: 1 } })).name).toBe('Student Loan (กยศ)');
    expect((await prisma.bill.findUniqueOrThrow({ where: { id: 6 } })).name).toBe('KTC Credit Card');
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: 3 } })).name).toBe('Grab');
  });

  it('stores transaction dates as calendar dates', async () => {
    const salary = await prisma.transaction.findUniqueOrThrow({ where: { id: 1 } });
    expect(salary.date.toISOString()).toBe('2026-06-18T00:00:00.000Z');
  });
});

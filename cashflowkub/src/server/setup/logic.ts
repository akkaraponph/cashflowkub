// Pure setup read model: partitions configured rows into the Financial Setup shape.
import type { Account, Category, Channel, IncomeCategory, Prisma } from '@/generated/prisma/client';
import type { DebtView } from '@/server/views';

export type SetupGoalRow = Prisma.SetupGoalGetPayload<{ include: { channels: true } }>;

export interface SetupInput {
  categories: Category[];
  incomeSources: IncomeCategory[];
  channels: Channel[];
  accounts: Account[];
  activeDebts: DebtView[];
  setupGoals: SetupGoalRow[];
}

export interface SetupView {
  incomeCategories: Category[];
  expenseCategories: Category[];
  incomeSources: IncomeCategory[];
  channels: Channel[];
  accounts: Account[];
  debts: { closing: DebtView[]; revolving: DebtView[] };
  goals: { emergency: SetupGoalRow | null; stocks: SetupGoalRow | null; retirement: SetupGoalRow | null; custom: SetupGoalRow[] };
}

export function buildSetup(input: SetupInput): SetupView {
  const kind = (k: string): SetupGoalRow | null => input.setupGoals.find((g) => g.kind === k) ?? null;
  return {
    incomeCategories: input.categories.filter((c) => c.type === 'income'),
    expenseCategories: input.categories.filter((c) => c.type !== 'income'),
    incomeSources: input.incomeSources,
    channels: input.channels,
    accounts: input.accounts,
    debts: {
      closing: input.activeDebts.filter((d) => !d.revolving),
      revolving: input.activeDebts.filter((d) => d.revolving),
    },
    goals: {
      emergency: kind('emergency'),
      stocks: kind('stocks'),
      retirement: kind('retirement'),
      custom: input.setupGoals.filter((g) => g.kind === 'custom'),
    },
  };
}

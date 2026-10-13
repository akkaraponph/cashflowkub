import { describe, expect, it } from 'vitest';
import { buildSetup } from '@/server/setup/logic';
import { toDebtView } from '@/server/views';
import { category, debt, setupGoal } from '../fixtures';

describe('buildSetup', () => {
  const v = buildSetup({
    categories: [category({ id: 1, type: 'expense' }), category({ id: 2, key: 'income', type: 'income' })],
    incomeSources: [],
    channels: [],
    accounts: [],
    activeDebts: [toDebtView(debt({ id: 1 })), toDebtView(debt({ id: 2, revolving: true }))],
    setupGoals: [setupGoal({ id: 1, kind: 'emergency' }), setupGoal({ id: 2, kind: 'custom' }), setupGoal({ id: 3, kind: 'custom' })],
  });
  it('splits categories by type', () => {
    expect(v.incomeCategories.map((c) => c.id)).toEqual([2]);
    expect(v.expenseCategories.map((c) => c.id)).toEqual([1]);
  });
  it('splits debts into closing and revolving', () => {
    expect(v.debts.closing.map((d) => d.id)).toEqual([1]);
    expect(v.debts.revolving.map((d) => d.id)).toEqual([2]);
  });
  it('picks the fixed goal kinds and lists custom ones; missing kinds are null', () => {
    expect(v.goals.emergency?.id).toBe(1);
    expect(v.goals.stocks).toBeNull();
    expect(v.goals.retirement).toBeNull();
    expect(v.goals.custom.map((g) => g.id)).toEqual([2, 3]);
  });
});

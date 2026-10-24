// Pure analytics: spending breakdown, net worth, debt roll-up, merchants, screen views.
import type { Asset, Budget, Category, Goal, MonthlyCashflow, NetWorthHistory } from '@/generated/prisma/client';
import type { TxPlain } from '@/server/transaction/logic';
import type { BillView, DebtView } from '@/server/views';

export interface CategorySpend {
  cat: string;
  label: string;
  th: string;
  tint: string;
  icon: string;
  spent: number;
  /** share of total, 0..100 */
  pct: number;
}

export interface Merchant {
  name: string;
  cat: string;
  total: number;
}

/** Budget order is preserved (callers pass budgets sorted by spend, high to low). */
export function spendingByCategory(budgets: Budget[], cats: Category[]): { items: CategorySpend[]; total: number } {
  const byKey = new Map(cats.map((c) => [c.key, c]));
  const total = budgets.reduce((s, b) => s + b.spent, 0);
  const items = budgets.map((b) => {
    const c = byKey.get(b.cat);
    return {
      cat: b.cat, label: c?.label ?? '', th: c?.th ?? '', tint: c?.tint ?? '', icon: c?.icon ?? '',
      spent: b.spent, pct: total > 0 ? (b.spent / total) * 100 : 0,
    };
  });
  return { items, total };
}

export function netWorthTotals(assets: Asset[], activeDebts: DebtView[]): { totalAssets: number; totalLiab: number; netWorth: number } {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiab = activeDebts.reduce((s, d) => s + d.remaining, 0);
  return { totalAssets, totalLiab, netWorth: totalAssets - totalLiab };
}

export function topMerchants(expenseTx: TxPlain[]): Merchant[] {
  const byName = new Map<string, Merchant>();
  for (const t of expenseTx) {
    const m = byName.get(t.name) ?? { name: t.name, cat: t.cat, total: 0 };
    m.total += -t.amount;
    m.cat = t.cat;
    byName.set(t.name, m);
  }
  return [...byName.values()].sort((a, b) => b.total - a.total).slice(0, 6);
}

export interface DebtSummary {
  original: number;
  paid: number;
  remaining: number;
  progress: number;
  /** highest-APR active debt (avalanche default) */
  focus: DebtView | null;
}

function debtRollup(activeDebts: DebtView[]): DebtSummary {
  let original = 0;
  let paid = 0;
  let remaining = 0;
  let focus: DebtView | null = null;
  for (const d of activeDebts) {
    original += d.original;
    paid += d.paid;
    remaining += d.original - d.paid;
    if (!focus || d.apr > focus.apr) focus = d;
  }
  return { original, paid, remaining, progress: original > 0 ? paid / original : 0, focus };
}

export interface DashboardInput {
  assets: Asset[];
  activeDebts: DebtView[];
  budgets: Budget[];
  categories: Category[];
  cashflow: MonthlyCashflow[];
  /** This month's unpaid bills, ordered by due day. */
  unpaidBills: BillView[];
  goals: Goal[];
  netWorthHist: NetWorthHistory[];
}

export interface DashboardView {
  netWorth: number;
  totalAssets: number;
  totalLiab: number;
  month: { income: number; expense: number; net: number };
  cashflow: MonthlyCashflow[];
  spending: CategorySpend[];
  spendTotal: number;
  debt: DebtSummary;
  nextBill: BillView | null;
  goals: Goal[];
  netWorthHist: NetWorthHistory[];
}

export function buildDashboard(input: DashboardInput): DashboardView {
  const totals = netWorthTotals(input.assets, input.activeDebts);
  const last = input.cashflow.at(-1);
  const income = last?.income ?? 0;
  const expense = last?.expense ?? 0;
  const { items, total } = spendingByCategory(input.budgets, input.categories);
  return {
    ...totals,
    month: { income, expense, net: income - expense },
    cashflow: input.cashflow,
    spending: items,
    spendTotal: total,
    debt: debtRollup(input.activeDebts),
    nextBill: input.unpaidBills[0] ?? null,
    goals: input.goals,
    netWorthHist: input.netWorthHist,
  };
}

export interface NetWorthView {
  netWorth: number;
  totalAssets: number;
  totalLiab: number;
  assets: Asset[];
  liabilities: DebtView[];
  history: NetWorthHistory[];
}

export function buildNetWorth(input: { assets: Asset[]; activeDebts: DebtView[]; history: NetWorthHistory[] }): NetWorthView {
  return {
    ...netWorthTotals(input.assets, input.activeDebts),
    assets: input.assets,
    liabilities: [...input.activeDebts].sort((a, b) => b.remaining - a.remaining),
    history: input.history,
  };
}

export interface ReportsView {
  breakdown: CategorySpend[];
  spendTotal: number;
  topMerchants: Merchant[];
  monthly: MonthlyCashflow[];
}

export function buildReports(input: { budgets: Budget[]; categories: Category[]; expenseTx: TxPlain[]; monthly: MonthlyCashflow[] }): ReportsView {
  const { items, total } = spendingByCategory(input.budgets, input.categories);
  return { breakdown: items, spendTotal: total, topMerchants: topMerchants(input.expenseTx), monthly: input.monthly };
}

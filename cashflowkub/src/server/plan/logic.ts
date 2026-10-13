// Pure plan logic: plan-vs-actual tables and the mark-to-market asset view.
import type { AssetSnapshot, NetWorthHistory, PlanItem } from '@/generated/prisma/client';

export interface PlanGroup {
  type: string;
  items: PlanItem[];
  totalPlanned: number;
  totalActual: number;
  variance: number;
}

export interface PlanSummary {
  plannedNet: number;
  actualNet: number;
  netVariance: number;
  /** percentages, 0..100+ */
  incomeRatio: number;
  expenseUsage: number;
  savingsRatio: number;
}

export interface PlanView {
  income: PlanGroup;
  expense: PlanGroup;
  savings: PlanGroup;
  summary: PlanSummary;
}

function buildGroup(type: string, items: PlanItem[]): PlanGroup {
  const groupItems = items.filter((i) => i.type === type);
  const totalPlanned = groupItems.reduce((s, i) => s + i.planned, 0);
  const totalActual = groupItems.reduce((s, i) => s + i.actual, 0);
  return { type, items: groupItems, totalPlanned, totalActual, variance: totalActual - totalPlanned };
}

const ratio = (actual: number, planned: number): number => (planned === 0 ? 0 : (actual / planned) * 100);

export function buildPlan(items: PlanItem[]): PlanView {
  const income = buildGroup('income', items);
  const expense = buildGroup('expense', items);
  const savings = buildGroup('savings', items);
  const plannedNet = income.totalPlanned - expense.totalPlanned - savings.totalPlanned;
  const actualNet = income.totalActual - expense.totalActual - savings.totalActual;
  return {
    income, expense, savings,
    summary: {
      plannedNet, actualNet, netVariance: actualNet - plannedNet,
      incomeRatio: ratio(income.totalActual, income.totalPlanned),
      expenseUsage: ratio(expense.totalActual, expense.totalPlanned),
      savingsRatio: ratio(savings.totalActual, savings.totalPlanned),
    },
  };
}

export interface SnapshotGroup {
  group: string;
  items: AssetSnapshot[];
  prev: number;
  curr: number;
}

export interface SnapshotsView {
  groups: SnapshotGroup[];
  prev: number;
  curr: number;
  delta: number;
  history: NetWorthHistory[];
  labels: { prev: string; curr: string; prevTh: string; currTh: string; lastUpdate: string };
}

export function buildSnapshots(snaps: AssetSnapshot[], history: NetWorthHistory[]): SnapshotsView {
  const byGroup = new Map<string, SnapshotGroup>();
  for (const s of snaps) {
    const g = byGroup.get(s.group) ?? { group: s.group, items: [], prev: 0, curr: 0 };
    g.items.push(s);
    g.prev += s.prev;
    g.curr += s.curr;
    byGroup.set(s.group, g);
  }
  const groups = [...byGroup.values()];
  const prev = groups.reduce((s, g) => s + g.prev, 0);
  const curr = groups.reduce((s, g) => s + g.curr, 0);
  return {
    groups, prev, curr, delta: curr - prev, history,
    labels: { prev: 'May 2026', curr: 'Jun 2026', prevTh: 'พ.ค. 2026', currTh: 'มิ.ย. 2026', lastUpdate: 'May 31, 2026' },
  };
}

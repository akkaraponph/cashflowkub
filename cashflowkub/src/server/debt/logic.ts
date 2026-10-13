// Debt read models built on the pure terms/schedule/cycle modules, plus payoff ordering.
import { toDebtView, type DebtView, type DebtWithPayments } from '@/server/views';
import { projectSchedule, type ScheduleRow } from './schedule';

export type { ScheduleRow } from './schedule';

export interface ScheduleView {
  debt: DebtView;
  schedule: ScheduleRow[];
  totalInterest: number;
  months: number;
  neverPaysOff: boolean;
}

export function buildSchedule(d: DebtWithPayments, today: Date): ScheduleView {
  const { rows, totalInterest, neverPaysOff } = projectSchedule(d);
  return { debt: toDebtView(d, today), schedule: rows, totalInterest, months: rows.length, neverPaysOff };
}

export type Strategy = 'avalanche' | 'snowball' | 'custom';

export function parseStrategy(v: string | undefined): Strategy {
  return v === 'snowball' || v === 'custom' ? v : 'avalanche';
}

export function sortByStrategy(debts: DebtView[], strategy: Strategy): DebtView[] {
  const list = [...debts];
  if (strategy === 'avalanche') return list.sort((a, b) => b.apr - a.apr || a.remaining - b.remaining);
  if (strategy === 'snowball') return list.sort((a, b) => a.remaining - b.remaining);
  return list.sort((a, b) => a.sort - b.sort);
}

// Pure debt logic: amortization schedule, payment transition, payoff ordering.
import type { Debt } from '@/generated/prisma/client';
import { toDebtView, type DebtView } from '@/server/views';

export interface ScheduleRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface ScheduleView {
  debt: DebtView;
  schedule: ScheduleRow[];
  totalInterest: number;
  months: number;
}

/** Month-by-month payoff at the debt's monthly payment (reducing = interest on balance; flat = none). */
export function buildSchedule(d: Debt): ScheduleView {
  let balance = d.original - d.paid;
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;
  for (let month = 1; balance > 0 && month <= 600 && d.monthly > 0; month++) {
    const interest = d.calc === 'reducing' && d.apr > 0 ? Math.round((balance * d.apr) / 100 / 12) : 0;
    let principal = d.monthly - interest;
    if (principal <= 0) principal = d.monthly; // APR alone exceeds the payment: still chip away (Go parity)
    principal = Math.min(principal, balance);
    balance -= principal;
    totalInterest += interest;
    rows.push({ month, payment: principal + interest, principal, interest, balance });
  }
  return { debt: toDebtView(d), schedule: rows, totalInterest, months: rows.length };
}

/** Applies a payment; amount <= 0 means "the monthly minimum". Closes the debt when fully repaid. */
export function applyPayment(d: Debt, amount: number): Debt {
  const pay = amount > 0 ? amount : d.monthly;
  const paid = d.paid + pay;
  if (paid >= d.original) return { ...d, paid: d.original, done: true, monthsLeft: 0 };
  return { ...d, paid, monthsLeft: Math.max(0, d.monthsLeft - 1) };
}

export type Strategy = 'avalanche' | 'snowball' | 'custom';

export function parseStrategy(v: string | undefined): Strategy {
  return v === 'snowball' || v === 'custom' ? v : 'avalanche';
}

export function sortByStrategy(debts: DebtView[], strategy: Strategy): DebtView[] {
  const list = [...debts];
  if (strategy === 'avalanche') return list.sort((a, b) => b.apr - a.apr);
  if (strategy === 'snowball') return list.sort((a, b) => a.remaining - b.remaining);
  return list.sort((a, b) => a.sort - b.sort);
}

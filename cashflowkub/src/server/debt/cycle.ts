// Monthly due cycle: which instalment is due, whether it's paid, and late fees.
// A cycle runs from the day after last month's due date through this month's due date.
import { amountDueThisMonth, remainingPrincipal, type DebtTerms } from './terms';

export interface CycleTerms extends DebtTerms {
  done: boolean;
  dueDay: number;
  graceDays: number;
  lateFee: number;
  penaltyApr: number;
}

export interface PaymentLite {
  date: Date;
  amount: number;
  principal: number;
  interest: number;
  fee: number;
}

export type DueState = 'closed' | 'paid' | 'upcoming' | 'dueSoon' | 'dueToday' | 'overdue';

export interface DueStatus {
  state: DueState;
  /** YYYY-MM-DD of the due date this status refers to (next month's once paid). */
  dueDate: string;
  /** negative when late */
  daysUntil: number;
  daysLate: number;
  /** YYYY-MM-DD, first day of the current cycle */
  cycleStart: string;
  amountDue: number;
  paidThisCycle: number;
  /** late fee + penalty interest accrued this cycle */
  lateFee: number;
}

const DAY_MS = 86_400_000;

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

const daysBetween = (from: Date, to: Date): number => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** The due date in a month; dueDay past the month's end clamps to its last day. monthIndex may overflow. */
export function dueDateIn(year: number, monthIndex: number, dueDay: number): Date {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(dueDay, lastDay)));
}

export function dueStatus(d: CycleTerms, payments: PaymentLite[], today: Date): DueStatus {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const thisDue = dueDateIn(y, m, d.dueDay);
  const prevDue = dueDateIn(y, m - 1, d.dueDay);
  const nextDue = dueDateIn(y, m + 1, d.dueDay);
  const cycleStart = new Date(prevDue.getTime() + DAY_MS);
  const amountDue = amountDueThisMonth(d);
  const paidThisCycle = payments.filter((p) => p.date >= cycleStart).reduce((s, p) => s + p.amount, 0);
  const base = { cycleStart: isoDate(cycleStart), amountDue, paidThisCycle, daysLate: 0, lateFee: 0 };

  if (d.done || remainingPrincipal(d) <= 0) return { ...base, state: 'closed', amountDue: 0, dueDate: isoDate(thisDue), daysUntil: 0 };
  if (paidThisCycle >= amountDue) return { ...base, state: 'paid', dueDate: isoDate(nextDue), daysUntil: daysBetween(today, nextDue) };
  if (today <= thisDue) {
    const daysUntil = daysBetween(today, thisDue);
    const state: DueState = daysUntil === 0 ? 'dueToday' : daysUntil <= 5 ? 'dueSoon' : 'upcoming';
    return { ...base, state, dueDate: isoDate(thisDue), daysUntil };
  }
  const daysLate = daysBetween(thisDue, today);
  const unpaid = amountDue - paidThisCycle;
  const lateFee = daysLate > d.graceDays ? d.lateFee + Math.round(((unpaid * d.penaltyApr) / 100 / 365) * daysLate) : 0;
  return { ...base, state: 'overdue', dueDate: isoDate(thisDue), daysUntil: -daysLate, daysLate, lateFee };
}

// Dashboard aggregates and the sheet's plan-vs-actual block. Pure.
import { projectSchedule } from './schedule';
import type { DebtTerms } from './terms';

export interface DebtSummary {
  count: number;
  totalRemaining: number;
  totalOriginal: number;
  totalPaid: number;
  monthlyTotal: number;
  /** 0..1 */
  progress: number;
  /** nominal annual %, weighted by remaining balance */
  avgApr: number;
  avgMonthlyRate: number;
}

interface SummaryDebt { remaining: number; original: number; paid: number; installment: number; apr: number }

export function debtSummary(active: SummaryDebt[]): DebtSummary {
  const sum = (f: (d: SummaryDebt) => number) => active.reduce((s, d) => s + f(d), 0);
  const totalRemaining = sum((d) => d.remaining);
  const totalOriginal = sum((d) => d.original);
  const totalPaid = sum((d) => d.paid);
  const avgApr = totalRemaining > 0 ? sum((d) => d.apr * d.remaining) / totalRemaining : 0;
  return {
    count: active.length,
    totalRemaining, totalOriginal, totalPaid,
    monthlyTotal: sum((d) => d.installment),
    progress: totalOriginal > 0 ? totalPaid / totalOriginal : 0,
    avgApr,
    avgMonthlyRate: avgApr / 12,
  };
}

export interface Totals { payment: number; principal: number; interest: number }
export interface PlanVsActual {
  planned: (Totals & { months: number }) | null;
  actual: Totals & { fees: number };
  remaining: (Totals & { months: number }) | null;
}

interface PaymentLike { amount: number; principal: number; interest: number; fee: number }

function totalsOf(d: DebtTerms): (Totals & { months: number }) | null {
  const s = projectSchedule(d);
  if (s.neverPaysOff) return null;
  const principal = s.rows.reduce((t, r) => t + r.principal, 0);
  return { months: s.rows.length, principal, interest: s.totalInterest, payment: principal + s.totalInterest };
}

export function planVsActual(d: DebtTerms, payments: PaymentLike[]): PlanVsActual {
  const ledgerPrincipal = payments.reduce((t, p) => t + p.principal, 0);
  const opening = Math.max(0, d.paid - ledgerPrincipal);
  return {
    planned: totalsOf({ ...d, paid: 0 }),
    actual: {
      payment: payments.reduce((t, p) => t + p.amount, 0) + opening,
      principal: d.paid,
      interest: payments.reduce((t, p) => t + p.interest, 0),
      fees: payments.reduce((t, p) => t + p.fee, 0),
    },
    remaining: totalsOf(d),
  };
}

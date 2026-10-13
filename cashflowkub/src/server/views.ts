// Derived read shapes rendered by more than one feature.
import type { Bill, Debt, DebtPayment } from '@/generated/prisma/client';
import { dueStatus, type DueStatus } from '@/server/debt/cycle';
import { payoffLabel, projectSchedule } from '@/server/debt/schedule';
import { amountDueThisMonth } from '@/server/debt/terms';

export type DebtWithPayments = Debt & { payments: DebtPayment[] };

export interface DebtView extends Debt {
  remaining: number;
  /** 0..1, paid / original */
  progress: number;
  /** amount due this month */
  installment: number;
  monthsLeft: number;
  /** "Apr 2030"; "—" when the payment never clears the balance; "" when closed */
  payoff: string;
  payoffTh: string;
  totalInterestLeft: number;
  neverPaysOff: boolean;
  due: DueStatus;
}

export function toDebtView(d: DebtWithPayments, today: Date): DebtView {
  const { payments, ...debt } = d;
  const projection = projectSchedule(debt);
  const closed = debt.done || debt.paid >= debt.original;
  const label = payoffLabel(today, projection.rows.length);
  return {
    ...debt,
    remaining: Math.max(0, debt.original - debt.paid),
    progress: debt.original > 0 ? debt.paid / debt.original : 0,
    installment: closed ? 0 : amountDueThisMonth(debt),
    monthsLeft: projection.rows.length,
    payoff: closed ? '' : projection.neverPaysOff ? '—' : label.en,
    payoffTh: closed ? '' : projection.neverPaysOff ? '—' : label.th,
    totalInterestLeft: projection.totalInterest,
    neverPaysOff: projection.neverPaysOff,
    due: dueStatus(debt, payments, today),
  };
}

export type BillStatus = 'paid' | 'overdue' | 'dueToday' | 'dueSoon' | 'upcoming';

export interface BillView extends Bill {
  status: BillStatus;
  /** dueDay - today (negative = late) */
  daysDiff: number;
}

export function toBillView(b: Bill, todayDay: number): BillView {
  const daysDiff = b.dueDay - todayDay;
  let status: BillStatus = 'upcoming';
  if (b.paid) status = 'paid';
  else if (daysDiff < 0) status = 'overdue';
  else if (daysDiff === 0) status = 'dueToday';
  else if (daysDiff <= 5) status = 'dueSoon';
  return { ...b, status, daysDiff };
}

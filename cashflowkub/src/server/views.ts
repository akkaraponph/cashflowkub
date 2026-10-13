// Derived read shapes rendered by more than one feature (port of api/internal/shared/view).
import type { Bill, Debt } from '@/generated/prisma/client';

export interface DebtView extends Debt {
  remaining: number;
  /** 0..1, paid / original */
  progress: number;
}

export function toDebtView(d: Debt): DebtView {
  return {
    ...d,
    remaining: Math.max(0, d.original - d.paid),
    progress: d.original > 0 ? d.paid / d.original : 0,
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

// Pure bill logic: month summary and the paid-flag transition.
import type { Bill, DaySpend } from '@/generated/prisma/client';
import { toBillView, type BillView } from '@/server/views';

export interface BillSummary {
  total: number;
  paid: number;
  remaining: number;
  count: number;
  month: string;
  today: number;
  nextBill: BillView | null;
  daySpend: DaySpend[];
  /** Subscriptions are bills with kind 'subscription'; their monthly cost. */
  subscriptionsCount: number;
  subscriptionsTotal: number;
}

/** Bills must be ordered by due day; the first unpaid one is "next". */
export function buildBillSummary(bills: Bill[], daySpend: DaySpend[], todayDay: number, month: string): BillSummary {
  let total = 0;
  let paid = 0;
  let nextBill: BillView | null = null;
  let subscriptionsCount = 0;
  let subscriptionsTotal = 0;
  for (const b of bills) {
    total += b.amount;
    if (b.kind === 'subscription') {
      subscriptionsCount++;
      subscriptionsTotal += b.amount;
    }
    if (b.paid) paid += b.amount;
    else nextBill ??= toBillView(b, todayDay);
  }
  return { total, paid, remaining: total - paid, count: bills.length, month, today: todayDay, nextBill, daySpend, subscriptionsCount, subscriptionsTotal };
}

/** undefined toggles the flag; a boolean sets it. */
export function applyPaid(b: Bill, paid: boolean | undefined): Bill {
  return { ...b, paid: paid ?? !b.paid };
}

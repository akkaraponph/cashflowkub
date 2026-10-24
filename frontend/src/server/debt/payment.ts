// Allocates a payment: late fee first, then this cycle's unpaid interest, then principal.
import { dueStatus, startOfUtcDay, type CycleTerms, type PaymentLite } from './cycle';
import { interestForMonth, remainingPrincipal } from './terms';

export interface PaymentSplit {
  principal: number;
  interest: number;
  fee: number;
  /** amount beyond what is owed; not applied */
  excess: number;
}

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

export function splitPayment(d: CycleTerms, payments: PaymentLite[], amount: number, date: Date): PaymentSplit {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('payment amount must be a non-negative finite number');
  const status = dueStatus(d, payments, startOfUtcDay(date));
  const cycleStart = new Date(`${status.cycleStart}T00:00:00Z`);
  const inCycle = payments.filter((p) => p.date >= cycleStart);
  const feeDue = Math.max(0, status.lateFee - sum(inCycle.map((p) => p.fee)));
  const interestDue = Math.max(0, interestForMonth(d) - sum(inCycle.map((p) => p.interest)));

  let left = amount;
  const fee = Math.min(left, feeDue);
  left -= fee;
  const interest = Math.min(left, interestDue);
  left -= interest;
  const principal = Math.min(left, remainingPrincipal(d));
  left -= principal;
  return { fee, interest, principal, excess: left };
}

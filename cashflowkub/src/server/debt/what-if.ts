// What-if overrides applied on top of a debt's real terms. Pure; safe to import in client components.
import { paymentForTarget } from './schedule';
import type { DebtTerms } from './terms';

export interface WhatIf {
  payment?: number;
  apr?: number;
  calc?: 'flat' | 'reducing';
  targetMonths?: number;
}

export function applyWhatIf(base: DebtTerms, w: WhatIf): DebtTerms {
  const next: DebtTerms = { ...base, apr: w.apr ?? base.apr, calc: w.calc ?? base.calc };
  if (w.targetMonths !== undefined) next.fixedPayment = paymentForTarget(next, w.targetMonths);
  else if (w.payment !== undefined) next.fixedPayment = w.payment;
  return next;
}

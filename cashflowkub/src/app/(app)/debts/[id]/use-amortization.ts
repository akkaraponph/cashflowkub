import { useMemo } from 'react';
import { payoffLabel, projectSchedule, type ScheduleRow } from '@/server/debt/schedule';
import type { DebtTerms } from '@/server/debt/terms';
import { applyWhatIf, type WhatIf } from '@/server/debt/what-if';

export interface Amortization {
  terms: DebtTerms;
  rows: ScheduleRow[];
  totalInterest: number;
  neverPaysOff: boolean;
  payoff: { en: string; th: string } | null;
}

export function useAmortization(base: DebtTerms, w: WhatIf, todayIso: string): Amortization {
  const { apr, calc, payment, targetMonths } = w;
  return useMemo(() => {
    const terms = applyWhatIf(base, { apr, calc, payment, targetMonths });
    const s = projectSchedule(terms);
    return { terms, rows: s.rows, totalInterest: s.totalInterest, neverPaysOff: s.neverPaysOff, payoff: s.neverPaysOff ? null : payoffLabel(new Date(todayIso), s.rows.length) };
  }, [base, apr, calc, payment, targetMonths, todayIso]);
}

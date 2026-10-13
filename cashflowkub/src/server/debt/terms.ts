// Loan terms math. Rates are nominal annual percent (apr); interest is charged monthly.
// flat     = interest on the ORIGINAL amount every month (SPayLater / EasyCash style)
// reducing = interest on the REMAINING balance (bank loans)

export interface DebtTerms {
  original: number;
  paid: number;
  apr: number;
  calc: string;
  monthly: number;
  fixedPayment: number;
  termMonths: number;
}

export const monthlyRate = (d: Pick<DebtTerms, 'apr'>): number => d.apr / 100 / 12;

export const remainingPrincipal = (d: Pick<DebtTerms, 'original' | 'paid'>): number => Math.max(0, d.original - d.paid);

/** Interest charged for one month at the given outstanding balance. */
export function interestForMonth(d: DebtTerms, balance: number = remainingPrincipal(d)): number {
  if (balance <= 0) return 0;
  return Math.round((d.calc === 'flat' ? d.original : balance) * monthlyRate(d));
}

/** The regular monthly instalment: statement amount > computed from term > minimum payment. */
export function scheduledInstallment(d: DebtTerms): number {
  if (d.fixedPayment > 0) return d.fixedPayment;
  if (d.termMonths > 0) {
    const r = monthlyRate(d);
    const n = d.termMonths;
    if (d.calc === 'flat') return Math.round(d.original / n + d.original * r);
    if (r === 0) return Math.ceil(d.original / n);
    return Math.round((d.original * r) / (1 - (1 + r) ** -n));
  }
  return d.monthly;
}

/** What is due this month: the instalment, but never more than what's left plus this month's interest. */
export function amountDueThisMonth(d: DebtTerms): number {
  return Math.min(scheduledInstallment(d), remainingPrincipal(d) + interestForMonth(d));
}

export function toApr(rate: number, unit: 'month' | 'year'): number {
  return unit === 'month' ? rate * 12 : rate;
}

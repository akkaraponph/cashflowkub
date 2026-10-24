import { describe, expect, it } from 'vitest';
import { amountDueThisMonth, deriveFixedApr, interestForMonth, remainingPrincipal, scheduledInstallment, toApr, type DebtTerms } from '@/server/debt/terms';

const terms = (o: Partial<DebtTerms> = {}): DebtTerms => ({ original: 10000, paid: 0, apr: 0, calc: 'reducing', monthly: 0, fixedPayment: 0, termMonths: 0, ...o });

describe('scheduledInstallment', () => {
  it('uses the statement instalment when given (SPayLater)', () => {
    expect(scheduledInstallment(terms({ fixedPayment: 1250, termMonths: 6, monthly: 999 }))).toBe(1250);
  });
  it('computes a flat-rate instalment from term (EasyCash)', () => {
    // 20000/12 + 20000 × 1.5% = 1666.67 + 300
    expect(scheduledInstallment(terms({ original: 20000, apr: 18, calc: 'flat', termMonths: 12 }))).toBe(1967);
  });
  it('computes an amortized instalment for a reducing-balance bank loan', () => {
    expect(scheduledInstallment(terms({ original: 100000, apr: 12, calc: 'reducing', termMonths: 12 }))).toBe(8885);
  });
  it('rounds a 0% term loan up so it still closes on time', () => {
    expect(scheduledInstallment(terms({ original: 1001, termMonths: 10 }))).toBe(101);
  });
  it('falls back to the minimum payment for open-ended debt', () => {
    expect(scheduledInstallment(terms({ monthly: 1523 }))).toBe(1523);
  });
});

describe('interestForMonth', () => {
  it('flat: charges on the original amount regardless of repayments', () => {
    expect(interestForMonth(terms({ original: 20000, paid: 5000, apr: 18, calc: 'flat' }))).toBe(300);
  });
  it('reducing: charges on the outstanding balance', () => {
    expect(interestForMonth(terms({ original: 70000, paid: 24300, apr: 25 }))).toBe(952);
  });
  it('charges nothing once the balance is zero', () => {
    expect(interestForMonth(terms({ original: 100, paid: 100, apr: 30, calc: 'flat' }))).toBe(0);
  });
});

describe('amountDueThisMonth / remainingPrincipal / toApr', () => {
  it('never asks for more than what is left plus interest', () => {
    expect(amountDueThisMonth(terms({ original: 1000, paid: 900, fixedPayment: 1250 }))).toBe(100);
  });
  it('clamps remaining at zero', () => {
    expect(remainingPrincipal(terms({ original: 100, paid: 150 }))).toBe(0);
  });
  it('converts a monthly rate to nominal annual', () => {
    expect(toApr(1.5, 'month')).toBe(18);
    expect(toApr(25, 'year')).toBe(25);
  });
});

describe('deriveFixedApr', () => {
  it('turns ฿1,200 × 10 on ฿10,000 into 24% flat', () => {
    expect(deriveFixedApr(10000, 1200, 10)).toBeCloseTo(24, 10);
  });
  it('is 0 when instalments only repay the principal', () => {
    expect(deriveFixedApr(6000, 1000, 6)).toBe(0);
  });
});

describe('interestForMonth (fixed)', () => {
  it('charges on the original amount regardless of balance, rounded down', () => {
    const d = terms({ original: 10000, apr: deriveFixedApr(10000, 1000, 12), calc: 'fixed', fixedPayment: 1000, termMonths: 12 });
    expect(interestForMonth(d, 10000)).toBe(166);
    expect(interestForMonth(d, 500)).toBe(166);
  });
  it('survives float error on an exact division', () => {
    expect(interestForMonth(terms({ original: 10000, apr: deriveFixedApr(10000, 1200, 10), calc: 'fixed' }), 10000)).toBe(200);
  });
});

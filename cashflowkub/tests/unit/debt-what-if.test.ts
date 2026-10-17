import { describe, expect, it } from 'vitest';
import { paymentForTarget, projectSchedule } from '@/server/debt/schedule';
import type { DebtTerms } from '@/server/debt/terms';
import { applyWhatIf } from '@/server/debt/what-if';

const base: DebtTerms = { original: 70000, paid: 24300, apr: 25, calc: 'reducing', monthly: 2783, fixedPayment: 0, termMonths: 0 };

describe('applyWhatIf', () => {
  it('no overrides leaves the terms untouched', () => {
    expect(applyWhatIf(base, {})).toEqual(base);
  });
  it('a bigger payment shortens the schedule', () => {
    const next = applyWhatIf(base, { payment: 5000 });
    expect(next.fixedPayment).toBe(5000);
    expect(projectSchedule(next).rows.length).toBeLessThan(projectSchedule(base).rows.length);
  });
  it('overrides apr and calc', () => {
    expect(applyWhatIf(base, { apr: 0 }).apr).toBe(0);
    expect(applyWhatIf(base, { calc: 'flat' }).calc).toBe('flat');
  });
  it('targetMonths wins over payment', () => {
    const next = applyWhatIf(base, { targetMonths: 12, payment: 1 });
    expect(next.fixedPayment).toBe(paymentForTarget(base, 12));
    expect(projectSchedule(next).rows.length).toBeLessThanOrEqual(12);
  });
  it('target uses the overridden apr', () => {
    expect(applyWhatIf(base, { apr: 60, targetMonths: 12 }).fixedPayment).toBe(paymentForTarget({ ...base, apr: 60 }, 12));
  });
  it('a payment below the monthly interest never pays off', () => {
    expect(projectSchedule(applyWhatIf(base, { payment: 100 })).neverPaysOff).toBe(true);
  });
});

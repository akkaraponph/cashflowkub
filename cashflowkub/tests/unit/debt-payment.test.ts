import { describe, expect, it } from 'vitest';
import type { CycleTerms, PaymentLite } from '@/server/debt/cycle';
import { splitPayment } from '@/server/debt/payment';

const TODAY = new Date('2026-06-18T00:00:00Z');
const terms = (o: Partial<CycleTerms> = {}): CycleTerms => ({
  original: 70000, paid: 24300, apr: 25, calc: 'reducing', monthly: 2783, fixedPayment: 0, termMonths: 0,
  done: false, dueDay: 25, graceDays: 0, lateFee: 0, penaltyApr: 0, ...o,
});

describe('splitPayment', () => {
  it('pays interest first, then principal', () => {
    expect(splitPayment(terms(), [], 2783, TODAY)).toEqual({ fee: 0, interest: 952, principal: 1831, excess: 0 });
  });
  it('does not charge interest twice in one cycle', () => {
    const earlier: PaymentLite[] = [{ date: TODAY, amount: 2783, principal: 1831, interest: 952, fee: 0 }];
    expect(splitPayment(terms({ paid: 24300 + 1831 }), earlier, 1000, TODAY)).toEqual({ fee: 0, interest: 0, principal: 1000, excess: 0 });
  });
  it('takes the late fee before interest on an overdue flat loan (EasyCash)', () => {
    const easyCash = terms({ original: 20000, paid: 5001, apr: 18, calc: 'flat', termMonths: 12, monthly: 0, dueDay: 5, lateFee: 100 });
    expect(splitPayment(easyCash, [], 2067, TODAY)).toEqual({ fee: 100, interest: 300, principal: 1667, excess: 0 });
  });
  it('caps principal at the balance and reports the excess', () => {
    expect(splitPayment(terms({ original: 1000, paid: 500, apr: 0 }), [], 800, TODAY)).toEqual({ fee: 0, interest: 0, principal: 500, excess: 300 });
  });
  it('a payment smaller than the fee only reduces the fee', () => {
    expect(splitPayment(terms({ dueDay: 10, lateFee: 100 }), [], 50, TODAY)).toEqual({ fee: 50, interest: 0, principal: 0, excess: 0 });
  });
});

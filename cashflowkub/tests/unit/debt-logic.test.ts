import { describe, expect, it } from 'vitest';
import { applyPayment, buildSchedule, parseStrategy, sortByStrategy } from '@/server/debt/logic';
import { toDebtView } from '@/server/views';
import { debt } from '../fixtures';

describe('buildSchedule', () => {
  it('charges interest on the reducing balance', () => {
    const s = buildSchedule(debt({ original: 70000, paid: 24300, apr: 25, monthly: 2783, calc: 'reducing' }));
    expect(s.schedule[0]).toEqual({ month: 1, payment: 2783, principal: 1831, interest: 952, balance: 43869 });
    expect(s.schedule.at(-1)?.balance).toBe(0);
    expect(s.months).toBe(s.schedule.length);
    expect(s.totalInterest).toBe(s.schedule.reduce((a, r) => a + r.interest, 0));
  });
  it('charges no interest on a 0% flat loan and shortens the final payment', () => {
    const s = buildSchedule(debt({ original: 186650, paid: 8275, apr: 0, monthly: 3889, calc: 'flat' }));
    expect(s.months).toBe(46);
    expect(s.totalInterest).toBe(0);
    expect(s.schedule.at(-1)).toEqual({ month: 46, payment: 3370, principal: 3370, interest: 0, balance: 0 });
  });
  it('returns an empty schedule for a paid-off or payment-less debt', () => {
    expect(buildSchedule(debt({ original: 100, paid: 100 })).months).toBe(0);
    expect(buildSchedule(debt({ monthly: 0 })).months).toBe(0);
  });
});

describe('applyPayment', () => {
  it('defaults to the monthly minimum and decrements months left', () => {
    const d = applyPayment(debt({ original: 9593, paid: 5300, monthly: 1607, monthsLeft: 3 }), 0);
    expect(d).toMatchObject({ paid: 6907, monthsLeft: 2, done: false });
  });
  it('caps an overpayment at the original and closes the debt', () => {
    const d = applyPayment(debt({ original: 9593, paid: 5300, monthsLeft: 3 }), 999999);
    expect(d).toMatchObject({ paid: 9593, done: true, monthsLeft: 0 });
  });
});

describe('sortByStrategy', () => {
  const views = [
    debt({ id: 1, apr: 0, original: 1000, paid: 0, sort: 1 }),
    debt({ id: 2, apr: 33, original: 5000, paid: 0, sort: 2 }),
    debt({ id: 3, apr: 25, original: 300, paid: 0, sort: 3 }),
  ].map(toDebtView);
  it('avalanche = highest APR first', () => expect(sortByStrategy(views, 'avalanche').map((d) => d.id)).toEqual([2, 3, 1]));
  it('snowball = smallest balance first', () => expect(sortByStrategy(views, 'snowball').map((d) => d.id)).toEqual([3, 1, 2]));
  it('custom = configured order', () => expect(sortByStrategy(views, 'custom').map((d) => d.id)).toEqual([1, 2, 3]));
  it('does not mutate its input', () => {
    sortByStrategy(views, 'avalanche');
    expect(views.map((d) => d.id)).toEqual([1, 2, 3]);
  });
  it('parseStrategy falls back to avalanche', () => {
    expect(parseStrategy('snowball')).toBe('snowball');
    expect(parseStrategy('nope')).toBe('avalanche');
    expect(parseStrategy(undefined)).toBe('avalanche');
  });
});

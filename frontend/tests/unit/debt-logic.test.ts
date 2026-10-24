import { describe, expect, it } from 'vitest';
import { buildSchedule, parseStrategy, sortByStrategy } from '@/server/debt/logic';
import { debt, debtView } from '../fixtures';

const TODAY = new Date('2026-06-18T00:00:00Z');

describe('buildSchedule', () => {
  it('wraps the projection with the debt view', () => {
    const s = buildSchedule({ ...debt({ original: 70000, paid: 24300, apr: 25, monthly: 2783 }), payments: [] }, TODAY);
    expect(s.schedule[0]).toEqual({ month: 1, payment: 2783, principal: 1831, interest: 952, balance: 43869 });
    expect(s.months).toBe(s.schedule.length);
    expect(s.debt.monthsLeft).toBe(s.months);
    expect(s.neverPaysOff).toBe(false);
  });
});

describe('sortByStrategy', () => {
  const views = [
    debtView({ id: 1, apr: 0, original: 1000, sort: 1 }),
    debtView({ id: 2, apr: 33, original: 5000, sort: 2 }),
    debtView({ id: 3, apr: 25, original: 300, sort: 3 }),
  ];
  it('avalanche = highest APR first', () => expect(sortByStrategy(views, 'avalanche').map((d) => d.id)).toEqual([2, 3, 1]));
  it('snowball = smallest balance first', () => expect(sortByStrategy(views, 'snowball').map((d) => d.id)).toEqual([3, 1, 2]));
  it('custom = configured order', () => expect(sortByStrategy(views, 'custom').map((d) => d.id)).toEqual([1, 2, 3]));
  it('parseStrategy falls back to avalanche', () => {
    expect(parseStrategy('snowball')).toBe('snowball');
    expect(parseStrategy(undefined)).toBe('avalanche');
  });
});

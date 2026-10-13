import { describe, expect, it } from 'vitest';
import { toBillView, toDebtView } from '@/server/views';
import { bill, debt } from '../fixtures';

describe('toDebtView', () => {
  it('derives remaining and progress', () => {
    const v = toDebtView(debt({ original: 70000, paid: 24300 }));
    expect(v.remaining).toBe(45700);
    expect(v.progress).toBeCloseTo(0.3471, 4);
  });
  it('never reports negative remaining and survives a zero original', () => {
    expect(toDebtView(debt({ original: 100, paid: 150 })).remaining).toBe(0);
    expect(toDebtView(debt({ original: 0, paid: 0 })).progress).toBe(0);
  });
});

describe('toBillView', () => {
  it.each([
    [{ paid: true, dueDay: 1 }, 'paid', -17],
    [{ dueDay: 16 }, 'overdue', -2],
    [{ dueDay: 18 }, 'dueToday', 0],
    [{ dueDay: 23 }, 'dueSoon', 5],
    [{ dueDay: 24 }, 'upcoming', 6],
  ] as const)('%o -> %s', (o, status, diff) => {
    const v = toBillView(bill(o), 18);
    expect(v.status).toBe(status);
    expect(v.daysDiff).toBe(diff);
  });
});

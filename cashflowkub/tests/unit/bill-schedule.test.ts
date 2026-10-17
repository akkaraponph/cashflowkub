import { describe, expect, it } from 'vitest';
import { dueDateIn, daysInMonth, firstWeekday, isMonth, monthParam, monthsBetween, occursIn, shiftMonth, type Recurrence } from '@/lib/bill-schedule';

const rec = (o: Partial<Recurrence> = {}): Recurrence => ({ freq: 'monthly', startMonth: '2026-06', endMonth: '', everyMonths: 1, ...o });

describe('bill schedule', () => {
  it('isMonth accepts YYYY-MM only', () => {
    expect(isMonth('2026-06')).toBe(true);
    for (const bad of ['2026-13', '2026-00', '2026-6', 'garbage', '', '2026-06-01']) expect(isMonth(bad)).toBe(false);
  });
  it('monthParam falls back to the current month', () => {
    expect(monthParam('2026-09')).toBe('2026-09');
    expect(monthParam('2026-13')).toBe('2026-06');
    expect(monthParam(undefined)).toBe('2026-06');
  });
  it('shiftMonth crosses year boundaries both ways', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', 3)).toBe('2027-02');
  });
  it('monthsBetween is signed', () => {
    expect(monthsBetween('2026-06', '2027-03')).toBe(9);
    expect(monthsBetween('2026-06', '2026-03')).toBe(-3);
  });
  it('daysInMonth and firstWeekday', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-06')).toBe(30);
    expect(firstWeekday('2026-06')).toBe(1);
  });
  it('dueDateIn clamps a late due day to the last day of the month', () => {
    expect(dueDateIn('2027-02', 31)).toBe('2027-02-28');
    expect(dueDateIn('2028-02', 30)).toBe('2028-02-29');
    expect(dueDateIn('2026-06', 5)).toBe('2026-06-05');
  });
  it('a recurring bill every month occurs from its start month on', () => {
    expect(occursIn(rec(), '2026-06')).toBe(true);
    expect(occursIn(rec(), '2027-01')).toBe(true);
    expect(occursIn(rec(), '2026-05')).toBe(false);
  });
  it('every 3 months lands on start + 3k, across a year end', () => {
    const r = rec({ startMonth: '2026-11', everyMonths: 3 });
    expect(occursIn(r, '2026-11')).toBe(true);
    expect(occursIn(r, '2026-12')).toBe(false);
    expect(occursIn(r, '2027-02')).toBe(true);
    expect(occursIn(r, '2027-05')).toBe(true);
    expect(occursIn(r, '2026-08')).toBe(false);
  });
  it('every 12 months is once a year', () => {
    const r = rec({ everyMonths: 12 });
    expect(occursIn(r, '2027-06')).toBe(true);
    expect(occursIn(r, '2027-07')).toBe(false);
  });
  it('an end month is inclusive', () => {
    const r = rec({ endMonth: '2026-08' });
    expect(occursIn(r, '2026-08')).toBe(true);
    expect(occursIn(r, '2026-09')).toBe(false);
  });
  it('a one-time bill occurs only in its start month, whatever the period', () => {
    const r = rec({ freq: 'once', everyMonths: 3 });
    expect(occursIn(r, '2026-06')).toBe(true);
    expect(occursIn(r, '2026-09')).toBe(false);
  });
});

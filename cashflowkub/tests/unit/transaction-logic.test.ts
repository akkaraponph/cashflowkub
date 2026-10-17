import { describe, expect, it } from 'vitest';
import { formatLongDate, groupLabel, hasAtMostTwoDecimals, parseFlexDate, parseTxFilter, toTxView } from '@/server/transaction/logic';
import { HttpError } from '@/server/errors';
import { tx } from '../fixtures';

const TODAY = new Date('2026-06-18T00:00:00Z');
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('groupLabel', () => {
  it('buckets Today / Yesterday / short date', () => {
    expect(groupLabel(day('2026-06-18'), TODAY)).toBe('Today');
    expect(groupLabel(day('2026-06-17'), TODAY)).toBe('Yesterday');
    expect(groupLabel(day('2026-06-15'), TODAY)).toBe('Jun 15');
  });
  it('handles yesterday across a year boundary', () => {
    expect(groupLabel(day('2025-12-31'), day('2026-01-01'))).toBe('Yesterday');
  });
});

describe('toTxView', () => {
  it('formats date and group, and drops the raw Date', () => {
    const v = toTxView(tx({ id: 7, date: day('2026-06-15') }), TODAY);
    expect(v).toEqual({ id: 7, name: 'Coffee', cat: 'food', acct: 'Cash', amount: -100, note: '', interest: 0, fee: 0, goal: '', isoDate: '2026-06-15', date: 'Jun 15, 2026', group: 'Jun 15' });
    expect(formatLongDate(day('2026-01-02'))).toBe('Jan 2, 2026');
  });
});

describe('parseFlexDate', () => {
  it('accepts the three supported layouts', () => {
    expect(parseFlexDate('Jun 18, 2026')?.toISOString()).toBe('2026-06-18T00:00:00.000Z');
    expect(parseFlexDate('2026-06-18')?.toISOString()).toBe('2026-06-18T00:00:00.000Z');
    expect(parseFlexDate('2026-06-18T15:30:00Z')?.toISOString()).toBe('2026-06-18T00:00:00.000Z');
  });
  it('rejects impossible or unknown dates', () => {
    expect(parseFlexDate('2026-02-30')).toBeNull();
    expect(parseFlexDate('Foo 1, 2026')).toBeNull();
    expect(parseFlexDate('yesterday')).toBeNull();
  });
});

describe('parseTxFilter', () => {
  it('keeps valid filters and ignores junk type/limit', () => {
    const f = parseTxFilter(new URLSearchParams('type=income&category=food&account=Cash&from=2026-06-01&limit=5'));
    expect(f).toEqual({ type: 'income', category: 'food', account: 'Cash', from: day('2026-06-01'), limit: 5 });
    expect(parseTxFilter(new URLSearchParams('type=bogus&limit=abc'))).toEqual({});
  });
  it('caps limit at 500', () => {
    expect(parseTxFilter(new URLSearchParams('limit=100000')).limit).toBe(500);
  });
  it('rejects an invalid date with a 400', () => {
    expect(() => parseTxFilter(new URLSearchParams('to=2026-13-01'))).toThrow(HttpError);
  });
});

describe('hasAtMostTwoDecimals', () => {
  it('accepts whole baht and satang, rejects finer', () => {
    expect([120, 120.5, 0.1, 19.99, -0.07].every(hasAtMostTwoDecimals)).toBe(true);
    expect(hasAtMostTwoDecimals(12.345)).toBe(false);
  });
});

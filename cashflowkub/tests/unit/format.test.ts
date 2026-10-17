import { describe, expect, it } from 'vitest';
import { clamp01, compact, fmt, fmtRate, pct, signed } from '@/lib/format';

describe('format', () => {
  it('fmt groups thousands and drops the sign', () => {
    expect(fmt(1234567)).toBe('฿1,234,567');
    expect(fmt(-18200)).toBe('฿18,200');
    expect(fmt(0)).toBe('฿0');
  });
  it('signed prefixes + or -', () => {
    expect(signed(44300)).toBe('+฿44,300');
    expect(signed(-185)).toBe('-฿185');
  });
  it('compact abbreviates k and M', () => {
    expect(compact(17700)).toBe('฿17.7k');
    expect(compact(1_250_000)).toBe('฿1.3M');
    expect(compact(950)).toBe('฿950');
  });
  it('pct rounds a ratio', () => {
    expect(pct(0.624)).toBe('62%');
  });
  it('fmtRate rounds to 2 decimals and trims zeros', () => {
    expect(fmtRate(25)).toBe('25');
    expect(fmtRate(33)).toBe('33');
    expect(fmtRate(13.200000000000001)).toBe('13.2');
    expect(fmtRate(17.331589274035316)).toBe('17.33');
  });
  it('clamp01 bounds a ratio', () => {
    expect(clamp01(1.3)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
  });
});

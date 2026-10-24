import { describe, expect, it } from 'vitest';
import { resolveLang, resolveYear, stepYear } from '@/lib/prefs';

describe('prefs', () => {
  it('resolveLang accepts th and falls back to en', () => {
    expect(resolveLang('th')).toBe('th');
    expect(resolveLang('en')).toBe('en');
    expect(resolveLang('<script>')).toBe('en');
    expect(resolveLang(undefined)).toBe('en');
  });
  it('resolveYear accepts known years only', () => {
    expect(resolveYear('2025')).toBe(2025);
    expect(resolveYear('1999')).toBe(2026);
    expect(resolveYear('abc')).toBe(2026);
  });
  it('stepYear stays inside the range', () => {
    expect(stepYear(2026, 1)).toBe(2027);
    expect(stepYear(2024, -1)).toBe(2024);
    expect(stepYear(2028, 1)).toBe(2028);
  });
});

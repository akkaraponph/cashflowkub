import type { Lang } from '@/lib/i18n';

export const LANG_COOKIE = 'cfk-lang';
export const YEAR_COOKIE = 'cfk-year';
export const YEARS = [2024, 2025, 2026, 2027, 2028];
export const CURRENT_YEAR = 2026;

export function resolveLang(v: string | undefined): Lang {
  return v === 'th' ? 'th' : 'en';
}

export function resolveYear(v: string | undefined): number {
  const n = Number(v);
  return YEARS.includes(n) ? n : CURRENT_YEAR;
}

export function stepYear(year: number, dir: -1 | 1): number {
  const i = YEARS.indexOf(year);
  return YEARS[Math.min(YEARS.length - 1, Math.max(0, i + dir))] ?? CURRENT_YEAR;
}

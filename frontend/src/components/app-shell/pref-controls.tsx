'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { writePrefCookie } from '@/lib/pref-cookie';
import { LANG_COOKIE, stepYear, YEAR_COOKIE, YEARS } from '@/lib/prefs';
import { cn } from '@/lib/utils';

const box = 'flex h-9 items-center justify-center rounded-lg border bg-secondary text-xs font-semibold hover:opacity-80';

export function YearStepper({ year }: { year: number }) {
  const router = useRouter();
  const set = (y: number) => {
    writePrefCookie(YEAR_COOKIE, String(y));
    router.refresh();
  };
  return (
    <div className="flex h-9 items-center overflow-hidden rounded-lg border bg-secondary">
      <button type="button" aria-label="Previous year" disabled={year <= YEARS[0]} onClick={() => set(stepYear(year, -1))} className="px-2 disabled:opacity-30">
        <Icon name="chevron-left" size={15} />
      </button>
      <span className="text-xs font-bold tabular-nums">{year}</span>
      <button type="button" aria-label="Next year" disabled={year >= YEARS[YEARS.length - 1]} onClick={() => set(stepYear(year, 1))} className="px-2 disabled:opacity-30">
        <Icon name="chevron-right" size={15} />
      </button>
    </div>
  );
}

export function LangToggle() {
  const router = useRouter();
  const { lang } = useI18n();
  return (
    <button type="button" className={cn(box, 'min-w-9 px-2.5')} onClick={() => { writePrefCookie(LANG_COOKIE, lang === 'en' ? 'th' : 'en'); router.refresh(); }}>
      {lang === 'en' ? 'EN' : 'TH'}
    </button>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button type="button" aria-label="Toggle theme" className={cn(box, 'w-9')} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      <span className="dark:hidden"><Icon name="moon" size={17} /></span>
      <span className="hidden dark:inline"><Icon name="sun" size={17} /></span>
    </button>
  );
}

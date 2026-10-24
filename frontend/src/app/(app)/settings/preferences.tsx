'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { YearStepper } from '@/components/app-shell/pref-controls';
import { useI18n } from '@/components/i18n-provider';
import { writePrefCookie } from '@/lib/pref-cookie';
import { LANG_COOKIE } from '@/lib/prefs';
import { cn } from '@/lib/utils';

function Segmented({ value, options, onChange }: { value: string; options: { key: string; label: string }[]; onChange: (k: string) => void }) {
  return (
    <div className="flex w-40 rounded-lg bg-secondary p-1">
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          className={cn('flex-1 rounded-md py-1.5 text-xs font-semibold', o.key === value ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PreferencesRows({ year }: { year: number }) {
  const { ui, lang } = useI18n();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const row = 'flex items-center gap-3 border-t py-3';
  return (
    <>
      <div className={row}>
        <span className="flex-1 text-sm">{ui.language}</span>
        <Segmented value={lang} options={[{ key: 'en', label: 'EN' }, { key: 'th', label: 'TH' }]}
          onChange={(k) => { writePrefCookie(LANG_COOKIE, k); router.refresh(); }} />
      </div>
      <div className={row}>
        <span className="flex-1 text-sm">{ui.appearance}</span>
        <Segmented value={resolvedTheme ?? 'light'} options={[{ key: 'light', label: ui.light }, { key: 'dark', label: ui.dark }]} onChange={setTheme} />
      </div>
      <div className={row}>
        <span className="flex-1 text-sm">{ui.yearScope}</span>
        <YearStepper year={year} />
      </div>
    </>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';

/** Month input that navigates to `basePath?month=…`, keeping the other query params. */
export function MonthPicker({ month, basePath = '/transactions' }: { month: string; basePath?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { ui } = useI18n();
  return (
    <input
      type="month"
      aria-label={ui.sheet.month}
      value={month}
      onChange={(e) => {
        if (!e.target.value) return;
        const next = new URLSearchParams(params);
        next.set('month', e.target.value);
        router.push(`${basePath}?${next}`);
      }}
      className="h-9 rounded-lg border bg-card px-2 text-sm"
    />
  );
}

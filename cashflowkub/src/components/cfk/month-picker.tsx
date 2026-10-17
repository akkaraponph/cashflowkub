'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';

export function MonthPicker({ month }: { month: string }) {
  const router = useRouter();
  const { ui } = useI18n();
  return (
    <input
      type="month"
      aria-label={ui.sheet.month}
      value={month}
      onChange={(e) => { if (e.target.value) router.push(`/transactions?month=${e.target.value}`); }}
      className="h-9 rounded-lg border bg-card px-2 text-sm"
    />
  );
}

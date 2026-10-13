import { clamp01 } from '@/lib/format';
import { cn } from '@/lib/utils';

const FILL = { primary: 'bg-primary', danger: 'bg-destructive', success: 'bg-type-xls-fg' } as const;

export function Progress({ value, tone = 'primary', className }: { value: number; tone?: keyof typeof FILL; className?: string }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-secondary', className)}>
      <div className={cn('h-full rounded-full', FILL[tone])} style={{ width: `${clamp01(value) * 100}%` }} />
    </div>
  );
}

/** Two-segment bar, e.g. assets vs liabilities. */
export function SplitBar({ left }: { left: number }) {
  const l = clamp01(left) * 100;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
      <div className="h-full bg-type-xls-fg" style={{ width: `${l}%` }} />
      <div className="h-full bg-destructive" style={{ width: `${100 - l}%` }} />
    </div>
  );
}

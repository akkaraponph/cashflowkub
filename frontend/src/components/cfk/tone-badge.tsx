import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'primary';

const TONE: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  success: 'bg-type-xls-bg text-type-xls-fg',
  danger: 'bg-type-pdf-bg text-type-pdf-fg',
  warning: 'bg-type-folder-bg text-type-folder-fg',
  info: 'bg-type-doc-bg text-type-doc-fg',
  primary: 'bg-primary text-primary-foreground',
};

export function ToneBadge({ label, tone = 'neutral', className }: { label: string; tone?: Tone; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', TONE[tone], className)}>{label}</span>;
}

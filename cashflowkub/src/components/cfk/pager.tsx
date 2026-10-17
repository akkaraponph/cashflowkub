import Link from 'next/link';
import { Icon } from '@/components/cfk/icon';
import { getI18n } from '@/lib/prefs-server';
import { fill } from '@/lib/i18n';
import { PAGE_SIZES, pageRange } from '@/lib/pagination';
import { cn } from '@/lib/utils';

type Target = { page: number; size: number };

export async function Pager({ page, size, total, hrefFor }: { page: number; size: number; total: number; hrefFor: (p: Target) => string }) {
  const { ui } = await getI18n();
  const s = ui.sheet;
  const { from, to } = pageRange(page, size, total);
  const last = Math.max(1, Math.ceil(total / size));
  const nav = 'flex size-8 items-center justify-center rounded-lg border bg-secondary';
  const arrow = (label: string, icon: string, target: number) =>
    target < 1 || target > last ? (
      <span aria-label={label} aria-disabled="true" className={cn(nav, 'opacity-40')}><Icon name={icon} size={16} /></span>
    ) : (
      <Link href={hrefFor({ page: target, size })} aria-label={label} className={cn(nav, 'hover:opacity-80')}><Icon name={icon} size={16} /></Link>
    );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{fill(s.pageRange, { from, to, total })}</span>
      <div className="flex items-center gap-2">
        {arrow(s.prevPage, 'chevron-left', page - 1)}
        {arrow(s.nextPage, 'chevron-right', page + 1)}
        <span className="ml-2">{s.perPage}</span>
        {PAGE_SIZES.map((n) => (
          <Link
            key={n}
            href={hrefFor({ page: 1, size: n })}
            aria-current={n === size ? 'page' : undefined}
            className={cn('rounded-md px-1.5 py-0.5 hover:underline', n === size && 'bg-secondary font-semibold text-foreground')}
          >
            {n}
          </Link>
        ))}
      </div>
    </div>
  );
}

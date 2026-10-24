import Link from 'next/link';
import { Icon } from '@/components/cfk/icon';
import { shiftMonth } from '@/lib/bill-schedule';
import { CURRENT_MONTH } from '@/lib/clock';
import { formatMonth } from '@/lib/format';
import type { Dict, Lang } from '@/lib/i18n';

const arrow = 'flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground';

/** Previous / next month links around the month being planned; state lives in the URL. */
export function MonthNav({ month, hrefFor, ui, lang }: { month: string; hrefFor: (m: string) => string; ui: Dict; lang: Lang }) {
  return (
    <nav className="flex items-center justify-between rounded-xl bg-secondary p-1">
      <Link href={hrefFor(shiftMonth(month, -1))} scroll={false} aria-label={ui.prevMonth} className={arrow}>
        <Icon name="chevron-left" size={18} />
      </Link>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold tabular-nums">{formatMonth(month, lang)}</span>
        {month !== CURRENT_MONTH ? (
          <Link href={hrefFor(CURRENT_MONTH)} scroll={false} className="rounded-md bg-card px-2 py-0.5 text-xs font-semibold shadow-sm">{ui.thisMonthBtn}</Link>
        ) : null}
      </div>
      <Link href={hrefFor(shiftMonth(month, 1))} scroll={false} aria-label={ui.nextMonth} className={arrow}>
        <Icon name="chevron-right" size={18} />
      </Link>
    </nav>
  );
}

import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { ToneBadge, type Tone } from '@/components/cfk/tone-badge';
import { fmt } from '@/lib/format';
import { localized, type Dict } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { cn } from '@/lib/utils';
import { getBillSummary, listBills } from '@/server/bill/service';
import type { BillStatus } from '@/server/views';
import { BillCheck } from './bill-check';
import { BillsCalendar } from './bills-calendar';

const STATUS_ORDER: BillStatus[] = ['overdue', 'dueToday', 'dueSoon', 'upcoming', 'paid'];
const STATUS_TONE: Record<BillStatus, Tone> = { overdue: 'danger', dueToday: 'warning', dueSoon: 'warning', upcoming: 'neutral', paid: 'success' };
const statusLabel = (s: BillStatus, ui: Dict): string =>
  ({ overdue: ui.overdue, dueToday: ui.dueToday, dueSoon: ui.dueSoon, upcoming: ui.upcoming, paid: ui.billsPaid })[s];

export default async function BillsPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const view = firstParam(await searchParams, 'view') === 'calendar' ? 'calendar' : 'list';
  const [summary, bills] = await Promise.all([getBillSummary(), listBills()]);

  return (
    <>
      <PageTitle title={ui.nav.bills} />
      <Card className="gap-3 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.billsTotal}</p>
        <p className="text-4xl font-extrabold tabular-nums">{fmt(summary.total)}</p>
        <div className="flex gap-6">
          <div><p className="text-xs text-muted-foreground">{ui.billsPaid}</p><p className="font-bold text-type-xls-fg tabular-nums">{fmt(summary.paid)}</p></div>
          <div><p className="text-xs text-muted-foreground">{ui.billsRemaining}</p><p className="font-bold text-destructive tabular-nums">{fmt(summary.remaining)}</p></div>
        </div>
        <Progress value={summary.total ? summary.paid / summary.total : 0} tone="success" className="h-2.5" />
      </Card>

      <SegmentedLinks value={view} options={[{ key: 'list', label: ui.viewList }, { key: 'calendar', label: ui.viewCalendar }]} hrefFor={(k) => `/bills?view=${k}`} />

      {view === 'calendar' ? (
        <BillsCalendar bills={bills} />
      ) : (
        STATUS_ORDER.map((status) => {
          const items = bills.filter((b) => b.status === status);
          if (items.length === 0) return null;
          return (
            <section key={status} className="grid gap-2">
              <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{statusLabel(status, ui)}</span>
                <span className="tabular-nums">{items.length}</span>
              </div>
              <Card className="gap-0 overflow-hidden p-0">
                {items.map((b, i) => (
                  <div key={b.id} className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t')}>
                    <BillCheck id={b.id} paid={b.paid} />
                    <Tile icon={b.icon} tint={b.tint} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-semibold', b.paid && 'text-muted-foreground line-through')}>{localized(lang, b.name, b.th)}</p>
                      <p className="text-xs text-muted-foreground">{ui.dueOn} {b.dueDay}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold tabular-nums">{fmt(b.amount)}</span>
                      <ToneBadge label={statusLabel(b.status, ui)} tone={STATUS_TONE[b.status]} />
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          );
        })
      )}
    </>
  );
}

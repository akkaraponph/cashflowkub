import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { ToneBadge, type Tone } from '@/components/cfk/tone-badge';
import { fmt } from '@/lib/format';
import { localized, pickLabel, type Dict } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { cn } from '@/lib/utils';
import { getBillSummary, listBills } from '@/server/bill/service';
import type { BillStatus } from '@/server/views';
import { BillCheck } from './bill-check';
import { BillDialog } from './bill-dialog';
import { BillsCalendar } from './bills-calendar';

const STATUS_ORDER: BillStatus[] = ['overdue', 'dueToday', 'dueSoon', 'upcoming', 'paid'];
const STATUS_TONE: Record<BillStatus, Tone> = { overdue: 'danger', dueToday: 'warning', dueSoon: 'warning', upcoming: 'neutral', paid: 'success' };
const statusLabel = (s: BillStatus, ui: Dict): string =>
  ({ overdue: ui.overdue, dueToday: ui.dueToday, dueSoon: ui.dueSoon, upcoming: ui.upcoming, paid: ui.billsPaid })[s];

export default async function BillsPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const sp = await searchParams;
  const view = firstParam(sp, 'view') === 'calendar' ? 'calendar' : 'list';
  const rawKind = firstParam(sp, 'kind');
  const kind = rawKind === 'bill' || rawKind === 'subscription' ? rawKind : 'all';
  const [summary, bills] = await Promise.all([getBillSummary(), listBills(undefined, kind === 'all' ? undefined : kind)]);
  const href = (k: string, v: string) => `/bills?view=${v}${k === 'all' ? '' : `&kind=${k}`}`;

  return (
    <>
      <PageTitle title={ui.nav.bills} addTransaction={false}>
        <BillDialog kind={kind === 'subscription' ? 'subscription' : 'bill'} />
      </PageTitle>
      <Card className="gap-3 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.billsTotal}</p>
        <p className="text-4xl font-extrabold tabular-nums">{fmt(summary.total)}</p>
        <div className="flex gap-6">
          <div><p className="text-xs text-muted-foreground">{ui.billsPaid}</p><p className="font-bold text-type-xls-fg tabular-nums">{fmt(summary.paid)}</p></div>
          <div><p className="text-xs text-muted-foreground">{ui.billsRemaining}</p><p className="font-bold text-destructive tabular-nums">{fmt(summary.remaining)}</p></div>
          <div><p className="text-xs text-muted-foreground">{ui.subscriptionsMonthly}</p><p className="font-bold tabular-nums">{fmt(summary.subscriptionsTotal)}</p></div>
        </div>
        <Progress value={summary.total ? summary.paid / summary.total : 0} tone="success" className="h-2.5" />
      </Card>

      <SegmentedLinks value={view} options={[{ key: 'list', label: ui.viewList }, { key: 'calendar', label: ui.viewCalendar }]} hrefFor={(k) => href(kind, k)} />
      <SegmentedLinks value={kind} options={[{ key: 'all', label: ui.all }, { key: 'bill', label: ui.billKind.bill }, { key: 'subscription', label: ui.billKind.subscription }]} hrefFor={(k) => href(k, view)} />

      {bills.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{ui.noBills}</p> : null}

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
                      <p className="text-xs text-muted-foreground">{ui.dueOn} {b.dueDay}{b.kind === 'subscription' ? ` · ${pickLabel(ui.billKind, b.kind)}` : ''}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold tabular-nums">{fmt(b.amount)}</span>
                      <ToneBadge label={statusLabel(b.status, ui)} tone={STATUS_TONE[b.status]} />
                    </div>
                    <BillDialog bill={b} />
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

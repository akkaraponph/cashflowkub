import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/cfk/icon';
import { MonthPicker } from '@/components/cfk/month-picker';
import { PageTitle } from '@/components/cfk/page-title';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Pager } from '@/components/cfk/pager';
import { TxRow } from '@/components/cfk/tx-row';
import { TxSheet } from '@/components/cfk/tx-sheet';
import { CURRENT_MONTH, today } from '@/lib/clock';
import { getI18n } from '@/lib/prefs-server';
import { DEFAULT_PAGE_SIZE, parsePaging } from '@/lib/pagination';
import { byKey, firstParam, type SearchParams } from '@/lib/search-params';
import { monthRange, shiftMonth } from '@/lib/tx-sheet';
import { listResource } from '@/server/reference/service';
import type { TxView } from '@/server/transaction/logic';
import { listTransactionPage } from '@/server/transaction/service';

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const sp = await searchParams;
  const raw = firstParam(sp, 'type');
  const type = raw === 'income' || raw === 'expense' ? raw : undefined;
  const asked = firstParam(sp, 'month');
  const month = asked && monthRange(asked) ? asked : CURRENT_MONTH;
  const range = monthRange(month)!;
  const { page: askedPage, size } = parsePaging(firstParam(sp, 'page'), firstParam(sp, 'size'));
  const [{ rows: txs, total, page }, categories, accounts, goals] = await Promise.all([
    listTransactionPage({ from: range.from, to: range.to }, askedPage, size),
    listResource('categories'),
    listResource('accounts'),
    listResource('goals'),
  ]);
  const cats = byKey(categories);
  const defaultDate = month === CURRENT_MONTH ? today().toISOString().slice(0, 10) : `${month}-01`;
  const monthLabel = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(range.from);
  const maxId = txs.reduce((m, t) => Math.max(m, t.id), 0);

  const listed = txs.filter((t) => (type === 'income' ? t.amount > 0 : type === 'expense' ? t.amount < 0 : true));
  const groups: { label: string; items: TxView[] }[] = [];
  for (const t of listed) {
    const last = groups.at(-1);
    if (last?.label === t.group) last.items.push(t);
    else groups.push({ label: t.group, items: [t] });
  }

  const href = (over: { month?: string; page?: number; size?: number; type?: string | null } = {}) => {
    const q = new URLSearchParams();
    q.set('month', over.month ?? month);
    const t = over.type === undefined ? type : over.type;
    if (t) q.set('type', t);
    const sz = over.size ?? size;
    if (sz !== DEFAULT_PAGE_SIZE) q.set('size', String(sz));
    const pg = over.page ?? page;
    if (pg !== 1) q.set('page', String(pg));
    return `/transactions?${q}`;
  };
  const pager = total > 0 ? <Pager page={page} size={size} total={total} hrefFor={(p) => href(p)} /> : null;

  const nav = 'flex size-9 items-center justify-center rounded-lg border bg-secondary hover:opacity-80';
  return (
    <div data-wide className="space-y-4">
      <PageTitle title={ui.nav.transactions}>
        <Link href={href({ month: shiftMonth(month, -1), page: 1 })} aria-label={ui.sheet.prevMonth} className={nav}><Icon name="chevron-left" size={18} /></Link>
        <span className="hidden min-w-32 text-center text-sm font-semibold sm:inline">{monthLabel}</span>
        <Link href={href({ month: shiftMonth(month, 1), page: 1 })} aria-label={ui.sheet.nextMonth} className={nav}><Icon name="chevron-right" size={18} /></Link>
        <MonthPicker month={month} />
      </PageTitle>

      <TxSheet
        key={`${month}:${page}:${size}:${txs.length}:${maxId}`}
        rows={[...txs].reverse()}
        categories={categories}
        accounts={accounts}
        goals={goals.map((g) => ({ name: g.name }))}
        defaultDate={defaultDate}
        summaryCaption={total > size ? ui.sheet.pageTotals : undefined}
      />
      <div className="hidden md:block">{pager}</div>

      <div className="grid gap-4 md:hidden">
        <SegmentedLinks
          value={type ?? 'all'}
          options={[{ key: 'all', label: ui.all }, { key: 'income', label: ui.income }, { key: 'expense', label: ui.expenses }]}
          hrefFor={(k) => href({ type: k === 'all' ? null : k, page: 1 })}
        />
        {groups.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">—</p> : null}
        {groups.map((g) => (
          <section key={g.label} className="grid gap-2">
            <h2 className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h2>
            <Card className="gap-0 px-4 py-1">
              {g.items.map((t, i) => <TxRow key={t.id} tx={t} cat={cats.get(t.cat)} className={i > 0 ? 'border-t' : undefined} />)}
            </Card>
          </section>
        ))}
        {pager}
      </div>
    </div>
  );
}

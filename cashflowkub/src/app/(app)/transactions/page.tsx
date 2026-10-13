import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { TxRow } from '@/components/cfk/tx-row';
import { getI18n } from '@/lib/prefs-server';
import { byKey, firstParam, type SearchParams } from '@/lib/search-params';
import { listResource } from '@/server/reference/service';
import type { TxView } from '@/server/transaction/logic';
import { listTransactions } from '@/server/transaction/service';

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui } = await getI18n();
  const raw = firstParam(await searchParams, 'type');
  const type = raw === 'income' || raw === 'expense' ? raw : undefined;
  const [txs, categories] = await Promise.all([listTransactions({ type }), listResource('categories')]);
  const cats = byKey(categories);

  const groups: { label: string; items: TxView[] }[] = [];
  for (const t of txs) {
    const last = groups.at(-1);
    if (last?.label === t.group) last.items.push(t);
    else groups.push({ label: t.group, items: [t] });
  }

  return (
    <>
      <PageTitle title={ui.nav.transactions} />
      <SegmentedLinks
        value={type ?? 'all'}
        options={[{ key: 'all', label: ui.all }, { key: 'income', label: ui.income }, { key: 'expense', label: ui.expenses }]}
        hrefFor={(k) => (k === 'all' ? '/transactions' : `/transactions?type=${k}`)}
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
    </>
  );
}

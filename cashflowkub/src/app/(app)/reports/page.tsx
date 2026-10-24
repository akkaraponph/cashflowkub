import { Card } from '@/components/ui/card';
import { CashflowBars, Donut } from '@/components/cfk/charts';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { tintFg } from '@/components/cfk/tint';
import { compact, fmt } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { byKey } from '@/lib/search-params';
import { getBackendReports, getBackendResource } from '@/server/backend/client';

export default async function ReportsPage() {
  const { ui, lang } = await getI18n();
  const [r, categories] = await Promise.all([getBackendReports(), getBackendResource('categories')]);
  const cats = byKey(categories);

  return (
    <>
      <PageTitle title={ui.nav.reports} />
      <Card className="gap-4 p-5">
        <h2 className="font-bold">{ui.breakdown}</h2>
        <div className="flex flex-wrap items-center gap-5">
          <Donut segments={r.breakdown.map((b) => ({ value: b.spent, color: tintFg(b.tint) }))} centerLabel={ui.spent} centerValue={compact(r.spendTotal)} />
          <ul className="flex min-w-48 flex-1 flex-col gap-2.5">
            {r.breakdown.map((b) => (
              <li key={b.cat} className="flex items-center gap-2 text-[13px]">
                <span className="size-2.5 rounded-sm" style={{ background: tintFg(b.tint) }} />
                <span className="flex-1 truncate">{localized(lang, b.label, b.th)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{fmt(b.spent)} · {Math.round(b.pct)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <Card className="gap-0 px-5 py-3">
        <h2 className="py-2 font-bold">{ui.topMerchants}</h2>
        {r.topMerchants.map((m) => {
          const cat = cats.get(m.cat);
          return <ListRow key={m.name} icon={cat?.icon ?? 'circle'} tint={cat?.tint} title={m.name} right={fmt(m.total)} className="border-t" />;
        })}
      </Card>
      <Card className="gap-4 p-5">
        <h2 className="font-bold">{ui.cashflow}</h2>
        <CashflowBars data={r.monthly} />
      </Card>
    </>
  );
}

import { Card } from '@/components/ui/card';
import { TrendChart } from '@/components/cfk/charts';
import { Hero } from '@/components/cfk/hero';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { SplitBar } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { fmt, fmtRate } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { getBackendNetWorth } from '@/server/backend/client';

export default async function NetWorthPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const tab = firstParam(await searchParams, 'tab') === 'liabilities' ? 'liabilities' : 'assets';
  const nw = await getBackendNetWorth();
  const gross = nw.totalAssets + nw.totalLiab;

  return (
    <>
      <PageTitle title={ui.nav.networth} />
      <Hero>
        <p className="text-[13px] font-semibold uppercase tracking-wider opacity-70">{ui.netWorth}</p>
        <p className="mt-2 text-4xl font-extrabold tabular-nums">{fmt(nw.netWorth)}</p>
      </Hero>
      <Card className="gap-3 p-5">
        <SplitBar left={gross ? nw.totalAssets / gross : 0} />
        <div className="flex justify-between text-[13px] font-semibold tabular-nums">
          <span className="text-type-xls-fg">+{fmt(nw.totalAssets)} {ui.assets}</span>
          <span className="text-destructive">-{fmt(nw.totalLiab)} {ui.liabilities}</span>
        </div>
      </Card>
      <Card className="gap-4 p-5">
        <h2 className="font-bold">{ui.networthTrend}</h2>
        <TrendChart values={nw.history.map((p) => p.value)} labels={nw.history.map((p) => localized(lang, p.month, p.monthTh))} />
      </Card>
      <SegmentedLinks value={tab} options={[{ key: 'assets', label: ui.assets }, { key: 'liabilities', label: ui.liabilities }]} hrefFor={(k) => `/networth?tab=${k}`} />
      <Card className="gap-0 px-5 py-1">
        {tab === 'assets'
          ? nw.assets.map((a, i) => (
              <ListRow key={a.id} icon={a.icon} tint={a.tint} title={localized(lang, a.name, a.th)} right={fmt(a.value)}
                rightSub={`${nw.totalAssets ? Math.round((a.value / nw.totalAssets) * 100) : 0}%`} className={i > 0 ? 'border-t' : undefined} />
            ))
          : nw.liabilities.map((d, i) => (
              <ListRow key={d.id} icon={d.icon} tint={d.tint} title={localized(lang, d.name, d.th)} subtitle={`${ui.apr} ${fmtRate(d.apr)}%`}
                right={<span className="text-sm font-bold text-destructive tabular-nums">-{fmt(d.remaining)}</span>}
                href={`/debts/${d.id}`} className={i > 0 ? 'border-t' : undefined} />
            ))}
      </Card>
    </>
  );
}

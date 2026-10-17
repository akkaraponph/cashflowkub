import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Donut } from '@/components/cfk/charts';
import { Hero, HeroPill } from '@/components/cfk/hero';
import { Icon } from '@/components/cfk/icon';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { ToneBadge } from '@/components/cfk/tone-badge';
import { Progress } from '@/components/cfk/progress';
import { fmt, pct } from '@/lib/format';
import { localized, pickLabel } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { parseStrategy, sortByStrategy } from '@/server/debt/logic';
import { listDebts } from '@/server/debt/service';
import { debtSummary } from '@/server/debt/summary';
import { AddDebtDialog } from './add-debt-dialog';
import { DueBadge } from './due-badge';

export default async function DebtsPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const strategy = parseStrategy(firstParam(await searchParams, 'strategy'));
  const [active, paid] = await Promise.all([listDebts('active'), listDebts('paid')]);
  const { totalRemaining, totalOriginal, totalPaid, monthlyTotal, progress, avgApr, avgMonthlyRate } = debtSummary(active);

  return (
    <>
      <PageTitle title={ui.nav.debts}>
        <Button asChild size="sm">
          <Link href="/debts/plan"><Icon name="lightbulb" size={16} />{ui.smartPlan}</Link>
        </Button>
        <AddDebtDialog />
      </PageTitle>

      <Hero>
        <div className="flex items-center gap-5">
          <Donut size={96} stroke={12} trackColor="rgb(255 255 255 / 0.18)" segments={[{ value: progress, color: 'var(--hero-fg)' }]} centerValue={`${Math.round(progress * 100)}%`} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{ui.totalDebt}</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums">{fmt(totalRemaining)}</p>
            <p className="text-sm opacity-75 tabular-nums">{ui.of} {fmt(totalOriginal)} · {ui.paidSoFar} {fmt(totalPaid)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <HeroPill><span className="tabular-nums">{active.length}</span> {ui.active}</HeroPill>
          <HeroPill><span className="tabular-nums">{paid.length}</span> {ui.paidOff}</HeroPill>
          <HeroPill>{ui.avgRate} <span className="tabular-nums">{avgApr.toFixed(1)}%</span> <span className="tabular-nums opacity-75">({avgMonthlyRate.toFixed(2)}%{ui.perMonth})</span></HeroPill>
          <HeroPill>{ui.monthlyDebtPay} <span className="tabular-nums">{fmt(monthlyTotal)}</span></HeroPill>
        </div>
      </Hero>

      <Card className="gap-3 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.strategy}</p>
        <SegmentedLinks
          value={strategy}
          options={[{ key: 'avalanche', label: ui.avalanche }, { key: 'snowball', label: ui.snowball }, { key: 'custom', label: ui.custom }]}
          hrefFor={(k) => `/debts?strategy=${k}`}
        />
        <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{ui.strategyTip[strategy]}</p>
      </Card>

      <Card className="gap-1 px-5 py-3">
        <div className="flex justify-between py-2">
          <h2 className="font-bold">{ui.active}</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{active.length}</span>
        </div>
        {sortByStrategy(active, strategy).map((d) => (
          <ListRow
            key={d.id}
            icon={d.icon}
            tint={d.tint}
            title={localized(lang, d.name, d.th)}
            subtitle={`${pickLabel(ui.debtKind, d.kind)} · ${ui.apr} ${d.apr}% · ${fmt(d.installment)}${ui.perMonth} · ${pct(d.progress)}`}
            right={fmt(d.remaining)}
            rightSub={
              <div className="flex flex-col items-end gap-1">
                <DueBadge due={d.due} />
                <Progress value={d.progress} className="h-1.5 w-20" />
              </div>
            }
            href={`/debts/${d.id}`}
            className="border-t"
          />
        ))}
      </Card>

      {paid.length > 0 ? (
        <Card className="gap-3 p-5">
          <h2 className="font-bold text-type-xls-fg">{ui.paidOff}</h2>
          {paid.map((d) => (
            <div key={d.id} className="flex items-center gap-3 opacity-70">
              <ToneBadge label="✓" tone="success" />
              <span className="flex-1 truncate text-sm font-semibold line-through">{localized(lang, d.name, d.th)}</span>
              <span className="text-sm font-bold tabular-nums">{fmt(d.original)}</span>
            </div>
          ))}
        </Card>
      ) : null}
    </>
  );
}

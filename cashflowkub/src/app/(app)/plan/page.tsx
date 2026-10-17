import { MonthPicker } from '@/components/cfk/month-picker';
import { Card } from '@/components/ui/card';
import { Donut, TrendChart } from '@/components/cfk/charts';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { CURRENT_MONTH } from '@/lib/clock';
import { fmt, signed } from '@/lib/format';
import { resolveMonth } from '@/lib/month';
import { localized, type Dict, type Lang } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { cn } from '@/lib/utils';
import type { PlanGroup } from '@/server/plan/logic';
import { PlanItemDialog } from './plan-item-dialog';
import type { PlanType } from './plan-form';
import { getPlan, getSnapshots } from '@/server/plan/service';

const GROUP_META: Record<string, { label: keyof Dict; icon: string; tint: string }> = {
  bank: { label: 'bankAcctsGroup', icon: 'landmark', tint: 'doc' },
  savings: { label: 'savingsGroup', icon: 'piggy-bank', tint: 'xls' },
  invest: { label: 'investmentsGroup', icon: 'trending-up', tint: 'folder' },
  other: { label: 'otherAssetsGroup', icon: 'package', tint: 'image' },
};

function PlanSection({ title, group, type, month, expense, ui, lang }: { title: string; group: PlanGroup; type: PlanType; month: string; expense?: boolean; ui: Dict; lang: Lang }) {
  return (
    <Card className="gap-0 px-5 py-3">
      <div className="flex items-center justify-between gap-2 py-1">
        <h2 className="font-bold">{title}</h2>
        <PlanItemDialog type={type} month={month} />
      </div>
      {group.items.length === 0 ? <p className="border-t py-3 text-sm text-muted-foreground">{ui.noPlanItems}</p> : null}
      {group.items.map((it) => (
        <div key={it.id} className="grid gap-1.5 border-t py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 truncate text-sm font-semibold">{localized(lang, it.name, it.th)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{ui.planned} {fmt(it.planned)} · {ui.actualLbl} {fmt(it.actual)}</span>
            <PlanItemDialog type={type} month={month} item={it} />
          </div>
          <Progress value={it.planned ? it.actual / it.planned : 0} tone={expense && it.actual > it.planned ? 'danger' : 'primary'} />
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t pt-3 text-sm tabular-nums">
        <span className="text-muted-foreground">{ui.totalPlanned} {fmt(group.totalPlanned)}</span>
        <span className="font-bold">{ui.totalActual} {fmt(group.totalActual)}</span>
      </div>
    </Card>
  );
}

function RatioDonut({ label, ratio }: { label: string; ratio: number }) {
  const r = Math.max(0, ratio);
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <Donut size={96} stroke={12} segments={[{ value: r, color: 'var(--primary)' }, { value: Math.max(0, 100 - r), color: 'var(--secondary)' }]} centerValue={`${Math.round(r)}%`} />
      <span className="text-center text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default async function PlanPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const sp = await searchParams;
  const raw = firstParam(sp, 'tab');
  const tab = raw === 'summary' || raw === 'assets' ? raw : 'monthly';
  const month = resolveMonth(firstParam(sp, 'month'), CURRENT_MONTH);
  const plan = await getPlan(month);

  return (
    <>
      <PageTitle title={ui.nav.plan}>{tab === 'assets' ? null : <MonthPicker month={month} basePath="/plan" />}</PageTitle>
      <SegmentedLinks
        value={tab}
        options={[{ key: 'monthly', label: ui.planTabMonthly }, { key: 'summary', label: ui.planTabSummary }, { key: 'assets', label: ui.planTabAssets }]}
        hrefFor={(k) => `/plan?tab=${k}&month=${month}`}
      />
      {tab === 'monthly' ? (
        <>
          <PlanSection title={ui.incomeplan} group={plan.income} type="income" month={month} ui={ui} lang={lang} />
          <PlanSection title={ui.expenseplan} group={plan.expense} type="expense" month={month} expense ui={ui} lang={lang} />
          <PlanSection title={ui.savingsplan} group={plan.savings} type="savings" month={month} ui={ui} lang={lang} />
        </>
      ) : null}
      {tab === 'summary' ? (
        <>
          <Card className="gap-4 p-5">
            <h2 className="font-bold">{ui.achievement}</h2>
            <div className="flex gap-3">
              <RatioDonut label={ui.incomeRatio} ratio={plan.summary.incomeRatio} />
              <RatioDonut label={ui.expenseUsage} ratio={plan.summary.expenseUsage} />
              <RatioDonut label={ui.savingsplan} ratio={plan.summary.savingsRatio} />
            </div>
          </Card>
          <Card className="gap-3 p-5">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">{ui.plannedNet}</span><span className="font-bold tabular-nums">{fmt(plan.summary.plannedNet)}</span></div>
            <div className="flex justify-between border-t pt-3"><span className="text-sm text-muted-foreground">{ui.actualLbl} {ui.net}</span><span className="font-bold tabular-nums">{fmt(plan.summary.actualNet)}</span></div>
            <div className="flex justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">{ui.netVariance}</span>
              <span className={cn('text-lg font-extrabold tabular-nums', plan.summary.netVariance >= 0 ? 'text-type-xls-fg' : 'text-destructive')}>{signed(plan.summary.netVariance)}</span>
            </div>
          </Card>
        </>
      ) : null}
      {tab === 'assets' ? <AssetsTab ui={ui} lang={lang} /> : null}
    </>
  );
}

async function AssetsTab({ ui, lang }: { ui: Dict; lang: Lang }) {
  const data = await getSnapshots();
  return (
    <>
      <Card className="gap-3 p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.lastUpdated}</p>
          <p className="text-sm font-semibold">{data.labels.lastUpdate}</p>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <div><p className="text-xs text-muted-foreground">{localized(lang, data.labels.prev, data.labels.prevTh)}</p><p className="text-lg font-extrabold tabular-nums">{fmt(data.prev)}</p></div>
          <span className="text-muted-foreground">→</span>
          <div className="text-right"><p className="text-xs text-muted-foreground">{localized(lang, data.labels.curr, data.labels.currTh)}</p><p className="text-lg font-extrabold tabular-nums">{fmt(data.curr)}</p></div>
        </div>
        <p className={cn('text-sm font-bold tabular-nums', data.delta >= 0 ? 'text-type-xls-fg' : 'text-destructive')}>{signed(data.delta)}</p>
      </Card>
      {data.groups.map((g) => {
        const meta = GROUP_META[g.group] ?? { label: undefined, icon: 'circle', tint: 'doc' };
        return (
          <Card key={g.group} className="gap-0 px-5 py-3">
            <div className="flex items-center gap-3 py-1">
              <Tile icon={meta.icon} tint={meta.tint} size={32} />
              <h2 className="flex-1 truncate font-bold">{meta.label ? String(ui[meta.label]) : g.group}</h2>
            </div>
            {g.items.map((it) => {
              const delta = it.curr - it.prev;
              return (
                <div key={it.id} className="flex items-center gap-3 border-t py-2.5">
                  <Tile icon={it.icon} tint={it.tint} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{localized(lang, it.name, it.th)}</span>
                  <div className="text-right">
                    <p className="text-[13px] font-bold tabular-nums">{fmt(it.prev)} → {fmt(it.curr)}</p>
                    <p className={cn('text-xs tabular-nums', delta >= 0 ? 'text-type-xls-fg' : 'text-destructive')}>{signed(delta)}</p>
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}
      <Card className="gap-4 p-5">
        <h2 className="font-bold">{ui.netWorthHist}</h2>
        <TrendChart values={data.history.map((p) => p.value)} labels={data.history.map((p) => localized(lang, p.month, p.monthTh))} />
      </Card>
    </>
  );
}

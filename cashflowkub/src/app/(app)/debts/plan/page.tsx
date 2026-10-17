import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Donut } from '@/components/cfk/charts';
import { Icon } from '@/components/cfk/icon';
import { PageTitle } from '@/components/cfk/page-title';
import { ToneBadge, type Tone } from '@/components/cfk/tone-badge';
import { fmt, pct } from '@/lib/format';
import { fill, localized, type Dict, type Lang } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import type { SearchParamsRecord } from '@/lib/search-params';
import { cn } from '@/lib/utils';
import type { DsrBand, SmartAction } from '@/server/debt/dsr';
import { getPayoffComparison, getSmartPlan, parsePlanningParams } from '@/server/debt/planning';
import { listActiveDebtViews } from '@/server/debt/service';
import { HttpError } from '@/server/errors';
import type { DebtView } from '@/server/views';
import { IncomeDialog } from './income-dialog';
import { Select } from '@/components/ui/select';

const BAND_TONE: Record<DsrBand, Tone> = { healthy: 'success', manageable: 'info', high: 'warning', critical: 'danger' };
const BAND_COLOR: Record<DsrBand, string> = {
  healthy: 'var(--type-xls-fg)', manageable: 'var(--type-doc-fg)', high: 'var(--type-folder-fg)', critical: 'var(--destructive)',
};

function toParams(sp: SearchParamsRecord): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') out.set(k, v);
  return out;
}

/** Invalid query values fall back to defaults instead of erroring the page. */
function safeParams(sp: SearchParamsRecord) {
  try {
    return parsePlanningParams(toParams(sp));
  } catch (err) {
    if (err instanceof HttpError) return parsePlanningParams(new URLSearchParams());
    throw err;
  }
}

function actionText(a: SmartAction, ui: Dict, lang: Lang, debts: Map<number, DebtView>): string {
  const d = a.debtId !== undefined ? debts.get(a.debtId) : undefined;
  return fill(ui.action[a.key], { debt: d ? localized(lang, d.name, d.th) : '', amount: fmt(a.amount ?? 0) });
}

export default async function SmartPlanPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const { ui, lang } = await getI18n();
  const { strategy, extra, target } = safeParams(await searchParams);
  const [plan, comparison, debts] = await Promise.all([getSmartPlan(target), getPayoffComparison(strategy, extra), listActiveDebtViews()]);
  const byId = new Map(debts.map((d) => [d.id, d]));
  const { dsr } = plan;

  return (
    <>
      <PageTitle title={ui.smartPlan} back="/debts" />

      <Card className="gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><Icon name="gauge" size={17} />{ui.dsrTitle}</h2>
            <p className="text-xs text-muted-foreground">{ui.dsrSub}</p>
          </div>
          <IncomeDialog income={dsr.income} />
        </div>
        {dsr.ratio === null || dsr.band === null ? (
          <p className="rounded-xl bg-secondary p-4 text-sm">{ui.setIncomeFirst}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-5">
            <Donut size={120} stroke={14} segments={[{ value: Math.min(1, dsr.ratio), color: BAND_COLOR[dsr.band] }]} centerValue={pct(dsr.ratio)} />
            <div className="grid flex-1 gap-2 text-sm">
              <ToneBadge label={ui.dsrBand[dsr.band]} tone={BAND_TONE[dsr.band]} className="w-fit" />
              <div className="flex justify-between"><span className="text-muted-foreground">{ui.monthlyIncome}</span><span className="font-semibold tabular-nums">{fmt(dsr.income)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{ui.monthlyDebtPay}</span><span className="font-semibold tabular-nums">{fmt(dsr.monthlyDebt)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{ui.targetDsr}</span><span className="font-semibold tabular-nums">{pct(plan.targetDsr)}</span></div>
            </div>
          </div>
        )}
      </Card>

      <Card className="gap-3 p-5">
        <h2 className="flex items-center gap-2 font-bold"><Icon name="lightbulb" size={17} />{ui.actionsTitle}</h2>
        <ol className="grid gap-2">
          {plan.actions.map((a, i) => (
            <li key={`${a.key}-${a.debtId ?? i}`} className={cn('rounded-xl p-3 text-sm', a.key === 'payOverdue' ? 'bg-type-pdf-bg text-type-pdf-fg' : 'bg-secondary')}>
              {actionText(a, ui, lang, byId)}
            </li>
          ))}
        </ol>
        {plan.quickWins.length > 0 && dsr.ratio !== null ? (
          <div className="grid gap-1.5 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.quickWins}</p>
            {plan.quickWins.map((q) => {
              const d = byId.get(q.id);
              return (
                <div key={q.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{d ? localized(lang, d.name, d.th) : q.id}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmt(q.remaining)} → {ui.dsrAfter} {q.dsrAfter === null ? '—' : pct(q.dsrAfter)}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      <Card className="gap-4 p-5">
        <h2 className="font-bold">{ui.simulator}</h2>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {ui.strategy}
            <Select name="strategy" defaultValue={strategy} className="w-44" options={[
              { value: 'avalanche', label: ui.avalanche }, { value: 'snowball', label: ui.snowball }, { value: 'custom', label: ui.custom },
            ]} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {ui.extraPerMonth}
            <Input name="extra" type="number" min={0} step={1} defaultValue={extra} className="w-36" />
          </label>
          <input type="hidden" name="target" value={target} />
          <Button type="submit">{ui.simulate}</Button>
        </form>
        {comparison.baseline.neverPaysOff || comparison.plan.neverPaysOff ? (
          <p className="rounded-xl bg-type-pdf-bg p-4 text-sm text-type-pdf-fg">{ui.neverPaysOff}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {([[ui.minimumOnly, comparison.baseline], [ui.withPlan, comparison.plan]] as const).map(([label, r]) => (
                <div key={label} className="rounded-xl bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-extrabold tabular-nums">{r.months} {ui.monthsUnit}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{ui.interest} {fmt(r.totalInterest)}</p>
                  {r === comparison.plan ? <p className="mt-1 text-[11px] text-muted-foreground">{ui.keepsPaying}</p> : null}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div><p className="text-xs text-muted-foreground">{ui.interestSaved}</p><p className="font-bold text-type-xls-fg tabular-nums">{fmt(Math.max(0, comparison.interestSaved))}</p></div>
              <div><p className="text-xs text-muted-foreground">{ui.monthsSaved}</p><p className="font-bold text-type-xls-fg tabular-nums">{Math.max(0, comparison.monthsSaved)}</p></div>
            </div>
            <div className="grid gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.payoffOrder}</p>
              {comparison.plan.order.map((id, i) => {
                const d = byId.get(id);
                const month = comparison.plan.payoffMonth[id];
                return (
                  <div key={id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="flex-1 truncate">{d ? localized(lang, d.name, d.th) : id}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{month ? fill(ui.monthN, { n: month }) : '—'}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </>
  );
}

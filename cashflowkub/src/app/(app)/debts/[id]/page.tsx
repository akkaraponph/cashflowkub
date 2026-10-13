import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { fmt, pct } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { loadOr404 } from '@/lib/load-or-404';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { parseId } from '@/server/http';
import { getDebtSchedule } from '@/server/debt/service';
import { PayDebtButton } from './pay-button';

export default async function DebtDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const { id } = await params;
  const tab = firstParam(await searchParams, 'tab') === 'schedule' ? 'schedule' : 'overview';
  const { debt: d, schedule, totalInterest } = await loadOr404(async () => getDebtSchedule(parseId(id)));
  const method = d.calc === 'reducing' ? ui.calcReducing : ui.calcFlat;
  const payoff = localized(lang, d.payoff, d.payoffTh);

  return (
    <>
      <PageTitle title={localized(lang, d.name, d.th)} back="/debts" />
      <div className="flex items-center gap-3">
        <Tile icon={d.icon} tint={d.tint} size={48} />
        <p className="text-sm text-muted-foreground">{ui.apr} {d.apr}% · {method}</p>
      </div>

      <Card className="gap-3.5 bg-secondary p-5">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.balance}</p>
            <p className="text-3xl font-extrabold tabular-nums">{fmt(d.remaining)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{ui.of} {fmt(d.original)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.payoff}</p>
            <p className="text-lg font-bold">{payoff}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{d.monthsLeft} {ui.monthsLeftLbl}</p>
          </div>
        </div>
        <Progress value={d.progress} />
        <div className="flex justify-between text-xs font-semibold text-muted-foreground tabular-nums">
          <span>{fmt(d.paid)} {ui.paidOff}</span>
          <span>{pct(d.progress)}</span>
        </div>
      </Card>

      <SegmentedLinks value={tab} options={[{ key: 'overview', label: ui.overview }, { key: 'schedule', label: ui.schedule }]} hrefFor={(k) => `/debts/${d.id}?tab=${k}`} />

      {tab === 'overview' ? (
        <>
          <Card className="gap-0 bg-secondary p-0">
            {([
              [ui.apr, `${d.apr}%`],
              [ui.calcMethod, method],
              [ui.minMonthly, fmt(d.monthly)],
              [ui.originalDebt, fmt(d.original)],
              [ui.payoff, payoff],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between border-b px-4 py-3 text-sm last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </Card>
          <div className="flex gap-2.5">
            <PayDebtButton id={d.id} amount={Math.max(1, d.installment)} disabled={d.done} />
          </div>
        </>
      ) : (
        <>
          <Card className="gap-0 overflow-x-auto bg-secondary p-0">
            <table className="w-full text-xs tabular-nums">
              <thead className="bg-background text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-2.5 text-left">#</th>
                  <th className="px-2 text-left">{ui.amount}</th>
                  <th className="px-2 text-left">{ui.principal}</th>
                  <th className="px-2 text-left">{ui.interest}</th>
                  <th className="px-3.5 text-right">{ui.remaining}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.slice(0, 24).map((r) => (
                  <tr key={r.month} className="border-t">
                    <td className="px-3.5 py-2.5 font-semibold text-muted-foreground">{r.month}</td>
                    <td className="px-2 font-semibold">{fmt(r.payment)}</td>
                    <td className="px-2">{fmt(r.principal)}</td>
                    <td className="px-2 text-destructive">{fmt(r.interest)}</td>
                    <td className="px-3.5 text-right font-semibold">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex justify-between px-1 text-sm">
            <span className="text-muted-foreground">{ui.totalInterest}</span>
            <span className="font-bold text-destructive tabular-nums">{fmt(totalInterest)}</span>
          </div>
        </>
      )}
    </>
  );
}

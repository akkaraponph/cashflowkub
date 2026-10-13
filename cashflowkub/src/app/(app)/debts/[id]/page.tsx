import { Card } from '@/components/ui/card';
import { Icon } from '@/components/cfk/icon';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { fmt, pct } from '@/lib/format';
import { localized, pickLabel } from '@/lib/i18n';
import { loadOr404 } from '@/lib/load-or-404';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { parseId } from '@/server/http';
import { amountOwedNow } from '@/server/debt/cycle';
import { getDebtDetail } from '@/server/debt/service';
import { DueBadge } from '../due-badge';
import { DeletePaymentButton } from './delete-payment-button';
import { RecordPaymentDialog } from './record-payment-dialog';

export default async function DebtDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const { id } = await params;
  const tab = firstParam(await searchParams, 'tab') === 'schedule' ? 'schedule' : 'overview';
  const { debt: d, schedule, totalInterest, payments } = await loadOr404(async () => getDebtDetail(parseId(id)));
  const method = d.calc === 'reducing' ? ui.calcReducing : ui.calcFlat;
  const due = d.due;
  const owedNow = amountOwedNow(due);
  const suggested = Math.max(1, due.state === 'paid' ? d.installment : owedNow);

  return (
    <>
      <PageTitle title={localized(lang, d.name, d.th)} back="/debts" />
      <div className="flex items-center gap-3">
        <Tile icon={d.icon} tint={d.tint} size={48} />
        <div>
          <p className="text-sm font-semibold">{pickLabel(ui.debtKind, d.kind)}{d.lender ? ` · ${d.lender}` : ''}</p>
          <p className="text-sm text-muted-foreground">{ui.apr} {d.apr}% · {method}</p>
        </div>
      </div>

      <Card className="gap-3.5 bg-secondary p-5">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.balance}</p>
            <p className="text-3xl font-extrabold tabular-nums">{fmt(d.remaining)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{ui.of} {fmt(d.original)}</p>
          </div>
          {d.neverPaysOff ? null : (
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.payoff}</p>
              <p className="text-lg font-bold">{localized(lang, d.payoff, d.payoffTh) || '—'}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{d.monthsLeft} {ui.monthsLeftLbl}</p>
            </div>
          )}
        </div>
        <Progress value={d.progress} />
        <div className="flex justify-between text-xs font-semibold text-muted-foreground tabular-nums">
          <span>{fmt(d.paid)} {ui.paidOff}</span>
          <span>{pct(d.progress)}</span>
        </div>
      </Card>

      {d.neverPaysOff ? (
        <Card className="flex-row items-start gap-3 border-destructive/40 bg-type-pdf-bg p-4 text-type-pdf-fg">
          <Icon name="triangle-alert" size={18} />
          <p className="text-sm font-medium">{ui.neverPaysOff}</p>
        </Card>
      ) : null}

      {!d.done ? (
        <Card className="gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.nextDue}</span>
            <DueBadge due={due} />
          </div>
          <div className="flex items-end justify-between">
            <span className="text-sm text-muted-foreground tabular-nums">{due.dueDate}</span>
            <span className="text-xl font-extrabold tabular-nums">{fmt(due.state === 'paid' ? d.installment : due.amountDue - due.paidThisCycle)}</span>
          </div>
          {due.lateFee > 0 ? (
            <div className="flex justify-between text-sm font-semibold text-destructive tabular-nums">
              <span>{ui.lateFeeAccrued}</span>
              <span>+{fmt(due.lateFee)}</span>
            </div>
          ) : null}
        </Card>
      ) : null}

      <SegmentedLinks value={tab} options={[{ key: 'overview', label: ui.overview }, { key: 'schedule', label: ui.schedule }]} hrefFor={(k) => `/debts/${d.id}?tab=${k}`} />

      {tab === 'overview' ? (
        <>
          <Card className="gap-0 bg-secondary p-0">
            {([
              [ui.instalmentPreview, fmt(d.installment)],
              [ui.calcMethod, method],
              [ui.dueDayLbl, String(d.dueDay)],
              [ui.lateFeeLbl, fmt(d.lateFee)],
              [ui.originalDebt, fmt(d.original)],
              ...(d.neverPaysOff ? [] : [[ui.totalInterest, fmt(d.totalInterestLeft)] as const]),
            ] as readonly (readonly [string, string])[]).map(([label, value]) => (
              <div key={label} className="flex justify-between border-b px-4 py-3 text-sm last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </Card>
          <div className="flex gap-2.5">
            <RecordPaymentDialog debtId={d.id} defaultAmount={suggested} disabled={d.done} />
          </div>
          <Card className="gap-0 px-5 py-3">
            <h2 className="flex items-center gap-2 py-2 font-bold"><Icon name="history" size={16} />{ui.paymentHistory}</h2>
            {payments.length === 0 ? <p className="border-t py-4 text-sm text-muted-foreground">{ui.noPayments}</p> : null}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-t py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tabular-nums">{p.date}</p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    {ui.principal} {fmt(p.principal)} · {ui.interest} {fmt(p.interest)}{p.fee ? ` · ${ui.fee} ${fmt(p.fee)}` : ''}{p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <span className="font-bold tabular-nums">{fmt(p.amount)}</span>
                <DeletePaymentButton debtId={d.id} paymentId={p.id} />
              </div>
            ))}
          </Card>
        </>
      ) : d.neverPaysOff ? null : (
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

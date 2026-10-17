'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { fmt } from '@/lib/format';
import { fill, localized } from '@/lib/i18n';
import { paymentForTarget } from '@/server/debt/schedule';
import type { DebtTerms } from '@/server/debt/terms';
import { useAmortization } from './use-amortization';

/** '' → undefined; otherwise a number clamped to [min, max]. */
function parse(v: string, min: number, max: number, round: boolean): number | undefined {
  if (v.trim() === '' || !Number.isFinite(Number(v))) return undefined;
  const n = Math.min(max, Math.max(min, Number(v)));
  return round ? Math.round(n) : n;
}

export function SchedulePlanner({ debtId, base, todayIso }: { debtId: number; base: DebtTerms; todayIso: string }) {
  const { ui, lang } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [payment, setPayment] = useState('');
  const [apr, setApr] = useState('');
  const [calc, setCalc] = useState<'flat' | 'reducing' | ''>('');
  const [target, setTarget] = useState('');

  const w = {
    payment: parse(payment, 1, 10_000_000, true),
    apr: parse(apr, 0, 200, false),
    calc: calc || undefined,
    targetMonths: parse(target, 1, 600, true),
  };
  const dirty = Object.values(w).some((v) => v !== undefined);
  const plan = useAmortization(base, w, todayIso);
  const baseline = useAmortization(base, {}, todayIso);
  const delta = plan.totalInterest - baseline.totalInterest;
  const totals = plan.rows.reduce((t, r) => ({ payment: t.payment + r.payment, principal: t.principal + r.principal, interest: t.interest + r.interest }), { payment: 0, principal: 0, interest: 0 });
  const needed = w.targetMonths !== undefined ? paymentForTarget({ ...base, apr: w.apr ?? base.apr, calc: w.calc ?? base.calc }, w.targetMonths) : null;

  const reset = () => { setPayment(''); setApr(''); setCalc(''); setTarget(''); };
  const apply = () =>
    startTransition(async () => {
      try {
        await apiFetch(`/debts/${debtId}`, { method: 'PATCH', body: { fixedPayment: plan.terms.fixedPayment, apr: plan.terms.apr, calc: plan.terms.calc } });
        toast.success(ui.savedOk);
        reset();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });

  return (
    <>
      <Card className="gap-3 p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.whatIf}</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="wi-payment">{ui.monthlyPaymentLbl} (฿)</Label>
            <Input id="wi-payment" type="number" inputMode="numeric" min={1} placeholder={String(baseline.terms.fixedPayment || base.monthly || '')}
              value={payment} onChange={(e) => { setPayment(e.target.value); setTarget(''); }} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-apr">{ui.apr} (%/yr)</Label>
            <Input id="wi-apr" type="number" inputMode="decimal" min={0} max={200} placeholder={String(base.apr)} value={apr} onChange={(e) => setApr(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-calc">{ui.calcMethod}</Label>
            <Select id="wi-calc" value={calc || base.calc} onValueChange={(v) => setCalc(v === 'flat' || v === 'reducing' ? (v === base.calc ? '' : v) : '')}
              options={[{ value: 'flat', label: ui.calcFlat }, { value: 'reducing', label: ui.calcReducing }]} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wi-target">{ui.targetPayoff}</Label>
            <Input id="wi-target" type="number" inputMode="numeric" min={1} max={600} value={target} onChange={(e) => { setTarget(e.target.value); setPayment(''); }} />
          </div>
        </div>
        {needed !== null ? <p className="text-sm font-semibold tabular-nums">{fill(ui.needsPerMonth, { amount: fmt(needed) })}</p> : null}
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={!dirty} onClick={reset}>{ui.reset}</Button>
          <Button type="button" size="sm" disabled={!dirty || plan.neverPaysOff || pending} onClick={apply}><Icon name="check" size={16} />{ui.applyToDebt}</Button>
        </div>
      </Card>

      {plan.neverPaysOff ? (
        <Card className="flex-row items-start gap-3 border-destructive/40 bg-type-pdf-bg p-4 text-type-pdf-fg">
          <Icon name="triangle-alert" size={18} />
          <p className="text-sm font-medium">{ui.neverPaysOff}</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Card className="gap-0.5 p-3"><p className="text-xs text-muted-foreground">{ui.monthsLbl}</p><p className="font-bold tabular-nums">{plan.rows.length}</p></Card>
            <Card className="gap-0.5 p-3"><p className="text-xs text-muted-foreground">{ui.payoff}</p><p className="font-bold">{plan.payoff ? localized(lang, plan.payoff.en, plan.payoff.th) : '—'}</p></Card>
            <Card className="gap-0.5 p-3">
              <p className="text-xs text-muted-foreground">{ui.totalInterest}</p>
              <p className="font-bold tabular-nums text-destructive">{fmt(plan.totalInterest)}</p>
              {delta !== 0 ? <p className={`text-[11px] tabular-nums ${delta < 0 ? 'text-type-xls-fg' : 'text-destructive'}`}>{delta > 0 ? '+' : '−'}{fmt(Math.abs(delta))} {ui.interestDelta}</p> : null}
            </Card>
          </div>
          <Card className="max-h-[70svh] gap-0 overflow-auto bg-secondary p-0">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  {[['#', 'text-left px-3.5'], [ui.amount, 'text-right px-2'], [ui.principal, 'text-right px-2'], [ui.interest, 'text-right px-2'], [ui.remaining, 'text-right px-3.5']].map(([h, c]) => (
                    <th key={h} className={`sticky top-0 bg-background py-2.5 ${c}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r) => (
                  <tr key={r.month} className="border-t">
                    <td className="px-3.5 py-2.5 font-semibold text-muted-foreground">{r.month}</td>
                    <td className="px-2 text-right font-semibold">{fmt(r.payment)}</td>
                    <td className="px-2 text-right">{fmt(r.principal)}</td>
                    <td className="px-2 text-right text-destructive">{fmt(r.interest)}</td>
                    <td className="px-3.5 text-right font-semibold">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td className="px-3.5 py-2.5">{ui.totalLbl}</td>
                  <td className="px-2 text-right">{fmt(totals.payment)}</td>
                  <td className="px-2 text-right">{fmt(totals.principal)}</td>
                  <td className="px-2 text-right text-destructive">{fmt(totals.interest)}</td>
                  <td className="px-3.5" />
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      )}
    </>
  );
}

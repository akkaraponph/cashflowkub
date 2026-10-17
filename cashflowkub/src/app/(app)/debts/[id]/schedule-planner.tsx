'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { errorText } from '@/lib/api-error';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
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

/** Copy of `rec` without `key`. */
function without<T>(rec: Record<number, T>, key: number): Record<number, T> {
  const next = { ...rec };
  delete next[key];
  return next;
}

export function SchedulePlanner({ debtId, base, todayIso }: { debtId: number; base: DebtTerms; todayIso: string }) {
  const { ui, lang } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [payment, setPayment] = useState('');
  const [apr, setApr] = useState('');
  const [calc, setCalc] = useState<'flat' | 'reducing' | ''>('');
  const [target, setTarget] = useState('');
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  const [editing, setEditing] = useState<Record<number, string>>({});
  const tableRef = useRef<HTMLTableElement>(null);

  const w = {
    payment: parse(payment, 1, 10_000_000, true),
    apr: parse(apr, 0, 200, false),
    calc: calc || undefined,
    targetMonths: parse(target, 1, 600, true),
  };
  const overridden = Object.keys(overrides).length > 0;
  const dirty = overridden || Object.values(w).some((v) => v !== undefined);
  const plan = useAmortization(base, w, todayIso, overrides);
  const baseline = useAmortization(base, {}, todayIso);
  const delta = plan.totalInterest - baseline.totalInterest;
  const totals = plan.rows.reduce((t, r) => ({ payment: t.payment + r.payment, principal: t.principal + r.principal, interest: t.interest + r.interest }), { payment: 0, principal: 0, interest: 0 });
  const needed = w.targetMonths !== undefined ? paymentForTarget({ ...base, apr: w.apr ?? base.apr, calc: w.calc ?? base.calc }, w.targetMonths) : null;

  const reset = () => { setPayment(''); setApr(''); setCalc(''); setTarget(''); setOverrides({}); setEditing({}); };

  // The regular payment for each month without an override; an edit equal to it is not an override.
  const regular = useAmortization(base, w, todayIso).rows;
  const commitCell = (month: number) => {
    const text = editing[month];
    setEditing((p) => without(p, month));
    if (text === undefined) return;
    const n = parse(text.replace(/[,฿\s]/g, ''), 0, 10_000_000, true);
    const normal = regular[month - 1]?.payment;
    setOverrides((p) => (n === undefined || n === normal ? without(p, month) : { ...p, [month]: n }));
  };
  const focusCell = (month: number) => tableRef.current?.querySelector<HTMLInputElement>(`[data-m="${month}"]`)?.focus();
  const onCellKey = (e: React.KeyboardEvent<HTMLInputElement>, month: number) => {
    if (e.key === 'Escape') {
      setEditing((p) => without(p, month));
      return;
    }
    const dm = e.key === 'Enter' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (dm === 0) return;
    e.preventDefault();
    focusCell(month + dm);
  };
  const apply = () =>
    startTransition(async () => {
      try {
        await apiFetch(`/debts/${debtId}`, { method: 'PATCH', body: { fixedPayment: plan.terms.fixedPayment, apr: plan.terms.apr, calc: plan.terms.calc } });
        toast.success(ui.savedOk);
        reset();
        router.refresh();
      } catch (err) {
        toast.error(errorText(err, ui));
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
            <Label htmlFor="wi-apr">{ui.apr} (%)</Label>
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
        <p className="text-xs text-muted-foreground">{ui.scheduleEditHint}</p>
        {needed !== null ? <p className="text-sm font-semibold tabular-nums">{fill(ui.needsPerMonth, { amount: fmt(needed) })}</p> : null}
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={!dirty} onClick={reset}>{ui.reset}</Button>
          <Button type="button" size="sm" disabled={!dirty || overridden || plan.neverPaysOff || pending} onClick={apply}><Icon name="check" size={16} />{ui.applyToDebt}</Button>
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
          <div className="max-h-[70svh] overflow-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <table ref={tableRef} className="w-full min-w-[28rem] border-collapse text-xs tabular-nums">
              <thead>
                <tr>
                  {[['#', 'w-10'], [ui.amount, ''], [ui.principal, ''], [ui.interest, ''], [ui.remaining, '']].map(([h, c]) => (
                    <th key={h} className={cn('sticky top-0 z-10 border border-border bg-secondary px-1.5 py-1 text-center text-[11px] font-semibold', c)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r) => {
                  const edited = overrides[r.month] !== undefined;
                  return (
                    <tr key={r.month} className="border-t">
                      <td className="w-10 border-r bg-muted text-center text-[10px] text-muted-foreground">{r.month}</td>
                      <td className={cn('border-r p-0', edited && 'bg-amber-500/15')}>
                        <input
                          data-m={r.month}
                          inputMode="numeric"
                          className="h-7 w-full bg-transparent px-1.5 text-right text-xs font-semibold outline-none focus:ring-1 focus:ring-inset focus:ring-primary"
                          value={editing[r.month] ?? String(r.payment)}
                          onFocus={(e) => { setEditing((p) => ({ ...p, [r.month]: String(r.payment) })); e.currentTarget.select(); }}
                          onChange={(e) => setEditing((p) => ({ ...p, [r.month]: e.target.value }))}
                          onBlur={() => commitCell(r.month)}
                          onKeyDown={(e) => onCellKey(e, r.month)}
                        />
                      </td>
                      <td className="border-r px-1.5 text-right">{fmt(r.principal)}</td>
                      <td className="border-r px-1.5 text-right text-destructive">{fmt(r.interest)}</td>
                      <td className="px-1.5 text-right font-semibold">{fmt(r.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-secondary font-semibold">
                  <td className="px-1.5 py-1 text-center">{ui.totalLbl}</td>
                  <td className="px-1.5 py-1 text-right">{fmt(totals.payment)}</td>
                  <td className="px-1.5 py-1 text-right">{fmt(totals.principal)}</td>
                  <td className="px-1.5 py-1 text-right text-destructive">{fmt(totals.interest)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </>
  );
}

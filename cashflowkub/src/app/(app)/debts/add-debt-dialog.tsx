'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { fmt } from '@/lib/format';
import { scheduledInstallment, toApr } from '@/server/debt/terms';
import { Select } from '@/components/ui/select';

const KINDS = ['paylater', 'cashloan', 'bankloan', 'creditcard', 'personal'] as const;
type Kind = (typeof KINDS)[number];
type RateUnit = 'month' | 'year';

// Sensible defaults per product type; every field stays editable.
const PRESETS: Record<Kind, { icon: string; tint: string; calc: 'flat' | 'reducing'; unit: RateUnit; revolving: boolean; lender: string }> = {
  paylater: { icon: 'shopping-bag', tint: 'image', calc: 'flat', unit: 'month', revolving: true, lender: 'Shopee' },
  cashloan: { icon: 'hand-coins', tint: 'folder', calc: 'flat', unit: 'month', revolving: false, lender: 'Shopee' },
  bankloan: { icon: 'landmark', tint: 'doc', calc: 'reducing', unit: 'year', revolving: false, lender: '' },
  creditcard: { icon: 'credit-card', tint: 'pdf', calc: 'reducing', unit: 'year', revolving: true, lender: '' },
  personal: { icon: 'wallet', tint: 'xls', calc: 'flat', unit: 'year', revolving: false, lender: '' },
};

type TextField =
  | 'name' | 'th' | 'lender' | 'original' | 'openingPaid' | 'rate' | 'termMonths'
  | 'fixedPayment' | 'monthly' | 'dueDay' | 'graceDays' | 'lateFee' | 'penaltyApr';

const int = (v: string): number => Math.max(0, Math.round(Number(v) || 0));
const num = (v: string): number => Math.max(0, Number(v) || 0);

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AddDebtDialog() {
  const { ui } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<Kind>('paylater');
  const [unit, setUnit] = useState<RateUnit>('month');
  const [calc, setCalc] = useState<'flat' | 'reducing'>('flat');
  const [revolving, setRevolving] = useState(true);
  const [f, setF] = useState<Record<TextField, string>>({
    name: '', th: '', lender: 'Shopee', original: '', openingPaid: '0', rate: '0', termMonths: '0',
    fixedPayment: '0', monthly: '0', dueDay: '1', graceDays: '0', lateFee: '0', penaltyApr: '0',
  });

  const chooseKind = (k: Kind) => {
    const p = PRESETS[k];
    setKind(k);
    setCalc(p.calc);
    setUnit(p.unit);
    setRevolving(p.revolving);
    setF((prev) => ({ ...prev, lender: prev.lender || p.lender }));
  };

  const terms = {
    original: int(f.original), paid: int(f.openingPaid), apr: toApr(num(f.rate), unit), calc,
    monthly: int(f.monthly), fixedPayment: int(f.fixedPayment), termMonths: int(f.termMonths),
  };
  const preview = terms.original > 0 ? scheduledInstallment(terms) : 0;
  const valid = f.name.trim() !== '' && terms.original > 0 && terms.paid <= terms.original && int(f.dueDay) >= 1 && int(f.dueDay) <= 31;

  const save = () =>
    startTransition(async () => {
      try {
        const p = PRESETS[kind];
        await apiFetch('/debts', {
          method: 'POST',
          body: {
            name: f.name.trim(), th: f.th.trim() || f.name.trim(), kind, lender: f.lender.trim(), icon: p.icon, tint: p.tint,
            original: terms.original, openingPaid: terms.paid, apr: terms.apr, calc, termMonths: terms.termMonths,
            fixedPayment: terms.fixedPayment, monthly: terms.monthly, dueDay: int(f.dueDay), graceDays: int(f.graceDays),
            lateFee: int(f.lateFee), penaltyApr: num(f.penaltyApr), revolving,
          },
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });

  const input = (id: TextField, type: 'text' | 'number' = 'number') => (
    <Input id={`debt-${id}`} type={type} inputMode={type === 'number' ? 'decimal' : undefined} min={0}
      value={f[id]} onChange={(e) => setF((prev) => ({ ...prev, [id]: e.target.value }))} />
  );

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} />
        {ui.addDebt}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{ui.addDebt}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Button key={k} type="button" size="sm" variant={k === kind ? 'default' : 'outline'} onClick={() => chooseKind(k)}>
                {ui.debtKind[k]}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="debt-name" label={ui.debtName}>{input('name', 'text')}</Field>
            <Field id="debt-th" label={`${ui.debtName} (ไทย)`}>{input('th', 'text')}</Field>
            <Field id="debt-lender" label={ui.lender}>{input('lender', 'text')}</Field>
            <Field id="debt-original" label={`${ui.originalDebt} (฿)`}>{input('original')}</Field>
            <Field id="debt-openingPaid" label={`${ui.alreadyPaid} (฿)`}>{input('openingPaid')}</Field>
            <Field id="debt-rate" label={ui.rate}>
              <div className="flex gap-2">
                {input('rate')}
                <Select aria-label={ui.rate} className="w-32 shrink-0" value={unit} onValueChange={(v) => setUnit(v === 'year' ? 'year' : 'month')}
                  options={[{ value: 'month', label: ui.perMonthRate }, { value: 'year', label: ui.perYearRate }]} />
              </div>
            </Field>
            <Field id="debt-calc" label={ui.calcMethod}>
              <Select id="debt-calc" value={calc} onValueChange={(v) => setCalc(v === 'reducing' ? 'reducing' : 'flat')}
                options={[{ value: 'flat', label: ui.calcFlat }, { value: 'reducing', label: ui.calcReducing }]} />
            </Field>
            <Field id="debt-termMonths" label={ui.termMonthsLbl}>{input('termMonths')}</Field>
            <Field id="debt-fixedPayment" label={`${ui.fixedPaymentLbl} (฿)`} hint={ui.fixedPaymentHint}>{input('fixedPayment')}</Field>
            <Field id="debt-monthly" label={`${ui.minPaymentLbl} (฿)`}>{input('monthly')}</Field>
            <Field id="debt-dueDay" label={ui.dueDayLbl}>{input('dueDay')}</Field>
            <Field id="debt-graceDays" label={ui.graceDaysLbl}>{input('graceDays')}</Field>
            <Field id="debt-lateFee" label={ui.lateFeeLbl}>{input('lateFee')}</Field>
            <Field id="debt-penaltyApr" label={ui.penaltyAprLbl}>{input('penaltyApr')}</Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={revolving} onChange={(e) => setRevolving(e.target.checked)} />
            {ui.revolvingLbl}
          </label>
          <div className="flex items-center justify-between rounded-xl bg-secondary p-3">
            <span className="text-sm text-muted-foreground">{ui.instalmentPreview}</span>
            <span className="text-lg font-extrabold tabular-nums">{fmt(preview)}</span>
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!valid || pending} onClick={save}>{ui.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

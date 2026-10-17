'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { fmt } from '@/lib/format';
import { scheduledInstallment, toApr } from '@/server/debt/terms';
import type { DebtView } from '@/server/views';
import { emptyForm, formFromDebt, formToBody, int, KINDS, num, PRESETS, type DebtForm, type Kind, type TextField } from './debt-form';

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Add dialog when `debt` is omitted, edit dialog when it is given. */
export function DebtFormDialog({ debt }: { debt?: DebtView }) {
  const { ui } = useI18n();
  const router = useRouter();
  const editing = debt !== undefined;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<DebtForm>(() => (debt ? formFromDebt(debt) : emptyForm));
  const { kind, unit, calc, revolving, fields: f } = form;

  const openDialog = () => {
    if (debt) setForm(formFromDebt(debt));
    setOpen(true);
  };

  const chooseKind = (k: Kind) => {
    const p = PRESETS[k];
    setForm((prev) => (editing ? { ...prev, kind: k } : { ...prev, kind: k, calc: p.calc, unit: p.unit, revolving: p.revolving, fields: { ...prev.fields, lender: prev.fields.lender || p.lender } }));
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
        const body = formToBody(form, editing ? 'edit' : 'add');
        if (debt) {
          await apiFetch(`/debts/${debt.id}`, { method: 'PATCH', body });
          toast.success(ui.savedOk);
        } else {
          await apiFetch('/debts', { method: 'POST', body });
        }
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });

  const input = (id: TextField, type: 'text' | 'number' = 'number') => (
    <Input id={`debt-${id}`} type={type} inputMode={type === 'number' ? 'decimal' : undefined} min={0}
      value={f[id]} onChange={(e) => setForm((prev) => ({ ...prev, fields: { ...prev.fields, [id]: e.target.value } }))} />
  );

  return (
    <>
      {editing ? (
        <Button size="icon" variant="ghost" aria-label={ui.editDebt} onClick={openDialog}>
          <Icon name="pencil" size={16} />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Icon name="plus" size={16} />
          {ui.addDebt}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? ui.editDebt : ui.addDebt}</DialogTitle>
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
                <Select aria-label={ui.rate} className="w-32 shrink-0" value={unit} onValueChange={(v) => setForm((prev) => ({ ...prev, unit: v === 'year' ? 'year' : 'month' }))}
                  options={[{ value: 'month', label: ui.perMonthRate }, { value: 'year', label: ui.perYearRate }]} />
              </div>
            </Field>
            <Field id="debt-calc" label={ui.calcMethod}>
              <Select id="debt-calc" value={calc} onValueChange={(v) => setForm((prev) => ({ ...prev, calc: v === 'reducing' ? 'reducing' : 'flat' }))}
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
            <input type="checkbox" checked={revolving} onChange={(e) => setForm((prev) => ({ ...prev, revolving: e.target.checked }))} />
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

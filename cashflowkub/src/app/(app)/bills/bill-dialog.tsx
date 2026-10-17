'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useShellData } from '@/components/app-shell/shell-data';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { errorText } from '@/lib/api-error';
import { localized } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Bill } from '@/generated/prisma/client';
import { BILL_KINDS, KIND_PRESETS, billBody, emptyBillForm, formFromBill, type BillForm, type BillKind } from './bill-form';

/** Add dialog when `bill` is omitted (pass `kind` to preselect bill or subscription); edit with delete when it is given. */
export function BillDialog({ bill, kind }: { bill?: Bill; kind?: BillKind }) {
  const { ui, lang } = useI18n();
  const { categories } = useShellData();
  const router = useRouter();
  const editing = bill !== undefined;
  const fresh = (): BillForm => ({ ...emptyBillForm, kind: kind ?? 'bill', cat: KIND_PRESETS[kind ?? 'bill'].cat });
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<BillForm>(() => (bill ? formFromBill(bill, lang) : fresh()));
  const previousKind: BillKind | undefined = bill ? formFromBill(bill, lang).kind : undefined;
  const body = billBody(form, previousKind);
  const expenseCats = categories.filter((c) => c.type === 'expense');

  const openDialog = () => {
    setForm(bill ? formFromBill(bill, lang) : fresh());
    setConfirmDelete(false);
    setOpen(true);
  };

  const run = (task: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await task();
        setOpen(false);
        router.refresh();
      } catch (err) {
        setConfirmDelete(false);
        toast.error(errorText(err, ui));
      }
    });

  const save = () => {
    if (!body) return;
    run(async () => {
      if (bill) await apiFetch(`/bills/${bill.id}`, { method: 'PATCH', body });
      else await apiFetch('/bills', { method: 'POST', body });
      toast.success(ui.savedOk);
    });
  };

  const remove = () => {
    if (!bill) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    run(() => apiFetch(`/bills/${bill.id}`, { method: 'DELETE' }));
  };

  const set = (patch: Partial<BillForm>) => setForm((prev) => ({ ...prev, ...patch }));
  // On add, switching kind also moves the category to that kind's default (bills ↔ fun).
  const chooseKind = (k: BillKind) => set(editing ? { kind: k } : { kind: k, cat: KIND_PRESETS[k].cat });
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  };
  const idp = bill ? `bill-${bill.id}` : 'bill-new';

  return (
    <>
      {editing ? (
        <Button size="icon" variant="ghost" aria-label={ui.editBill} onClick={openDialog}>
          <Icon name="pencil" size={15} />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Icon name="plus" size={16} />
          <span className="hidden sm:inline">{kind === 'subscription' ? ui.addSubscription : ui.addBill}</span>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? ui.editBill : form.kind === 'subscription' ? ui.addSubscription : ui.addBill}</DialogTitle>
          </DialogHeader>
          <div className="flex rounded-xl bg-secondary p-1">
            {BILL_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => chooseKind(k)}
                className={cn('flex-1 rounded-lg py-2 text-sm font-semibold', form.kind === k ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                {ui.billKind[k]}
              </button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-name`}>{ui.nameLbl}</Label>
            <Input id={`${idp}-name`} maxLength={60} value={form.name} onChange={(e) => set({ name: e.target.value })} onKeyDown={onEnter} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`${idp}-amount`}>{ui.amount} (฿)</Label>
              <Input id={`${idp}-amount`} inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} onKeyDown={onEnter} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${idp}-due`}>{ui.dueDayLbl}</Label>
              <Input id={`${idp}-due`} inputMode="numeric" value={form.dueDay} onChange={(e) => set({ dueDay: e.target.value })} onKeyDown={onEnter} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`${idp}-freq`}>{ui.freqLbl}</Label>
              <Select id={`${idp}-freq`} value={form.freq} onValueChange={(v) => set({ freq: v === 'once' ? 'once' : 'monthly' })}
                options={[{ value: 'monthly', label: ui.freqMonthly }, { value: 'once', label: ui.freqOnce }]} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${idp}-cat`}>{ui.category}</Label>
              <Select id={`${idp}-cat`} value={form.cat} onValueChange={(v) => set({ cat: v })}
                options={expenseCats.map((c) => ({ value: c.key, label: localized(lang, c.label, c.th) }))} />
            </div>
          </div>
          <DialogFooter className="sm:flex-col">
            <Button className="w-full" disabled={!body || pending} onClick={save}>{ui.save}</Button>
            {editing ? (
              <Button className="w-full" variant="destructive" disabled={pending} onClick={remove}>
                <Icon name="trash-2" size={15} />
                {confirmDelete ? ui.confirmDeleteBill : ui.delete}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

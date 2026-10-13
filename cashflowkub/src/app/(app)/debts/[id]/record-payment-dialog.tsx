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
import { today } from '@/lib/clock';
import { fill } from '@/lib/i18n';
import { fmt } from '@/lib/format';

export function RecordPaymentDialog({ debtId, defaultAmount, disabled }: { debtId: number; defaultAmount: number; disabled?: boolean }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [date, setDate] = useState(today().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();
  const value = Math.round(Number(amount));

  const save = () =>
    startTransition(async () => {
      try {
        const res = await apiFetch<{ excess: number }>(`/debts/${debtId}/payments`, { method: 'POST', body: { amount: value, date, note } });
        if (res.excess > 0) toast.success(fill(ui.excessReturned, { amount: fmt(res.excess) }));
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });

  return (
    <>
      <Button className="h-11 flex-1" disabled={disabled} onClick={() => { setAmount(String(defaultAmount)); setOpen(true); }}>
        <Icon name="arrow-down-left" size={16} />
        {ui.recordPayment}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ui.recordPayment}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-amount">{ui.amount} (฿)</Label>
            <Input id="pay-amount" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-bold tabular-nums" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-date">{ui.date}</Label>
            <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-note">{ui.note}</Label>
            <Input id="pay-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!(value > 0) || pending} onClick={save}>{ui.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

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

export function IncomeDialog({ income }: { income: number }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(income));
  const [pending, startTransition] = useTransition();
  const n = Number(value);
  const valid = value.trim() !== '' && Number.isInteger(n) && n >= 0;

  const save = () =>
    startTransition(async () => {
      try {
        await apiFetch('/settings', { method: 'PUT', body: { monthlyIncome: n } });
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setValue(String(income)); setOpen(true); }}>
        <Icon name="pencil" size={15} />
        {ui.editIncome}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ui.monthlyIncome}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="income">{ui.monthlyIncome} (฿)</Label>
            <Input id="income" type="number" min={0} step={1} value={value} onChange={(e) => setValue(e.target.value)} className="text-lg font-bold tabular-nums" />
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!valid || pending} onClick={save}>{ui.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

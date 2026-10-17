'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/cfk/icon';
import { Tile } from '@/components/cfk/tile';
import { useI18n } from '@/components/i18n-provider';
import { useShellData } from './shell-data';
import { apiFetch } from '@/lib/api-client';
import { localized } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';

type TxType = 'expense' | 'income';

export function AddTransactionDialog() {
  const { ui, lang } = useI18n();
  const { categories, accounts } = useShellData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [catKey, setCatKey] = useState('food');
  const [acct, setAcct] = useState(accounts[0]?.name ?? '');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const value = Math.round(Number(amount));
  const valid = Number.isFinite(value) && value > 0 && acct !== '';

  const save = () => {
    const cat = type === 'income' ? 'income' : catKey;
    const name = categories.find((c) => c.key === cat)?.label ?? 'Transaction';
    startTransition(async () => {
      try {
        await apiFetch('/transactions', { method: 'POST', body: { name, cat, acct, amount: type === 'income' ? value : -value, note } });
        setOpen(false);
        setAmount('');
        setNote('');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} />
        <span className="hidden sm:inline">{ui.addTx}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ui.addTx}</DialogTitle>
          </DialogHeader>
          <div className="flex rounded-xl bg-secondary p-1">
            {(['expense', 'income'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={cn('flex-1 rounded-lg py-2 text-sm font-semibold', type === t ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                {t === 'expense' ? ui.expense : ui.income}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tx-amount">{ui.amount} (฿)</Label>
            <Input id="tx-amount" inputMode="numeric" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)}
              className="h-14 text-center text-3xl font-extrabold tabular-nums" autoFocus />
          </div>
          {type === 'expense' ? (
            <div className="grid gap-2">
              <Label>{ui.category}</Label>
              <div className="grid grid-cols-4 gap-2">
                {expenseCats.map((c) => (
                  <button key={c.key} type="button" onClick={() => setCatKey(c.key)}
                    className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-2.5', c.key === catKey ? 'border-primary bg-secondary' : 'border-border')}>
                    <Tile icon={c.icon} tint={c.tint} size={34} />
                    <span className="truncate text-[10px] font-medium">{localized(lang, c.short, c.th)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="tx-account">{ui.account}</Label>
            <Select id="tx-account" value={acct} onValueChange={setAcct} options={accounts.map((a) => ({ value: a.name, label: a.name }))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tx-note">{ui.note}</Label>
            <Input id="tx-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!valid || pending} onClick={save}>{ui.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

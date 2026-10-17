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
import { errorText } from '@/lib/api-error';
import type { Account } from '@/generated/prisma/client';
import { ACCOUNT_KINDS, accountBody, emptyAccountForm, formFromAccount, type AccountForm, type AccountKind } from './account-form';

/** Add dialog when `account` is omitted; edit (with delete) when it is given. */
export function AccountDialog({ account }: { account?: Account }) {
  const { ui } = useI18n();
  const router = useRouter();
  const editing = account !== undefined;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<AccountForm>(() => (account ? formFromAccount(account) : emptyAccountForm));
  const previousKind: AccountKind | undefined = account ? formFromAccount(account).kind : undefined;
  const body = accountBody(form, previousKind);

  const openDialog = () => {
    setForm(account ? formFromAccount(account) : emptyAccountForm);
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
      if (account) await apiFetch(`/accounts/${account.id}`, { method: 'PATCH', body });
      else await apiFetch('/accounts', { method: 'POST', body });
      toast.success(ui.savedOk);
    });
  };

  const remove = () => {
    if (!account) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    run(() => apiFetch(`/accounts/${account.id}`, { method: 'DELETE' }));
  };

  const set = (patch: Partial<AccountForm>) => setForm((prev) => ({ ...prev, ...patch }));
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  };
  const idp = account ? `acct-${account.id}` : 'acct-new';

  return (
    <>
      {editing ? (
        <Button size="icon" variant="ghost" aria-label={ui.editAccount} onClick={openDialog}>
          <Icon name="pencil" size={15} />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Icon name="plus" size={16} />
          <span className="hidden sm:inline">{ui.addAccount}</span>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? ui.editAccount : ui.addAccount}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-name`}>{ui.accountName}</Label>
            <Input id={`${idp}-name`} maxLength={60} value={form.name} onChange={(e) => set({ name: e.target.value })} onKeyDown={onEnter} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-sub`}>{ui.accountSub}</Label>
            <Input id={`${idp}-sub`} maxLength={60} value={form.sub} onChange={(e) => set({ sub: e.target.value })} onKeyDown={onEnter} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-kind`}>{ui.accountType}</Label>
            <Select id={`${idp}-kind`} value={form.kind} onValueChange={(v) => set({ kind: ACCOUNT_KINDS.find((k) => k === v) ?? 'bank' })}
              options={ACCOUNT_KINDS.map((k) => ({ value: k, label: ui.accountKind[k] }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-balance`}>{ui.balance} (฿)</Label>
            <Input id={`${idp}-balance`} inputMode="decimal" value={form.balance} onChange={(e) => set({ balance: e.target.value })} onKeyDown={onEnter} />
            {form.kind === 'credit' ? <p className="text-xs text-muted-foreground">{ui.creditBalanceHint}</p> : null}
          </div>
          <DialogFooter className="sm:flex-col">
            <Button className="w-full" disabled={!body || pending} onClick={save}>{ui.save}</Button>
            {editing ? (
              <Button className="w-full" variant="destructive" disabled={pending} onClick={remove}>
                <Icon name="trash-2" size={15} />
                {confirmDelete ? ui.confirmDeleteAccount : ui.delete}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

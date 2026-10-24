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
import { ApiError, apiFetch } from '@/lib/api-client';
import { errorText } from '@/lib/api-error';
import type { PlanItem } from '@/generated/prisma/client';
import { emptyPlanForm, formFromPlanItem, planItemBody, type PlanItemForm, type PlanType } from './plan-form';

/** Add dialog when `item` is omitted; edit (with delete) when it is given. */
export function PlanItemDialog({ type, month, item }: { type: PlanType; month: string; item?: PlanItem }) {
  const { ui, lang } = useI18n();
  const router = useRouter();
  const editing = item !== undefined;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const original = item ? formFromPlanItem(item, lang) : undefined;
  const [form, setForm] = useState<PlanItemForm>(() => original ?? emptyPlanForm);
  const body = planItemBody(form, { type, month }, original);

  const openDialog = () => {
    setForm(original ?? emptyPlanForm);
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
        // The item is already gone (deleted elsewhere): drop the stale row instead of leaving it on screen.
        if (err instanceof ApiError && err.code === 'notFound') {
          setOpen(false);
          router.refresh();
        }
      }
    });

  const save = () => {
    if (!body || pending) return;
    run(async () => {
      if (item) await apiFetch(`/plan/${item.id}`, { method: 'PATCH', body });
      else await apiFetch('/plan', { method: 'POST', body });
      toast.success(ui.savedOk);
    });
  };

  const remove = () => {
    if (!item) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    run(() => apiFetch(`/plan/${item.id}`, { method: 'DELETE' }));
  };

  const set = (patch: Partial<PlanItemForm>) => setForm((prev) => ({ ...prev, ...patch }));
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  };
  const idp = item ? `plan-${item.id}` : `plan-new-${type}`;

  return (
    <>
      {editing ? (
        <Button size="icon" variant="ghost" aria-label={ui.editPlanItem} onClick={openDialog}>
          <Icon name="pencil" size={15} />
        </Button>
      ) : (
        <Button size="sm" variant="outline" aria-label={ui.addPlanItem} onClick={openDialog}>
          <Icon name="plus" size={16} />
          <span className="hidden sm:inline">{ui.addPlanItem}</span>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? ui.editPlanItem : ui.addPlanItem}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-name`}>{ui.nameLbl}</Label>
            <Input id={`${idp}-name`} maxLength={60} value={form.name} onChange={(e) => set({ name: e.target.value })} onKeyDown={onEnter} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-planned`}>{ui.planned} (฿)</Label>
            <Input id={`${idp}-planned`} inputMode="decimal" value={form.planned} onChange={(e) => set({ planned: e.target.value })} onKeyDown={onEnter} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-actual`}>{ui.actualLbl} (฿)</Label>
            <Input id={`${idp}-actual`} inputMode="decimal" value={form.actual} onChange={(e) => set({ actual: e.target.value })} onKeyDown={onEnter} />
          </div>
          <DialogFooter className="sm:flex-col">
            <Button className="w-full" disabled={!body || pending} onClick={save}>{ui.save}</Button>
            {editing ? (
              <Button className="w-full" variant="destructive" disabled={pending} onClick={remove}>
                <Icon name="trash-2" size={15} />
                {confirmDelete ? ui.confirmDeletePlanItem : ui.delete}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
import { errorText } from '@/lib/api-error';
import type { Goal } from '@/generated/prisma/client';
import { GOAL_ICONS, emptyGoalForm, formFromGoal, goalBody, type GoalForm } from './goal-form';

/** Add dialog when `goal` is omitted; edit (with delete) when it is given. */
export function GoalDialog({ goal }: { goal?: Omit<Goal, 'userId'> }) {
  const { ui, lang } = useI18n();
  const router = useRouter();
  const editing = goal !== undefined;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const original = goal ? formFromGoal(goal, lang) : undefined;
  const [form, setForm] = useState<GoalForm>(() => original ?? emptyGoalForm);
  const body = goalBody(form, original);

  const openDialog = () => {
    setForm(original ?? emptyGoalForm);
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
      if (goal) await apiFetch(`/goals/${goal.id}`, { method: 'PATCH', body });
      else await apiFetch('/goals', { method: 'POST', body });
      toast.success(ui.savedOk);
    });
  };

  const remove = () => {
    if (!goal) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    run(() => apiFetch(`/goals/${goal.id}`, { method: 'DELETE' }));
  };

  const set = (patch: Partial<GoalForm>) => setForm((prev) => ({ ...prev, ...patch }));
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  };
  const idp = goal ? `goal-${goal.id}` : 'goal-new';

  return (
    <>
      {editing ? (
        <Button size="icon" variant="ghost" aria-label={ui.editGoal} onClick={openDialog}>
          <Icon name="pencil" size={15} />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Icon name="plus" size={16} />
          <span className="hidden sm:inline">{ui.newGoal}</span>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? ui.editGoal : ui.newGoal}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-name`}>{ui.nameLbl}</Label>
            <Input id={`${idp}-name`} maxLength={60} value={form.name} onChange={(e) => set({ name: e.target.value })} onKeyDown={onEnter} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label>{ui.goalIcon}</Label>
            <div className="flex flex-wrap gap-1">
              {GOAL_ICONS.map((name) => (
                <Button key={name} type="button" size="icon" variant={form.icon === name ? 'secondary' : 'ghost'}
                  aria-pressed={form.icon === name} aria-label={name} onClick={() => set({ icon: name })}>
                  <Icon name={name} size={16} />
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-target`}>{ui.target} (฿)</Label>
            <Input id={`${idp}-target`} inputMode="decimal" value={form.target} onChange={(e) => set({ target: e.target.value })} onKeyDown={onEnter} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-saved`}>{ui.saved} (฿)</Label>
            <Input id={`${idp}-saved`} inputMode="decimal" value={form.saved} onChange={(e) => set({ saved: e.target.value })} onKeyDown={onEnter} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-monthly`}>{ui.monthlySaving}</Label>
            <Input id={`${idp}-monthly`} inputMode="decimal" value={form.monthly} onChange={(e) => set({ monthly: e.target.value })} onKeyDown={onEnter} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idp}-by`}>{ui.by}</Label>
            <Input id={`${idp}-by`} maxLength={30} placeholder={ui.goalByHint} value={form.by} onChange={(e) => set({ by: e.target.value })} onKeyDown={onEnter} />
          </div>
          <DialogFooter className="sm:flex-col">
            <Button className="w-full" disabled={!body || pending} onClick={save}>{ui.save}</Button>
            {editing ? (
              <Button className="w-full" variant="destructive" disabled={pending} onClick={remove}>
                <Icon name="trash-2" size={15} />
                {confirmDelete ? ui.confirmDeleteGoal : ui.delete}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

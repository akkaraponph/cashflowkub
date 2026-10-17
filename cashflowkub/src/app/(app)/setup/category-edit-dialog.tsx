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
import { labelPatch, labelPath, type LabelKind } from './label-form';

export function CategoryEditDialog({ kind, id, en, th }: { kind: LabelKind; id: number; en: string; th: string }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nameEn, setNameEn] = useState(en);
  const [nameTh, setNameTh] = useState(th);
  const body = labelPatch(kind, nameEn, nameTh);

  const openDialog = () => {
    setNameEn(en);
    setNameTh(th);
    setOpen(true);
  };

  const save = () => {
    if (!body) return;
    startTransition(async () => {
      try {
        await apiFetch(`${labelPath[kind]}/${id}`, { method: 'PATCH', body });
        toast.success(ui.savedOk);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(errorText(err, ui));
      }
    });
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  };

  return (
    <>
      <Button size="icon" variant="ghost" aria-label={ui.editName} onClick={openDialog}>
        <Icon name="pencil" size={15} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ui.editName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`cat-en-${kind}-${id}`}>{ui.nameEn}</Label>
            <Input id={`cat-en-${kind}-${id}`} maxLength={60} value={nameEn} onChange={(e) => setNameEn(e.target.value)} onKeyDown={onEnter} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`cat-th-${kind}-${id}`}>{ui.nameTh}</Label>
            <Input id={`cat-th-${kind}-${id}`} maxLength={60} value={nameTh} onChange={(e) => setNameTh(e.target.value)} onKeyDown={onEnter} />
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!body || pending} onClick={save}>{ui.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

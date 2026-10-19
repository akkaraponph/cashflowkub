'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/components/i18n-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';

export function DeleteAccountDialog() {
  const { ui } = useI18n();
  const t = ui.deleteAccount;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = password !== '' && typed === t.word;

  const onOpenChange = (next: boolean) => {
    if (busy) return;
    setOpen(next);
    setPassword('');
    setTyped('');
    setError('');
  };

  const confirm = async () => {
    if (!ready) return;
    setBusy(true);
    setError('');
    const { error: failure } = await authClient.deleteUser({ password });
    if (failure) {
      setBusy(false);
      setError(failure.code === 'INVALID_PASSWORD' ? t.wrongPassword : t.failed);
      return;
    }
    toast.success(t.deleted);
    // A soft navigation, so the root layout's toaster survives to show the message; the server already cleared the session cookie.
    router.replace('/login');
  };

  return (
    <>
      <Button variant="destructive" className="w-fit" onClick={() => setOpen(true)}>{t.open}</Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.body}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t.exportHint}{' '}
            <a href="/api/v1/me/export" download className="font-semibold underline">{t.exportFirst}</a>
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="delete-account-password">{t.password}</Label>
            <Input id="delete-account-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="delete-account-word">{t.typePrompt}</Label>
            <Input id="delete-account-word" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="sm:flex-col">
            <Button className="w-full" variant="destructive" disabled={!ready || busy} onClick={confirm}>{t.confirmButton}</Button>
            <Button className="w-full" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

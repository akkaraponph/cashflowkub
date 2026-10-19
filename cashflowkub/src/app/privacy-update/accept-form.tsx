'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { SignOutButton } from '@/components/app-shell/sign-out-button';
import { Button } from '@/components/ui/button';
import { PRIVACY_VERSION } from '@/lib/privacy';

export function AcceptForm() {
  const { ui } = useI18n();
  const t = ui.privacyUpdate;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function accept() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/me/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacy_version: PRIVACY_VERSION }),
      });
      if (!res.ok) throw new Error(String(res.status));
      // A full navigation, so the server renders with the updated user.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a hard navigation on purpose
      window.location.assign('/');
    } catch {
      setError(t.failed);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.body}</p>
      <Link href="/privacy" target="_blank" className="block text-sm text-primary underline-offset-4 hover:underline">{t.read}</Link>
      {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <Button size="lg" className="w-full" disabled={busy} onClick={accept}>{t.accept}</Button>
      <SignOutButton />
    </div>
  );
}

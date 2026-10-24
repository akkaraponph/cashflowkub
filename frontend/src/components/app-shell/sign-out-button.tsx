'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export function SignOutButton() {
  const { ui } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signOut();
        // A full navigation drops every client-side cache of the signed-out user's pages.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a hard navigation on purpose
        window.location.assign('/login');
      }}>
      {ui.signOut}
    </Button>
  );
}

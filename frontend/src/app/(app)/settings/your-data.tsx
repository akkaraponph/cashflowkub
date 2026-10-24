'use client';

import { useI18n } from '@/components/i18n-provider';
import { Card } from '@/components/ui/card';
import { DeleteAccountDialog } from './delete-account-dialog';

export function YourDataCard() {
  const { ui } = useI18n();
  return (
    <Card className="gap-2 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.yourData}</p>
      <p className="text-sm text-muted-foreground">{ui.yourDataBody}</p>
      <a href="/api/v1/me/export" download className="text-sm font-semibold underline">{ui.downloadData}</a>
      <DeleteAccountDialog />
    </Card>
  );
}

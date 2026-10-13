'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';

export function PayDebtButton({ id, amount, disabled }: { id: number; amount: number; disabled?: boolean }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="h-11 flex-1"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await apiFetch(`/debts/${id}/payments`, { method: 'POST', body: { amount } });
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        })
      }>
      <Icon name="arrow-down-left" size={16} />
      {ui.payNow}
    </Button>
  );
}

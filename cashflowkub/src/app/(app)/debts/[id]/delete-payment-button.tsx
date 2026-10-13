'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';

export function DeletePaymentButton({ debtId, paymentId }: { debtId: number; paymentId: number }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={ui.delete}
      disabled={pending}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-40"
      onClick={() => {
        if (!window.confirm(`${ui.delete}?`)) return;
        startTransition(async () => {
          try {
            await apiFetch(`/debts/${debtId}/payments/${paymentId}`, { method: 'DELETE' });
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        });
      }}>
      <Icon name="trash-2" size={15} />
    </button>
  );
}

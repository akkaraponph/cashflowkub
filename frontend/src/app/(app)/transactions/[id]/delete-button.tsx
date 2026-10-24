'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';

export function DeleteTransactionButton({ id }: { id: number }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="flex-1 text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`${ui.delete}?`)) return;
        startTransition(async () => {
          try {
            await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
            router.push('/transactions');
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        });
      }}>
      <Icon name="trash-2" size={16} />
      {ui.delete}
    </Button>
  );
}

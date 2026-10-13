'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function BillCheck({ id, paid, onDone }: { id: number; paid: boolean; onDone?: () => void }) {
  const router = useRouter();
  const { ui } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={paid}
      aria-label={paid ? ui.undo : ui.markPaid}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await apiFetch(`/bills/${id}/pay`, { method: 'PATCH', body: { paid: !paid } });
            router.refresh();
            onDone?.();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        })
      }
      className={cn('flex size-6 shrink-0 items-center justify-center rounded-md border disabled:opacity-50', paid ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
      {paid ? <Icon name="check" size={14} /> : null}
    </button>
  );
}

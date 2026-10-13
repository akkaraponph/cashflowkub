import type { Category } from '@/generated/prisma/client';
import { signed } from '@/lib/format';
import type { TxView } from '@/server/transaction/logic';
import { cn } from '@/lib/utils';
import { ListRow } from './list-row';

export function TxRow({ tx, cat, className }: { tx: TxView; cat?: Category; className?: string }) {
  return (
    <ListRow
      icon={cat?.icon ?? 'circle'}
      tint={cat?.tint}
      title={tx.name}
      subtitle={tx.acct}
      right={<span className={cn('text-sm font-bold tabular-nums', tx.amount >= 0 && 'text-type-xls-fg')}>{signed(tx.amount)}</span>}
      href={`/transactions/${tx.id}`}
      className={className}
    />
  );
}

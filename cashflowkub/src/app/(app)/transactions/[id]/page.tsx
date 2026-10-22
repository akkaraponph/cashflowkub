import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Tile } from '@/components/cfk/tile';
import { signed } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { loadOr404 } from '@/lib/load-or-404';
import { getI18n } from '@/lib/prefs-server';
import { cn } from '@/lib/utils';
import { parseId } from '@/server/http';
import { listResource } from '@/server/reference/service';
import { getBackendTransaction } from '@/server/backend/client';
import { DeleteTransactionButton } from './delete-button';

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { ui, lang } = await getI18n();
  const { id } = await params;
  const [tx, categories] = await Promise.all([loadOr404(async () => getBackendTransaction(parseId(id))), listResource('categories')]);
  const cat = categories.find((c) => c.key === tx.cat);
  const rows: [string, string][] = [
    [ui.category, cat ? localized(lang, cat.label, cat.th) : tx.cat],
    [ui.account, tx.acct],
    [ui.date, tx.date],
    [ui.note, tx.note || '—'],
  ];

  return (
    <>
      <PageTitle title={tx.group} back="/transactions" />
      <div className="flex flex-col items-center gap-3 py-4">
        <Tile icon={cat?.icon ?? 'circle'} tint={cat?.tint} size={56} />
        <h2 className="text-xl font-bold">{tx.name}</h2>
        <p className={cn('text-3xl font-extrabold tabular-nums', tx.amount >= 0 && 'text-type-xls-fg')}>{signed(tx.amount)}</p>
      </div>
      <Card className="gap-0 bg-secondary p-0">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between border-b px-4 py-3 text-sm last:border-0">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </Card>
      <div className="flex gap-2.5">
        <DeleteTransactionButton id={tx.id} />
      </div>
    </>
  );
}

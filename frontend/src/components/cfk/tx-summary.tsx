import { fmt } from '@/lib/format';
import type { summarize } from '@/lib/tx-sheet';
import { useI18n } from '@/components/i18n-provider';
import { Card } from '@/components/ui/card';

export function TxSummary({ totals, caption }: { totals: ReturnType<typeof summarize>; caption?: string }) {
  const { ui } = useI18n();
  const rows: [string, number][] = [
    [ui.sheet.sumIncome, totals.income], [ui.sheet.sumSaving, totals.saving], [ui.sheet.sumNeed, totals.need],
    [ui.sheet.sumWant, totals.want], [ui.sheet.sumDebt, totals.debt],
  ];
  return (
    <Card className="gap-0 p-0">
      <h2 className="bg-secondary px-3 py-2 text-xs font-semibold">{ui.sheet.summary}</h2>
      {caption ? <p className="px-3 pb-1.5 text-[11px] text-muted-foreground">{caption}</p> : null}
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold tabular-nums">{fmt(value)}</span>
        </div>
      ))}
    </Card>
  );
}

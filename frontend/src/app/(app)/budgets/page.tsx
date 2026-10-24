import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { Tile } from '@/components/cfk/tile';
import { fmt } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { byKey } from '@/lib/search-params';
import { cn } from '@/lib/utils';
import { getBackendResource } from '@/server/backend/client';

export default async function BudgetsPage() {
  const { ui, lang } = await getI18n();
  const [budgets, categories] = await Promise.all([getBackendResource('budgets'), getBackendResource('categories')]);
  const cats = byKey(categories);
  const spent = budgets.reduce((s, b) => s + b.spent, 0);
  const limit = budgets.reduce((s, b) => s + b.limit, 0);

  return (
    <>
      <PageTitle title={ui.nav.budgets} />
      <Card className="gap-2.5 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.totalBudget}</p>
        <p className="text-3xl font-extrabold tabular-nums">
          {fmt(spent)} <span className="text-lg font-medium text-muted-foreground">{ui.of} {fmt(limit)}</span>
        </p>
        <Progress value={limit ? spent / limit : 0} tone={spent > limit ? 'danger' : 'primary'} />
        <p className={cn('text-[13px] font-semibold tabular-nums', spent > limit ? 'text-destructive' : 'text-type-xls-fg')}>
          {spent > limit ? `${fmt(spent - limit)} ${ui.over}` : `${fmt(limit - spent)} ${ui.left}`}
        </p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {budgets.map((b) => {
          const cat = cats.get(b.cat);
          const over = b.spent > b.limit;
          return (
            <Card key={b.id} className="gap-3 p-4">
              <div className="flex items-center gap-2.5">
                <Tile icon={cat?.icon ?? 'circle'} tint={cat?.tint} />
                <span className="flex-1 truncate font-semibold">{cat ? localized(lang, cat.label, cat.th) : b.cat}</span>
                <span className="text-sm font-bold tabular-nums">{fmt(b.spent)} / {fmt(b.limit)}</span>
              </div>
              <Progress value={b.limit ? b.spent / b.limit : 0} tone={over ? 'danger' : 'primary'} />
              <p className={cn('text-xs font-semibold tabular-nums', over && 'text-destructive')}>
                {over ? `${fmt(b.spent - b.limit)} ${ui.over}` : `${fmt(b.limit - b.spent)} ${ui.left}`}
              </p>
            </Card>
          );
        })}
      </div>
    </>
  );
}

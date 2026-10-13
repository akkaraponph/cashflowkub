import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { Progress } from '@/components/cfk/progress';
import { Tile } from '@/components/cfk/tile';
import { fmt } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { listResource } from '@/server/reference/service';

export default async function GoalsPage() {
  const { ui, lang } = await getI18n();
  const goals = await listResource('goals');

  return (
    <>
      <PageTitle title={ui.nav.goals} />
      <div className="grid gap-3 sm:grid-cols-2">
        {goals.map((g) => {
          const ratio = g.target ? g.saved / g.target : 0;
          return (
            <Card key={g.id} className="gap-3.5 p-5">
              <div className="flex items-center gap-3">
                <Tile icon={g.icon} tint="xls" />
                <span className="flex-1 truncate font-bold">{localized(lang, g.name, g.th)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(ratio * 100)}%</span>
              </div>
              <Progress value={ratio} />
              <p className="text-xs text-muted-foreground tabular-nums">{fmt(g.saved)} {ui.of} {fmt(g.target)}</p>
              <div className="flex justify-between text-[13px]">
                <span className="font-semibold text-type-xls-fg tabular-nums">{fmt(g.monthly)}{ui.perMonth}</span>
                <span className="text-muted-foreground">{ui.by} {g.by}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

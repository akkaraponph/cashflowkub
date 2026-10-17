import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { SegmentedLinks } from '@/components/cfk/segmented-links';
import { Tile } from '@/components/cfk/tile';
import { ToneBadge } from '@/components/cfk/tone-badge';
import { fmt } from '@/lib/format';
import { localized, type Dict, type Lang } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { firstParam, type SearchParams } from '@/lib/search-params';
import type { SetupGoalRow } from '@/server/setup/logic';
import { getSetup } from '@/server/setup/service';
import type { DebtView } from '@/server/views';
import { CategoryEditDialog } from './category-edit-dialog';

const TABS = ['categories', 'channels', 'accounts', 'debts', 'goals'] as const;
type Tab = (typeof TABS)[number];

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 px-5 py-3">
      <div className="py-2">
        <h2 className="font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      {children}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 flex-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-bold tabular-nums">{value}</p>
    </div>
  );
}

function GoalCard({ goal, ui, lang }: { goal: SetupGoalRow; ui: Dict; lang: Lang }) {
  const retire = goal.kind === 'retirement';
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-center gap-3">
        <Tile icon={goal.icon} tint={goal.tint} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{localized(lang, goal.name, goal.th)}</p>
          <p className="text-xs text-muted-foreground">
            {localized(lang, goal.startDate, goal.startTh)}
            {goal.endDate ? ` → ${localized(lang, goal.endDate, goal.endTh)}` : ''}
          </p>
        </div>
      </div>
      {retire && goal.currentAge != null ? (
        <div className="flex gap-2">
          {([[ui.currentAge, goal.currentAge], [ui.retireAge, goal.retireAge], [ui.useUntilAge, goal.useUntilAge]] as const).map(([label, v]) => (
            <div key={label} className="flex-1 rounded-xl bg-secondary py-2.5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-lg font-extrabold">{v}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 border-t pt-3">
        {retire ? <Fact label={ui.monthlyRetire} value={fmt(goal.monthlyNeed ?? 0)} /> : <Fact label={ui.targetAmt} value={fmt(goal.target)} />}
        <Fact label={ui.openingBal} value={fmt(goal.opening)} />
        <Fact label={ui.inflation} value={`${goal.inflation}%`} />
      </div>
      {goal.channels.length ? (
        <div className="grid gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.channels2} · {ui.allocation}</p>
          <div className="flex flex-wrap gap-2">
            {goal.channels.map((ch) => <ToneBadge key={ch.id} label={`${localized(lang, ch.name, ch.th)} ${ch.pct}%`} />)}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function DebtRows({ debts, ui, lang }: { debts: DebtView[]; ui: Dict; lang: Lang }) {
  return debts.map((d) => (
    <ListRow key={d.id} icon={d.icon} tint={d.tint} title={localized(lang, d.name, d.th)} subtitle={`${ui.apr} ${d.apr}% · ${ui.minPay} ${fmt(d.installment)}`}
      right={<span className="font-bold text-destructive tabular-nums">{fmt(d.remaining)}</span>} href={`/debts/${d.id}`} className="border-t" />
  ));
}

export default async function SetupPage({ searchParams }: { searchParams: SearchParams }) {
  const { ui, lang } = await getI18n();
  const raw = firstParam(await searchParams, 'tab');
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'categories';
  const s = await getSetup();
  const expenseSubLabel = (sub: string) => (sub === 'need' ? ui.subNeed : sub === 'saving' ? ui.sheet.sumSaving : sub === 'debt' ? ui.sheet.sumDebt : ui.subWant);
  const subLabel = (sub: string) => (sub === 'main' ? ui.subMain : sub === 'side' ? ui.subSide : ui.subPassive);

  return (
    <>
      <PageTitle title={ui.nav.setup} />
      <p className="text-sm text-muted-foreground">{ui.setupSub}</p>
      <SegmentedLinks
        value={tab}
        options={[
          { key: 'categories', label: ui.tabCats }, { key: 'channels', label: ui.tabChannels }, { key: 'accounts', label: ui.tabAccountsCfg },
          { key: 'debts', label: ui.tabDebtsCfg }, { key: 'goals', label: ui.tabGoalsCfg },
        ]}
        hrefFor={(k) => `/setup?tab=${k}`}
      />
      {tab === 'categories' ? (
        <>
          <Section title={ui.incomeCats} sub={ui.incomeCatsSub}>
            {s.incomeSources.map((x) => <ListRow key={x.id} icon={x.icon} tint={x.tint} title={localized(lang, x.name, x.th)} right={<div className="flex items-center gap-1"><ToneBadge label={subLabel(x.sub)} tone="info" /><CategoryEditDialog kind="income" id={x.id} name={localized(lang, x.name, x.th)} /></div>} className="border-t" />)}
          </Section>
          <Section title={ui.expenseCats} sub={ui.expenseCatsSub}>
            {s.expenseCategories.map((c) => (
              <ListRow key={c.id} icon={c.icon} tint={c.tint} title={localized(lang, c.label, c.th)} className="border-t"
                right={(
                  <div className="flex items-center gap-1">
                    <ToneBadge label={expenseSubLabel(c.sub)} tone={c.sub === 'need' ? 'success' : c.sub === 'want' ? 'warning' : 'info'} />
                    <CategoryEditDialog kind="expense" id={c.id} name={localized(lang, c.label, c.th)} />
                  </div>
                )} />
            ))}
          </Section>
        </>
      ) : null}
      {tab === 'channels' ? (
        <Section title={ui.savingsCh} sub={ui.savingsChSub}>
          {s.channels.map((ch) => (
            <ListRow key={ch.id} icon={ch.icon} tint={ch.tint} title={localized(lang, ch.name, ch.th)} className="border-t"
              subtitle={`${ch.kind} · ${ui.startDate} ${localized(lang, ch.startDate, ch.startTh)}`} right={fmt(ch.opening)} />
          ))}
        </Section>
      ) : null}
      {tab === 'accounts' ? (
        <Section title={ui.bankAccts} sub={ui.bankAcctsSub}>
          {s.accounts.map((a) => <ListRow key={a.id} icon={a.icon} tint={a.tint} title={a.name} subtitle={a.sub} right={fmt(a.balance)} rightSub={<ToneBadge label={a.kind} />} className="border-t" />)}
        </Section>
      ) : null}
      {tab === 'debts' ? (
        <>
          <Section title={ui.closingDebts} sub={ui.closingDebtsSub}><DebtRows debts={s.debts.closing} ui={ui} lang={lang} /></Section>
          <Section title={ui.revolvingDebts} sub={ui.revolvingDebtsSub}><DebtRows debts={s.debts.revolving} ui={ui} lang={lang} /></Section>
        </>
      ) : null}
      {tab === 'goals' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[s.goals.emergency, s.goals.stocks, s.goals.retirement, ...s.goals.custom]
            .filter((g): g is SetupGoalRow => g !== null)
            .map((g) => <GoalCard key={g.id} goal={g} ui={ui} lang={lang} />)}
        </div>
      ) : null}
    </>
  );
}

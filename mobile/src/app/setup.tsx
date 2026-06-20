import { useState } from 'react';
import { View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Badge, Card, ErrorState, ListRow, Loading, Screen, Segmented, Text, Tile } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { useSetup } from '@/lib/hooks';
import { fmt } from '@/lib/format';
import type { SetupGoal } from '@/lib/types';

type TabKey = 'categories' | 'channels' | 'accounts' | 'debts' | 'goals';

function Chip({ label }: { label: string }) {
  return (
    <View className="self-start rounded-full bg-secondary px-2.5 py-1">
      <Text className="text-[11px] font-semibold text-secondary-foreground">{label}</Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 110, flexGrow: 1, flexBasis: '40%' }}>
      <Text variant="eyebrow">{label}</Text>
      <Text className="mt-0.5 text-[15px] font-bold" tabular>{value}</Text>
    </View>
  );
}

function GoalCard({ goal }: { goal: SetupGoal }) {
  const { ui, lang } = useI18n();
  const retire = goal.kind === 'retirement';
  return (
    <Card className="gap-3 p-5">
      <View className="flex-row items-center gap-3">
        <Tile icon={goal.icon} tint={goal.tint} />
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-bold" numberOfLines={1}>{lang === 'th' ? goal.th : goal.name}</Text>
          <Text variant="meta">
            {lang === 'th' ? goal.startTh : goal.startDate}
            {goal.endDate ? ` → ${lang === 'th' ? goal.endTh : goal.endDate}` : ''}
          </Text>
        </View>
      </View>

      {retire && goal.currentAge != null ? (
        <View className="flex-row gap-2">
          <View className="flex-1 items-center rounded-xl bg-secondary py-2.5">
            <Text variant="eyebrow">{ui.currentAge}</Text>
            <Text className="text-[18px] font-extrabold">{goal.currentAge}</Text>
          </View>
          <View className="flex-1 items-center rounded-xl bg-secondary py-2.5">
            <Text variant="eyebrow">{ui.retireAge}</Text>
            <Text className="text-[18px] font-extrabold">{goal.retireAge}</Text>
          </View>
          <View className="flex-1 items-center rounded-xl bg-secondary py-2.5">
            <Text variant="eyebrow">{ui.useUntilAge}</Text>
            <Text className="text-[18px] font-extrabold">{goal.useUntilAge}</Text>
          </View>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-y-3 border-t border-border pt-3">
        {retire ? (
          <Fact label={ui.monthlyRetire} value={fmt(goal.monthlyNeed ?? 0)} />
        ) : (
          <Fact label={ui.targetAmt} value={fmt(goal.target)} />
        )}
        <Fact label={ui.openingBal} value={fmt(goal.opening)} />
        <Fact label={ui.startDate} value={lang === 'th' ? goal.startTh : goal.startDate} />
        {goal.endDate ? <Fact label={ui.endDate} value={lang === 'th' ? goal.endTh : goal.endDate} /> : null}
        <Fact label={ui.inflation} value={`${goal.inflation}%`} />
      </View>

      {goal.channels.length ? (
        <View className="gap-2">
          <Text variant="eyebrow">{ui.channels2} · {ui.allocation}</Text>
          <View className="flex-row flex-wrap gap-2">
            {goal.channels.map((ch) => (
              <Chip key={ch.id} label={`${lang === 'th' ? ch.th : ch.name} ${ch.pct}%`} />
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

export default function SetupScreen() {
  const { ui, lang } = useI18n();
  const c = useColors();
  const sq = useSetup();
  const [tab, setTab] = useState<TabKey>('categories');

  const tabs = [
    { key: 'categories', label: ui.tabCats },
    { key: 'channels', label: ui.tabChannels },
    { key: 'accounts', label: ui.tabAccountsCfg },
    { key: 'debts', label: ui.tabDebtsCfg },
    { key: 'goals', label: ui.tabGoalsCfg },
  ];

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.setup} back />
      {sq.isLoading ? (
        <Loading />
      ) : sq.isError || !sq.data ? (
        <ErrorState message={(sq.error as Error)?.message} onRetry={() => sq.refetch()} />
      ) : (
        <Screen onRefresh={() => sq.refetch()} refreshing={sq.isFetching}>
          <Text variant="meta" className="text-[13px] leading-5">{ui.setupSub}</Text>

          <Segmented options={tabs} value={tab} onChange={(k) => setTab(k as TabKey)} />

          {/* CATEGORIES */}
          {tab === 'categories' ? (
            <>
              <Card className="px-5 py-3">
                <View className="py-2">
                  <Text variant="title">{ui.incomeCats}</Text>
                  <Text variant="meta">{ui.incomeCatsSub}</Text>
                </View>
                {sq.data.incomeSources.map((s) => {
                  const subLabel = s.sub === 'main' ? ui.subMain : s.sub === 'side' ? ui.subSide : ui.subPassive;
                  return (
                    <View key={s.id} className="border-t border-border">
                      <ListRow
                        icon={s.icon}
                        tint={s.tint}
                        title={lang === 'th' ? s.th : s.name}
                        rightTop={<Badge label={subLabel} tone="info" />}
                      />
                    </View>
                  );
                })}
              </Card>

              <Card className="px-5 py-3">
                <View className="py-2">
                  <Text variant="title">{ui.expenseCats}</Text>
                  <Text variant="meta">{ui.expenseCatsSub}</Text>
                </View>
                {sq.data.expenseCategories.map((e) => {
                  const need = e.sub === 'need';
                  return (
                    <View key={e.id} className="border-t border-border">
                      <ListRow
                        icon={e.icon}
                        tint={e.tint}
                        title={lang === 'th' ? e.th : e.label}
                        rightTop={<Badge label={need ? ui.subNeed : ui.subWant} tone={need ? 'success' : 'warning'} />}
                      />
                    </View>
                  );
                })}
              </Card>
            </>
          ) : null}

          {/* CHANNELS */}
          {tab === 'channels' ? (
            <Card className="px-5 py-3">
              <View className="py-2">
                <Text variant="title">{ui.savingsCh}</Text>
                <Text variant="meta">{ui.savingsChSub}</Text>
              </View>
              {sq.data.channels.map((ch) => (
                <View key={ch.id} className="border-t border-border">
                  <ListRow
                    icon={ch.icon}
                    tint={ch.tint}
                    title={lang === 'th' ? ch.th : ch.name}
                    subtitle={`${ch.kind} · ${ui.startDate} ${lang === 'th' ? ch.startTh : ch.startDate}`}
                    rightTop={fmt(ch.opening)}
                  />
                </View>
              ))}
            </Card>
          ) : null}

          {/* ACCOUNTS */}
          {tab === 'accounts' ? (
            <Card className="px-5 py-3">
              <View className="py-2">
                <Text variant="title">{ui.bankAccts}</Text>
                <Text variant="meta">{ui.bankAcctsSub}</Text>
              </View>
              {sq.data.accounts.map((a) => (
                <View key={a.id} className="border-t border-border">
                  <ListRow
                    icon={a.icon}
                    tint={a.tint}
                    title={a.name}
                    subtitle={a.sub}
                    rightTop={<Text className="text-[14px] font-bold" tabular>{fmt(a.balance)}</Text>}
                    rightBottom={<Badge label={a.kind} tone="neutral" />}
                  />
                </View>
              ))}
            </Card>
          ) : null}

          {/* DEBTS */}
          {tab === 'debts' ? (
            <>
              <Card className="px-5 py-3">
                <View className="py-2">
                  <Text variant="title">{ui.closingDebts}</Text>
                  <Text variant="meta">{ui.closingDebtsSub}</Text>
                </View>
                {sq.data.debts.closing.map((d) => (
                  <View key={d.id} className="border-t border-border">
                    <ListRow
                      icon={d.icon}
                      tint={d.tint}
                      title={lang === 'th' ? d.th : d.name}
                      subtitle={`APR ${d.apr}% · ${ui.minPay} ${fmt(d.monthly)}`}
                      rightTop={<Text className="text-[14px] font-bold" tabular style={{ color: c.destructive }}>{fmt(d.remaining)}</Text>}
                    />
                  </View>
                ))}
              </Card>

              <Card className="px-5 py-3">
                <View className="py-2">
                  <Text variant="title">{ui.revolvingDebts}</Text>
                  <Text variant="meta">{ui.revolvingDebtsSub}</Text>
                </View>
                {sq.data.debts.revolving.map((d) => (
                  <View key={d.id} className="border-t border-border">
                    <ListRow
                      icon={d.icon}
                      tint={d.tint}
                      title={lang === 'th' ? d.th : d.name}
                      subtitle={`APR ${d.apr}% · ${ui.minPay} ${fmt(d.monthly)}`}
                      rightTop={<Text className="text-[14px] font-bold" tabular style={{ color: c.destructive }}>{fmt(d.remaining)}</Text>}
                    />
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {/* GOALS */}
          {tab === 'goals' ? (
            <>
              {sq.data.goals.emergency ? <GoalCard goal={sq.data.goals.emergency} /> : null}
              {sq.data.goals.stocks ? <GoalCard goal={sq.data.goals.stocks} /> : null}
              {sq.data.goals.retirement ? <GoalCard goal={sq.data.goals.retirement} /> : null}
              {sq.data.goals.custom.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </>
          ) : null}
        </Screen>
      )}
    </View>
  );
}

import { useState } from 'react';
import { View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Donut, TrendChart } from '@/components/charts';
import { Card, ErrorState, Loading, Progress, Screen, Segmented, Text, Tile } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { usePrefs } from '@/lib/store';
import { usePlan, useAssetSnapshots } from '@/lib/hooks';
import type { PlanGroup } from '@/lib/types';
import { fmt, signed } from '@/lib/format';

const GROUP_LABEL: Record<string, keyof ReturnType<typeof useI18n>['ui']> = {
  bank: 'bankAcctsGroup',
  savings: 'savingsGroup',
  invest: 'investmentsGroup',
  other: 'otherAssetsGroup',
};

const GROUP_ICON: Record<string, { icon: string; tint: string }> = {
  bank: { icon: 'landmark', tint: 'doc' },
  savings: { icon: 'piggy-bank', tint: 'xls' },
  invest: { icon: 'trending-up', tint: 'folder' },
  other: { icon: 'package', tint: 'image' },
};

export default function PlanScreen() {
  const { ui, lang } = useI18n();
  const c = useColors();
  const theme = usePrefs((s) => s.theme);
  const pq = usePlan();
  const sq = useAssetSnapshots();
  const [tab, setTab] = useState('monthly');

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.plan} back />
      {pq.isLoading ? (
        <Loading />
      ) : pq.isError || !pq.data ? (
        <ErrorState message={(pq.error as Error)?.message} onRetry={() => pq.refetch()} />
      ) : (
        <Screen onRefresh={() => pq.refetch()} refreshing={pq.isFetching}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { key: 'monthly', label: ui.planTabMonthly },
              { key: 'summary', label: ui.planTabSummary },
              { key: 'assets', label: ui.planTabAssets },
            ]}
          />

          {tab === 'monthly' ? (
            <MonthlyTab
              income={pq.data.income}
              expense={pq.data.expense}
              savings={pq.data.savings}
            />
          ) : tab === 'summary' ? (
            <SummaryTab summary={pq.data.summary} />
          ) : (
            <AssetsTab sq={sq} />
          )}
        </Screen>
      )}
    </View>
  );

  // ---- Monthly plan tab ------------------------------------------------------
  function PlanRow({ item, expense }: { item: PlanGroup['items'][number]; expense?: boolean }) {
    const ratio = item.planned > 0 ? item.actual / item.planned : 0;
    const over = expense ? item.actual > item.planned : false;
    return (
      <View className="gap-1.5 border-t border-border py-2.5">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-[14px] font-semibold" numberOfLines={1}>
            {lang === 'th' ? item.th : item.name}
          </Text>
          <Text variant="meta" tabular>
            {ui.planned} {fmt(item.planned)} · {ui.actualLbl} {fmt(item.actual)}
          </Text>
        </View>
        <Progress value={ratio} fillClassName={over ? 'bg-destructive' : 'bg-primary'} />
      </View>
    );
  }

  function PlanSection({ title, group, expense }: { title: string; group: PlanGroup; expense?: boolean }) {
    return (
      <Card className="px-5 py-3">
        <Text variant="title" className="py-1">{title}</Text>
        {group.items.map((item) => (
          <PlanRow key={item.id} item={item} expense={expense} />
        ))}
        <View className="mt-1 flex-row items-center justify-between border-t border-border pt-3">
          <Text variant="meta" tabular>{ui.totalPlanned} {fmt(group.totalPlanned)}</Text>
          <Text className="text-[14px] font-bold" tabular>{ui.totalActual} {fmt(group.totalActual)}</Text>
        </View>
      </Card>
    );
  }

  function MonthlyTab({ income, expense, savings }: { income: PlanGroup; expense: PlanGroup; savings: PlanGroup }) {
    return (
      <View className="gap-4">
        <PlanSection title={ui.incomeplan} group={income} />
        <PlanSection title={ui.expenseplan} group={expense} expense />
        <PlanSection title={ui.savingsplan} group={savings} />
      </View>
    );
  }

  // ---- Plan vs actual summary tab --------------------------------------------
  function RatioDonut({ label, ratio }: { label: string; ratio: number }) {
    const r = Math.max(0, ratio);
    return (
      <View className="flex-1 items-center gap-2">
        <Donut
          size={96}
          stroke={12}
          segments={[
            { value: r, color: c.primary },
            { value: Math.max(0, 100 - r), color: c.secondary },
          ]}
          centerValue={`${Math.round(r)}%`}
        />
        <Text variant="meta" className="text-center" numberOfLines={2}>{label}</Text>
      </View>
    );
  }

  function SummaryTab({ summary }: { summary: NonNullable<typeof pq.data>['summary'] }) {
    return (
      <View className="gap-4">
        <Card className="p-5">
          <Text variant="title">{ui.achievement}</Text>
          <View className="mt-4 flex-row gap-3">
            <RatioDonut label={ui.incomeRatio} ratio={summary.incomeRatio} />
            <RatioDonut label={ui.expenseUsage} ratio={summary.expenseUsage} />
            <RatioDonut label={ui.savingsplan} ratio={summary.savingsRatio} />
          </View>
        </Card>

        <Card className="gap-3 p-5">
          <View className="flex-row items-center justify-between">
            <Text variant="label">{ui.plannedNet}</Text>
            <Text className="text-[15px] font-bold" tabular>{fmt(summary.plannedNet)}</Text>
          </View>
          <View className="flex-row items-center justify-between border-t border-border pt-3">
            <Text variant="label">{ui.actualLbl} {ui.net}</Text>
            <Text className="text-[15px] font-bold" tabular>{fmt(summary.actualNet)}</Text>
          </View>
          <View className="flex-row items-center justify-between border-t border-border pt-3">
            <Text variant="label">{ui.netVariance}</Text>
            <Text
              className="text-[18px] font-extrabold"
              tabular
              style={{ color: summary.netVariance >= 0 ? c.xlsFg : c.destructive }}>
              {signed(summary.netVariance)}
            </Text>
          </View>
        </Card>
      </View>
    );
  }

  // ---- Asset update tab ------------------------------------------------------
  function AssetsTab({ sq }: { sq: ReturnType<typeof useAssetSnapshots> }) {
    if (sq.isLoading) return <Loading />;
    if (sq.isError || !sq.data) {
      return <ErrorState message={(sq.error as Error)?.message} onRetry={() => sq.refetch()} />;
    }
    const data = sq.data;
    return (
      <View className="gap-4">
        {/* Summary header */}
        <Card className="gap-3 p-5">
          <View>
            <Text variant="eyebrow">{ui.lastUpdated}</Text>
            <Text className="mt-0.5 text-[14px] font-semibold">{data.labels.lastUpdate}</Text>
          </View>
          <View className="flex-row items-center justify-between border-t border-border pt-3">
            <View>
              <Text variant="meta">{data.labels.prev}</Text>
              <Text className="text-[18px] font-extrabold" tabular>{fmt(data.prev)}</Text>
            </View>
            <Text variant="meta">→</Text>
            <View className="items-end">
              <Text variant="meta">{data.labels.curr}</Text>
              <Text className="text-[18px] font-extrabold" tabular>{fmt(data.curr)}</Text>
            </View>
          </View>
          <Text
            className="text-[14px] font-bold"
            tabular
            style={{ color: data.delta >= 0 ? c.xlsFg : c.destructive }}>
            {signed(data.delta)}
          </Text>
        </Card>

        {/* Asset groups */}
        {data.groups.map((g) => {
          const gicon = GROUP_ICON[g.group] ?? { icon: 'circle', tint: 'doc' };
          const labelKey = GROUP_LABEL[g.group];
          return (
            <Card key={g.group} className="px-5 py-3">
              <View className="flex-row items-center gap-3 py-1">
                <Tile icon={gicon.icon} tint={gicon.tint} size={32} />
                <Text variant="title" className="flex-1" numberOfLines={1}>
                  {labelKey ? ui[labelKey] : g.group}
                </Text>
              </View>
              {g.items.map((it) => {
                const itemDelta = it.curr - it.prev;
                return (
                  <View key={it.id} className="flex-row items-center gap-3 border-t border-border py-2.5">
                    <Tile icon={it.icon} tint={it.tint} size={32} />
                    <Text className="min-w-0 flex-1 text-[14px] font-semibold" numberOfLines={1}>
                      {lang === 'th' ? it.th : it.name}
                    </Text>
                    <View className="items-end">
                      <Text className="text-[13px] font-bold" tabular>{fmt(it.prev)} → {fmt(it.curr)}</Text>
                      <Text
                        variant="meta"
                        tabular
                        style={{ color: itemDelta >= 0 ? c.xlsFg : c.destructive }}>
                        {signed(itemDelta)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          );
        })}

        {/* Net worth trend */}
        <Card className="p-5">
          <Text variant="title">{ui.netWorthHist}</Text>
          <View className="mt-4">
            <TrendChart
              values={data.history.map((p) => p.value)}
              labels={data.history.map((p) => (lang === 'th' ? p.monthTh : p.month))}
            />
          </View>
        </Card>
      </View>
    );
  }
}

import { useState } from 'react';
import { View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { CashflowBars, Donut } from '@/components/charts';
import { Card, ErrorState, ListRow, Loading, Screen, Segmented, Text } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { usePrefs } from '@/lib/store';
import { useCategories, useReports } from '@/lib/hooks';
import { tint } from '@/lib/theme';
import { compact, fmt } from '@/lib/format';

const PERIODS = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
];

export default function ReportsScreen() {
  const { ui, lang } = useI18n();
  const c = useColors();
  const theme = usePrefs((s) => s.theme);
  const rq = useReports();
  const { data: categories = [] } = useCategories();
  const [period, setPeriod] = useState('6m');

  const catMap = Object.fromEntries(categories.map((x) => [x.key, x]));

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.reports} back />
      {rq.isLoading ? (
        <Loading />
      ) : rq.isError || !rq.data ? (
        <ErrorState message={(rq.error as Error)?.message} onRetry={() => rq.refetch()} />
      ) : (
        <Screen onRefresh={() => rq.refetch()} refreshing={rq.isFetching}>
          {/* Period chips */}
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />

          {/* Category breakdown */}
          <Card className="p-5">
            <Text variant="title">{ui.breakdown}</Text>
            <View className="mt-4 flex-row items-center gap-5">
              <Donut
                segments={rq.data.breakdown.map((b) => ({ value: b.spent, color: tint(b.tint, theme).fg }))}
                centerLabel={ui.spent}
                centerValue={compact(rq.data.spendTotal)}
              />
              <View className="flex-1 gap-2.5">
                {rq.data.breakdown.map((b) => (
                  <View key={b.cat} className="flex-row items-center gap-2">
                    <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: tint(b.tint, theme).fg }} />
                    <Text className="flex-1 text-[13px]" numberOfLines={1}>{lang === 'th' ? b.th : b.label}</Text>
                    <Text variant="meta" tabular>{fmt(b.spent)} · {Math.round(b.pct)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>

          {/* Top merchants */}
          <Card className="px-5 py-3">
            <Text variant="title" className="py-2">{ui.topMerchants}</Text>
            {rq.data.topMerchants.map((m, i) => {
              const cat = catMap[m.cat];
              return (
                <ListRow
                  key={`${m.name}-${i}`}
                  icon={cat?.icon ?? 'circle'}
                  tint={cat?.tint}
                  title={m.name}
                  rightTop={fmt(m.total)}
                  className="border-t border-border"
                />
              );
            })}
          </Card>

          {/* Monthly cashflow */}
          <Card className="p-5">
            <Text variant="title">{ui.cashflow}</Text>
            <View className="mt-4">
              <CashflowBars data={rq.data.monthly.map((m) => ({ month: m.month, income: m.income, expense: m.expense }))} />
            </View>
            <View className="mt-3 flex-row gap-4">
              <View className="flex-row items-center gap-1.5"><View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.xlsFg }} /><Text variant="meta">{ui.income}</Text></View>
              <View className="flex-row items-center gap-1.5"><View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.foreground }} /><Text variant="meta">{ui.expenses}</Text></View>
            </View>
          </Card>
        </Screen>
      )}
    </View>
  );
}

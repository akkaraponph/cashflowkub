import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '@/components/AppHeader';
import { TrendChart } from '@/components/charts';
import { Card, ErrorState, ListRow, Loading, Screen, SplitBar, Segmented, Text } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { usePrefs } from '@/lib/store';
import { useNetWorth } from '@/lib/hooks';
import { HERO } from '@/lib/theme';
import { fmt } from '@/lib/format';

export default function NetWorthScreen() {
  const { ui, lang } = useI18n();
  const c = useColors();
  const theme = usePrefs((s) => s.theme);
  const nw = useNetWorth();
  const [tab, setTab] = useState<'assets' | 'liabilities'>('assets');

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.networth} />
      {nw.isLoading ? (
        <Loading />
      ) : nw.isError || !nw.data ? (
        <ErrorState message={(nw.error as Error)?.message} onRetry={() => nw.refetch()} />
      ) : (
        <Screen onRefresh={() => nw.refetch()} refreshing={nw.isFetching}>
          {/* Hero net worth */}
          <LinearGradient
            colors={[HERO[theme].from, HERO[theme].to]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: 24 }}>
            <Text className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: HERO[theme].fg, opacity: 0.7 }}>{ui.netWorth}</Text>
            <Text className="mt-2 text-[40px] font-extrabold" tabular style={{ color: HERO[theme].fg }}>{fmt(nw.data.netWorth)}</Text>
          </LinearGradient>

          {/* Assets vs liabilities split */}
          <Card className="gap-3 p-5">
            <SplitBar left={nw.data.totalAssets / (nw.data.totalAssets + nw.data.totalLiab)} />
            <View className="flex-row justify-between">
              <Text className="text-[13px] font-semibold" tabular style={{ color: c.xlsFg }}>+{fmt(nw.data.totalAssets)} {ui.assets}</Text>
              <Text className="text-[13px] font-semibold" tabular style={{ color: c.destructive }}>-{fmt(nw.data.totalLiab)} {ui.liabilities}</Text>
            </View>
          </Card>

          {/* 6-month trend */}
          <Card className="p-5">
            <Text variant="title">{ui.networthTrend}</Text>
            <View className="mt-4">
              <TrendChart
                values={nw.data.history.map((p) => p.value)}
                labels={nw.data.history.map((p) => (lang === 'th' ? p.monthTh : p.month))}
              />
            </View>
          </Card>

          {/* Breakdown tabs */}
          <Segmented
            options={[
              { key: 'assets', label: ui.assets },
              { key: 'liabilities', label: ui.liabilities },
            ]}
            value={tab}
            onChange={(k) => setTab(k as 'assets' | 'liabilities')}
          />

          {tab === 'assets' ? (
            <Card className="px-5 py-1">
              {nw.data.assets.map((a, i) => (
                <ListRow
                  key={a.id}
                  icon={a.icon}
                  tint={a.tint}
                  title={lang === 'th' ? a.th : a.name}
                  rightTop={fmt(a.value)}
                  rightBottom={`${Math.round((a.value / nw.data.totalAssets) * 100)}%`}
                  className={i > 0 ? 'border-t border-border' : undefined}
                />
              ))}
            </Card>
          ) : (
            <Card className="px-5 py-1">
              {nw.data.liabilities.map((d, i) => (
                <ListRow
                  key={d.id}
                  icon={d.icon}
                  tint={d.tint}
                  title={lang === 'th' ? d.th : d.name}
                  subtitle={`APR ${d.apr}%`}
                  rightTop={<Text className="text-[14px] font-bold" tabular style={{ color: c.destructive }}>-{fmt(d.remaining)}</Text>}
                  onPress={() => router.push(`/debt/${d.id}`)}
                  chevron
                  className={i > 0 ? 'border-t border-border' : undefined}
                />
              ))}
            </Card>
          )}
        </Screen>
      )}
    </View>
  );
}

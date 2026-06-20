import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { Donut } from '@/components/charts';
import { Badge, Card, ErrorState, Loading, Progress, Screen, Segmented, Text, Tile } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { usePrefs } from '@/lib/store';
import { useDebts } from '@/lib/hooks';
import { HERO } from '@/lib/theme';
import { fmt } from '@/lib/format';
import type { Debt } from '@/lib/types';

type Strategy = 'avalanche' | 'snowball' | 'custom';

function sortByStrategy(debts: Debt[], strategy: Strategy): Debt[] {
  const list = [...debts];
  if (strategy === 'avalanche') return list.sort((a, b) => b.apr - a.apr);
  if (strategy === 'snowball') return list.sort((a, b) => a.remaining - b.remaining);
  return list.sort((a, b) => a.sort - b.sort);
}

export default function DebtsScreen() {
  const { ui, lang } = useI18n();
  const c = useColors();
  const theme = usePrefs((s) => s.theme);
  const active = useDebts('active');
  const paid = useDebts('paid');
  const [strategy, setStrategy] = useState<Strategy>('avalanche');

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.debts} />
      {active.isLoading ? (
        <Loading />
      ) : active.isError || !active.data ? (
        <ErrorState message={(active.error as Error)?.message} onRetry={() => active.refetch()} />
      ) : (
        (() => {
          const activeDebts = active.data;
          const paidDebts = paid.data ?? [];
          const totalRemaining = activeDebts.reduce((s, d) => s + d.remaining, 0);
          const totalOriginal = activeDebts.reduce((s, d) => s + d.original, 0);
          const totalPaid = activeDebts.reduce((s, d) => s + d.paid, 0);
          const progress = totalOriginal > 0 ? totalPaid / totalOriginal : 0;
          const sorted = sortByStrategy(activeDebts, strategy);

          return (
            <Screen onRefresh={() => { active.refetch(); paid.refetch(); }} refreshing={active.isFetching}>
              {/* Hero progress */}
              <LinearGradient
                colors={[HERO[theme].from, HERO[theme].to]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 20, padding: 24 }}>
                <View className="flex-row items-center gap-5">
                  <Donut
                    size={96}
                    stroke={12}
                    segments={[
                      { value: progress, color: HERO[theme].fg },
                      { value: 1 - progress, color: 'rgba(255,255,255,0.18)' },
                    ]}
                    centerValue={`${Math.round(progress * 100)}%`}
                  />
                  <View className="flex-1">
                    <Text className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: HERO[theme].fg, opacity: 0.7 }}>{ui.totalDebt}</Text>
                    <Text className="mt-1 text-[34px] font-extrabold" tabular style={{ color: HERO[theme].fg }}>{fmt(totalRemaining)}</Text>
                    <Text className="text-[13px]" tabular style={{ color: HERO[theme].fg, opacity: 0.75 }}>{ui.of} {fmt(totalOriginal)}</Text>
                  </View>
                </View>
                <View className="mt-4 flex-row gap-2.5">
                  <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}>
                    <Text className="text-[13px] font-bold" tabular style={{ color: HERO[theme].fg }}>{activeDebts.length}</Text>
                    <Text className="text-[12px] font-semibold" style={{ color: HERO[theme].fg, opacity: 0.8 }}>{ui.active}</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}>
                    <Text className="text-[13px] font-bold" tabular style={{ color: HERO[theme].fg }}>{paidDebts.length}</Text>
                    <Text className="text-[12px] font-semibold" style={{ color: HERO[theme].fg, opacity: 0.8 }}>{ui.paidOff}</Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Strategy toggle */}
              <Card className="gap-3 p-4">
                <Text variant="eyebrow">{ui.strategy}</Text>
                <Segmented
                  value={strategy}
                  onChange={(k) => setStrategy(k as Strategy)}
                  options={[
                    { key: 'avalanche', label: ui.avalanche },
                    { key: 'snowball', label: ui.snowball },
                    { key: 'custom', label: ui.custom },
                  ]}
                />
                <View className="rounded-xl bg-secondary p-3">
                  <Text variant="meta" className="leading-5">{ui.strategyTip[strategy]}</Text>
                </View>
              </Card>

              {/* Active debts */}
              <Card className="gap-3.5 p-5">
                <View className="flex-row items-center justify-between">
                  <Text variant="title">{ui.active}</Text>
                  <Text variant="meta" tabular>{activeDebts.length}</Text>
                </View>
                {sorted.map((d) => (
                  <Pressable key={d.id} onPress={() => router.push(`/debt/${d.id}`)} className="flex-row items-center gap-3 active:opacity-70">
                    <Tile icon={d.icon} tint={d.tint} />
                    <View className="min-w-0 flex-1 gap-1.5">
                      <Text className="text-[14px] font-bold" numberOfLines={1}>{lang === 'th' ? d.th : d.name}</Text>
                      <Text variant="meta" numberOfLines={1}>{ui.apr} {d.apr}% · {ui.minMonthly} {fmt(d.monthly)}</Text>
                      <Progress value={d.progress} />
                    </View>
                    <View className="items-end">
                      <Text className="text-[16px] font-bold" tabular>{fmt(d.remaining)}</Text>
                      <Text variant="meta" numberOfLines={1}>{lang === 'th' ? d.payoffTh : d.payoff}</Text>
                    </View>
                    <Icon name="chevron-right" size={16} color={c.mutedForeground} />
                  </Pressable>
                ))}
              </Card>

              {/* Paid off */}
              {paidDebts.length > 0 ? (
                <Card className="gap-3 p-5">
                  <Text variant="title" style={{ color: c.xlsFg }}>{ui.paidOff}</Text>
                  {paidDebts.map((d) => (
                    <View key={d.id} className="flex-row items-center gap-3 opacity-70">
                      <Badge label="✓" tone="success" />
                      <Text className="min-w-0 flex-1 text-[14px] font-semibold line-through" numberOfLines={1}>{lang === 'th' ? d.th : d.name}</Text>
                      <Text className="text-[14px] font-bold" tabular>{fmt(d.original)}</Text>
                    </View>
                  ))}
                </Card>
              ) : null}
            </Screen>
          );
        })()
      )}
    </View>
  );
}

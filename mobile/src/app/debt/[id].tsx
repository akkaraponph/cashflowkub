import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { Button, Card, ErrorState, Loading, Progress, Screen, Segmented, Text, Tile } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { useDebt, useDebtSchedule, usePayDebt } from '@/lib/hooks';
import { fmt, pct } from '@/lib/format';

const COLS = [0.5, 1, 1, 1, 1.1];

function DefRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-border px-4 py-3 last:border-0">
      <Text variant="meta" className="text-[14px]">{label}</Text>
      <Text className="text-[14px] font-semibold" tabular numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ui, lang } = useI18n();
  const c = useColors();
  const [tab, setTab] = useState('overview');
  const debtQ = useDebt(id);
  const schedQ = useDebtSchedule(id);
  const pay = usePayDebt();

  const d = debtQ.data;
  const method = d ? (d.calc === 'reducing' ? ui.calcReducing : ui.calcFlat) : '';
  const payoff = d ? (lang === 'th' ? d.payoffTh : d.payoff) : '';

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={d ? (lang === 'th' ? d.th : d.name) : ui.nav.debts} back />
      {debtQ.isLoading ? (
        <Loading />
      ) : debtQ.isError || !d ? (
        <ErrorState message={(debtQ.error as Error)?.message} onRetry={() => debtQ.refetch()} />
      ) : (
        <Screen onRefresh={() => debtQ.refetch()} refreshing={debtQ.isFetching}>
          {/* Header info row */}
          <View className="flex-row items-center gap-3">
            <Tile icon={d.icon} tint={d.tint} size={48} />
            <View className="min-w-0 flex-1">
              <Text variant="h2" numberOfLines={1}>{lang === 'th' ? d.th : d.name}</Text>
              <Text variant="meta" className="mt-0.5">
                APR {d.apr}% · {method}
              </Text>
            </View>
          </View>

          {/* Balance hero */}
          <Card flat className="gap-3.5 bg-secondary p-5">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0">
                <Text variant="eyebrow">{ui.balance}</Text>
                <Text className="mt-0.5 text-[32px] font-extrabold tracking-tight" tabular>{fmt(d.remaining)}</Text>
                <Text variant="meta" tabular>{ui.of} {fmt(d.original)}</Text>
              </View>
              <View className="items-end">
                <Text variant="eyebrow">{ui.payoff}</Text>
                <Text className="mt-0.5 text-[18px] font-bold">{payoff}</Text>
                <Text variant="meta" tabular>{d.monthsLeft} {ui.monthsLeftLbl}</Text>
              </View>
            </View>
            <Progress value={d.progress} />
            <View className="flex-row items-center justify-between">
              <Text variant="meta" className="font-semibold" tabular>{fmt(d.paid)} {ui.paidOff}</Text>
              <Text variant="meta" className="font-semibold" tabular>{pct(d.progress)}</Text>
            </View>
          </Card>

          {/* Tabs */}
          <Segmented
            options={[{ key: 'overview', label: ui.overview }, { key: 'schedule', label: ui.schedule }]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'overview' ? (
            <>
              <Card flat className="overflow-hidden bg-secondary p-0">
                <DefRow label={ui.apr} value={`${d.apr}%`} />
                <DefRow label={ui.calcMethod} value={method} />
                <DefRow label={ui.minMonthly} value={fmt(d.monthly)} />
                <DefRow label={ui.originalDebt} value={fmt(d.original)} />
                <DefRow label={ui.payoff} value={payoff} />
              </Card>
              <View className="flex-row gap-2.5">
                <Button
                  label={ui.payNow}
                  left={<Icon name="arrow-down-left" size={16} color="#fff" />}
                  className="h-[46px] flex-1 rounded-xl"
                  loading={pay.isPending}
                  onPress={() => pay.mutate({ id: Number(id) })}
                />
                <Button
                  variant="outline"
                  label={ui.extraPayment}
                  left={<Icon name="plus" size={16} color={c.foreground} />}
                  className="h-[46px] flex-1 rounded-xl"
                />
              </View>
            </>
          ) : schedQ.isLoading ? (
            <Loading />
          ) : !schedQ.data ? null : (
            <>
              <Card flat className="overflow-hidden bg-secondary p-0">
                <View className="flex-row gap-2 border-b border-border bg-background px-3.5 py-2.5">
                  <Text variant="eyebrow" className="text-[10px]" style={{ flex: COLS[0] }}>#</Text>
                  <Text variant="eyebrow" className="text-[10px]" style={{ flex: COLS[1] }}>{ui.amount}</Text>
                  <Text variant="eyebrow" className="text-[10px]" style={{ flex: COLS[2] }}>{ui.principal}</Text>
                  <Text variant="eyebrow" className="text-[10px]" style={{ flex: COLS[3] }}>{ui.interest}</Text>
                  <Text variant="eyebrow" className="text-right text-[10px]" style={{ flex: COLS[4] }}>{ui.remaining}</Text>
                </View>
                {schedQ.data.schedule.slice(0, 24).map((row) => (
                  <View key={row.month} className="flex-row items-center gap-2 border-b border-border px-3.5 py-2.5 last:border-0">
                    <Text className="text-[12px] font-semibold text-muted-foreground" tabular style={{ flex: COLS[0] }}>{row.month}</Text>
                    <Text className="text-[12px] font-semibold" tabular style={{ flex: COLS[1] }}>{fmt(row.payment)}</Text>
                    <Text className="text-[12px]" tabular style={{ flex: COLS[2] }}>{fmt(row.principal)}</Text>
                    <Text className="text-[12px]" tabular style={{ flex: COLS[3], color: c.destructive }}>{fmt(row.interest)}</Text>
                    <Text className="text-right text-[12px] font-semibold" tabular style={{ flex: COLS[4] }}>{fmt(row.balance)}</Text>
                  </View>
                ))}
              </Card>
              <View className="flex-row items-center justify-between px-1">
                <Text variant="meta" className="text-[13px]">Total interest</Text>
                <Text className="text-[13px] font-bold" tabular style={{ color: c.destructive }}>{fmt(schedQ.data.totalInterest)}</Text>
              </View>
            </>
          )}
        </Screen>
      )}
    </View>
  );
}

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Card, Empty, ErrorState, Loading, Screen, Segmented, Text, Tile } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { useCategories, useTransactions } from '@/lib/hooks';
import { fmt, signed } from '@/lib/format';
import type { Transaction } from '@/lib/types';

export default function TransactionsScreen() {
  const { ui } = useI18n();
  const c = useColors();
  const [sel, setSel] = useState('all');

  const filter = sel === 'all' ? undefined : `type=${sel}`;
  const txQ = useTransactions(filter);
  const { data: categories = [] } = useCategories();

  const catMap = Object.fromEntries(categories.map((x) => [x.key, x]));

  // Group transactions by their `group` field, preserving API order.
  const groups: { label: string; items: Transaction[] }[] = [];
  for (const t of txQ.data ?? []) {
    let g = groups.find((x) => x.label === t.group);
    if (!g) {
      g = { label: t.group, items: [] };
      groups.push(g);
    }
    g.items.push(t);
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.transactions} back />
      {txQ.isLoading ? (
        <Loading />
      ) : txQ.isError || !txQ.data ? (
        <ErrorState message={(txQ.error as Error)?.message} onRetry={() => txQ.refetch()} />
      ) : (
        <Screen onRefresh={() => txQ.refetch()} refreshing={txQ.isFetching}>
          <Segmented
            options={[
              { key: 'all', label: ui.all },
              { key: 'income', label: ui.income },
              { key: 'expense', label: ui.expenses },
            ]}
            value={sel}
            onChange={setSel}
          />

          {groups.length === 0 ? (
            <Empty icon="arrow-left-right" label={ui.searchPh} />
          ) : (
            groups.map((g) => (
              <View key={g.label} className="gap-2">
                <Text variant="eyebrow" className="px-0.5">{g.label}</Text>
                <Card className="px-4 py-1">
                  {g.items.map((t, i) => {
                    const cat = catMap[t.cat];
                    const income = t.amount >= 0;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => router.push(`/tx/${t.id}`)}
                        className={`flex-row items-center gap-3 py-2.5 active:opacity-70 ${i > 0 ? 'border-t border-border' : ''}`}>
                        <Tile icon={cat?.icon ?? 'circle'} tint={cat?.tint} />
                        <View className="min-w-0 flex-1">
                          <Text className="text-[14px] font-semibold" numberOfLines={1}>{t.name}</Text>
                          <Text variant="meta" numberOfLines={1}>{t.acct}</Text>
                        </View>
                        <Text
                          className="text-[14px] font-bold"
                          tabular
                          style={{ color: income ? c.xlsFg : c.foreground }}>
                          {income ? signed(t.amount) : `-${fmt(t.amount)}`}
                        </Text>
                        <Icon name="chevron-right" size={18} color={c.mutedForeground} />
                      </Pressable>
                    );
                  })}
                </Card>
              </View>
            ))
          )}
        </Screen>
      )}
    </View>
  );
}

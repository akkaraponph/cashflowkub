import { View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { Button, Card, ErrorState, Loading, Progress, Screen, Text, Tile } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { useBudgets, useCategories } from '@/lib/hooks';
import { fmt } from '@/lib/format';

export default function BudgetsScreen() {
  const { ui, lang } = useI18n();
  const c = useColors();
  const bq = useBudgets();
  const { data: categories = [] } = useCategories();

  const catMap = Object.fromEntries(categories.map((x) => [x.key, x]));

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.budgets} back />
      {bq.isLoading ? (
        <Loading />
      ) : bq.isError || !bq.data ? (
        <ErrorState message={(bq.error as Error)?.message} onRetry={() => bq.refetch()} />
      ) : (
        (() => {
          const budgets = bq.data;
          const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
          const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
          return (
            <Screen onRefresh={() => bq.refetch()} refreshing={bq.isFetching}>
              {/* Total budget summary */}
              <Card className="gap-2.5 p-5">
                <Text variant="eyebrow">{ui.totalBudget}</Text>
                <Text className="text-[28px] font-extrabold" tabular>
                  {fmt(totalSpent)} <Text className="text-[17px] font-medium" variant="meta" tabular>{ui.of} {fmt(totalLimit)}</Text>
                </Text>
                <Progress value={totalLimit ? totalSpent / totalLimit : 0} fillClassName={totalSpent > totalLimit ? 'bg-destructive' : 'bg-primary'} />
                <Text className="text-[13px] font-semibold" tabular style={{ color: c.xlsFg }}>
                  {fmt(totalLimit - totalSpent)} {ui.left}
                </Text>
              </Card>

              {/* Per-category budgets */}
              {budgets.map((b) => {
                const cat = catMap[b.cat];
                const over = b.spent > b.limit;
                return (
                  <Card key={b.id} className="gap-3 p-4">
                    <View className="flex-row items-center gap-2.5">
                      <Tile icon={cat?.icon ?? 'circle'} tint={cat?.tint} />
                      <Text className="flex-1 text-[15px] font-semibold" numberOfLines={1}>
                        {cat ? (lang === 'th' ? cat.th : cat.label) : b.cat}
                      </Text>
                      <Text className="text-[14px] font-bold" tabular>{fmt(b.spent)} / {fmt(b.limit)}</Text>
                    </View>
                    <Progress value={b.limit ? b.spent / b.limit : 0} fillClassName={over ? 'bg-destructive' : 'bg-primary'} />
                    <Text className="text-[12px] font-semibold" tabular style={over ? { color: c.destructive } : undefined}>
                      {over ? `${fmt(b.spent - b.limit)} over` : `${fmt(b.limit - b.spent)} ${ui.left}`}
                    </Text>
                  </Card>
                );
              })}

              {/* Add budget */}
              <Button
                variant="outline"
                label={ui.addBudget}
                left={<Icon name="plus" size={18} color={c.foreground} />}
                onPress={() => {}}
              />
            </Screen>
          );
        })()
      )}
    </View>
  );
}

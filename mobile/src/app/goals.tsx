import { View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { Button, Card, ErrorState, Loading, Progress, Screen, Text, Tile } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { useGoals } from '@/lib/hooks';
import { fmt } from '@/lib/format';

export default function GoalsScreen() {
  const { ui, lang } = useI18n();
  const c = useColors();
  const gq = useGoals();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.goals} back />
      {gq.isLoading ? (
        <Loading />
      ) : gq.isError || !gq.data ? (
        <ErrorState message={(gq.error as Error)?.message} onRetry={() => gq.refetch()} />
      ) : (
        <Screen onRefresh={() => gq.refetch()} refreshing={gq.isFetching}>
          {gq.data.map((g) => {
            const ratio = g.saved / g.target;
            return (
              <Card key={g.id} className="gap-3.5 p-5">
                <View className="flex-row items-center gap-3">
                  <Tile icon={g.icon} tint="xls" />
                  <Text className="flex-1 text-[15px] font-bold" numberOfLines={1}>{lang === 'th' ? g.th : g.name}</Text>
                  <Text variant="meta" tabular>{Math.round(ratio * 100)}%</Text>
                </View>
                <Progress value={ratio} />
                <Text variant="meta" tabular>{fmt(g.saved)} {ui.of} {fmt(g.target)}</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] font-semibold" tabular style={{ color: c.xlsFg }}>{fmt(g.monthly)}{ui.perMonth}</Text>
                  <Text variant="meta">{ui.by} {g.by}</Text>
                </View>
                <Button variant="secondary" size="sm" label={ui.addFunds} left={<Icon name="plus" size={16} color={c.foreground} />} onPress={() => {}} />
              </Card>
            );
          })}
          <Button variant="outline" label={ui.newGoal} left={<Icon name="plus" size={16} color={c.foreground} />} onPress={() => {}} />
        </Screen>
      )}
    </View>
  );
}

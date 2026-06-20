import { View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { Badge, Button, Card, ErrorState, ListRow, Loading, Screen, Text, type Tone } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { useAccounts } from '@/lib/hooks';
import { fmt } from '@/lib/format';

const KIND_TONE: Record<string, Tone> = {
  bank: 'info',
  cash: 'success',
  ewallet: 'primary',
  credit: 'danger',
};

export default function AccountsScreen() {
  const { ui } = useI18n();
  const c = useColors();
  const aq = useAccounts();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.accounts} back />
      {aq.isLoading ? (
        <Loading />
      ) : aq.isError || !aq.data ? (
        <ErrorState message={(aq.error as Error)?.message} onRetry={() => aq.refetch()} />
      ) : (
        <Screen onRefresh={() => aq.refetch()} refreshing={aq.isFetching}>
          {(() => {
            const accounts = aq.data;
            const total = accounts.reduce((sum, a) => sum + a.balance, 0);
            return (
              <>
                {/* Total balance hero */}
                <Card className="p-6">
                  <Text className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: c.mutedForeground }}>
                    Total balance
                  </Text>
                  <Text className="mt-2 text-[36px] font-extrabold" tabular>{fmt(total)}</Text>
                  <Text variant="meta" className="mt-1" tabular>
                    {accounts.length} {ui.accountsLower}
                  </Text>
                </Card>

                {/* Account list */}
                <Card className="px-5 py-1">
                  {accounts.map((a, i) => {
                    const negative = a.balance < 0;
                    return (
                      <ListRow
                        key={a.id}
                        icon={a.icon}
                        tint={a.tint}
                        title={a.name}
                        subtitle={a.sub}
                        className={i > 0 ? 'border-t border-border' : undefined}
                        rightTop={
                          <Text
                            className="text-[15px] font-bold"
                            tabular
                            style={{ color: negative ? c.destructive : c.foreground }}>
                            {negative ? `-${fmt(a.balance)}` : fmt(a.balance)}
                          </Text>
                        }
                        rightBottom={
                          <Badge label={a.kind} tone={KIND_TONE[a.kind] ?? 'neutral'} className="mt-1" />
                        }
                      />
                    );
                  })}
                </Card>

                {/* Add account */}
                <Button
                  variant="outline"
                  label={ui.addAccount}
                  left={<Icon name="plus" size={17} color={c.foreground} />}
                  onPress={() => {}}
                />
              </>
            );
          })()}
        </Screen>
      )}
    </View>
  );
}

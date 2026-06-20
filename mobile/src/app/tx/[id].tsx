import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { Button, Loading, Text, Tile } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { useCategories } from '@/lib/hooks';
import { api } from '@/lib/api';
import type { Transaction } from '@/lib/types';
import { fmt, signed } from '@/lib/format';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between border-b border-border px-4 py-3 last:border-0">
      <Text variant="meta" className="text-[14px]">{label}</Text>
      <Text className="text-[14px] font-medium" numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function TxDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { ui, lang } = useI18n();
  const c = useColors();
  const { data: categories = [] } = useCategories();
  const { data: tx, isLoading } = useQuery({
    queryKey: ['tx', id],
    queryFn: () => api.get<Transaction>(`/transactions/${id}`),
    enabled: !!id,
  });

  if (isLoading || !tx) return <Loading />;
  const cat = categories.find((x) => x.key === tx.cat);
  const income = tx.amount >= 0;
  const catLabel = cat ? (lang === 'th' ? cat.th : cat.label) : tx.cat;

  return (
    <View className="flex-1 bg-card px-5" style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[15px] font-semibold text-muted-foreground">{tx.group}</Text>
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-lg bg-secondary active:opacity-70">
          <Icon name="x" size={18} color={c.mutedForeground} />
        </Pressable>
      </View>

      <View className="items-center gap-3 py-6">
        <Tile icon={cat?.icon ?? 'circle'} tint={cat?.tint} size={56} radius={16} />
        <Text variant="h2">{tx.name}</Text>
        <Text className="text-[28px] font-extrabold" tabular style={{ color: income ? c.xlsFg : c.foreground }}>
          {income ? signed(tx.amount) : `-${fmt(tx.amount)}`}
        </Text>
      </View>

      <View className="overflow-hidden rounded-xl bg-secondary">
        <DetailRow label={ui.category} value={catLabel} />
        <DetailRow label={ui.account} value={tx.acct} />
        <DetailRow label={ui.date} value={tx.date} />
        <DetailRow label={ui.note} value={tx.note || '—'} />
      </View>

      <View className="mt-5 flex-row gap-2.5">
        <Button variant="outline" label={ui.edit} left={<Icon name="pencil" size={16} color={c.foreground} />} className="flex-1 rounded-xl" />
        <Button
          variant="outline"
          label={ui.delete}
          left={<Icon name="trash-2" size={16} color={c.destructive} />}
          className="flex-1 rounded-xl"
          onPress={() => router.back()}
        />
      </View>
    </View>
  );
}

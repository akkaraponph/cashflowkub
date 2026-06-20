import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Empty, Text, Tile } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { useBills, useToggleBillPaid } from '@/lib/hooks';
import { fmt } from '@/lib/format';

const MONTH = { en: 'June', th: 'มิถุนายน' };

export default function DayDetailModal() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const dayNum = Number(day);
  const insets = useSafeAreaInsets();
  const { ui, lang } = useI18n();
  const c = useColors();
  const { data: bills = [] } = useBills();
  const toggle = useToggleBillPaid();

  const dayBills = bills.filter((b) => b.dueDay === dayNum);

  return (
    <View className="flex-1 bg-card px-5" style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}>
      <View className="flex-row items-center justify-between">
        <View>
          <Text variant="eyebrow">{ui.dueOn}</Text>
          <Text variant="h2" className="text-[20px]">{lang === 'th' ? `${dayNum} ${MONTH.th} 2026` : `${MONTH.en} ${dayNum}, 2026`}</Text>
        </View>
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-lg bg-secondary active:opacity-70">
          <Icon name="x" size={18} color={c.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
        {dayBills.length === 0 ? (
          <Empty icon="calendar" label={ui.upcoming} />
        ) : (
          <View className="overflow-hidden rounded-2xl bg-secondary">
            {dayBills.map((b) => (
              <View key={b.id} className="flex-row items-center gap-3 border-b border-border px-3.5 py-3 last:border-0">
                <Pressable
                  onPress={() => toggle.mutate({ id: b.id })}
                  className="h-6 w-6 items-center justify-center rounded-md border"
                  style={{ borderColor: b.paid ? c.primary : c.border, backgroundColor: b.paid ? c.primary : 'transparent' }}>
                  {b.paid ? <Icon name="check" size={14} color="#fff" /> : null}
                </Pressable>
                <Tile icon={b.icon} tint={b.tint} size={34} />
                <Text className={`flex-1 text-[14px] font-semibold ${b.paid ? 'text-muted-foreground line-through' : ''}`} numberOfLines={1}>
                  {lang === 'th' ? b.th : b.name}
                </Text>
                <Text className="text-[14px] font-bold" tabular>{fmt(b.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

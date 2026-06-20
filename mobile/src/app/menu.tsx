import { Pressable, ScrollView, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Text, Tile } from '@/components/ui';
import { NAV_ITEMS } from '@/components/nav';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';

export default function MenuModal() {
  const insets = useSafeAreaInsets();
  const { ui } = useI18n();
  const c = useColors();

  const go = (href: Href) => {
    router.back();
    setTimeout(() => router.navigate(href), 10);
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between px-4 pb-3">
        <Text variant="h2">{ui.nav.more}</Text>
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-lg bg-secondary active:opacity-70">
          <Icon name="x" size={18} color={c.mutedForeground} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {NAV_ITEMS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => go(item.href)}
              className="items-center gap-2 rounded-lg border border-border bg-card p-4 active:opacity-70"
              style={{ width: '31%' }}>
              <Tile icon={item.icon} tint="doc" size={42} radius={13} />
              <Text className="text-center text-[12px] font-semibold" numberOfLines={1}>{ui.nav[item.key]}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

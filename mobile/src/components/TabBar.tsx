import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './Icon';
import { Text } from './ui/text';
import { useI18n } from '@/lib/useI18n';
import { usePrefs } from '@/lib/store';
import { useColors } from '@/lib/useColors';
import { HERO } from '@/lib/theme';

// route name (file) -> { nav key for label, icon }
const META: Record<string, { key: string; icon: string }> = {
  index: { key: 'dashboard', icon: 'layout-dashboard' },
  bills: { key: 'bills', icon: 'calendar-clock' },
  debts: { key: 'debts', icon: 'trending-down' },
  networth: { key: 'networth', icon: 'scale' },
};

const ORDER = ['index', 'bills', 'debts', 'networth'];

export function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { ui } = useI18n();
  const theme = usePrefs((s) => s.theme);

  const routeByName: Record<string, { key: string; index: number }> = {};
  state.routes.forEach((r: any, i: number) => (routeByName[r.name] = { key: r.key, index: i }));

  const renderTab = (name: string) => {
    const route = routeByName[name];
    const meta = META[name];
    if (!route || !meta) return <View key={name} className="flex-1" />;
    const focused = state.index === route.index;
    const color = focused ? c.foreground : c.mutedForeground;
    return (
      <Pressable
        key={name}
        className="flex-1 items-center justify-center gap-1 active:opacity-60"
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(name);
        }}>
        <Icon name={meta.icon} size={21} color={color} />
        <Text className="text-[10px]" style={{ color }}>{ui.nav[meta.key]}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{ paddingBottom: insets.bottom || 10 }}
      className="flex-row items-center border-t border-border bg-card px-2 pt-2">
      {renderTab(ORDER[0])}
      {renderTab(ORDER[1])}

      {/* Center FAB — opens the Add Transaction sheet */}
      <View className="w-16 items-center">
        <Pressable
          onPress={() => router.push('/add')}
          className="active:opacity-80"
          style={{ marginTop: -28 }}>
          <LinearGradient
            colors={[HERO[theme].from, HERO[theme].to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
              shadowColor: HERO[theme].from, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
            }}>
            <Icon name="plus" size={26} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>

      {renderTab(ORDER[2])}
      {renderTab(ORDER[3])}
    </View>
  );
}

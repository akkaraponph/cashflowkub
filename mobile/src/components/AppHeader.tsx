import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './Icon';
import { Text } from './ui/text';
import { useI18n } from '@/lib/useI18n';
import { usePrefs, YEARS } from '@/lib/store';
import { useColors } from '@/lib/useColors';
import { BRAND } from '@/lib/theme';

function HeaderButton({ icon, onPress, label }: { icon?: string; onPress: () => void; label?: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      className="h-9 flex-row items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 active:opacity-70"
      style={{ minWidth: 36 }}>
      {icon ? <Icon name={icon} size={17} color={c.foreground} /> : null}
      {label ? <Text className="text-[12px] font-semibold">{label}</Text> : null}
    </Pressable>
  );
}

export function AppHeader({ title, back }: { title: string; back?: boolean }) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { lang } = useI18n();
  const { year, setYear, theme, toggleTheme, toggleLang } = usePrefs();

  const yearIdx = YEARS.indexOf(year);
  const prevYear = () => yearIdx > 0 && setYear(YEARS[yearIdx - 1]);
  const nextYear = () => yearIdx < YEARS.length - 1 && setYear(YEARS[yearIdx + 1]);

  return (
    <View style={{ paddingTop: insets.top + 6 }} className="bg-background px-4 pb-3">
      <View className="flex-row items-center gap-2.5">
        {back ? (
          <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary active:opacity-70">
            <Icon name="chevron-left" size={20} color={c.foreground} />
          </Pressable>
        ) : (
          <LinearGradient
            colors={[BRAND[theme].from, BRAND[theme].to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
            <Text className="text-[15px] font-extrabold" style={{ color: '#fff' }}>C</Text>
          </LinearGradient>
        )}

        <Text variant="h2" numberOfLines={1} className="flex-1 text-[17px]">{title}</Text>

        <View className="flex-row items-center overflow-hidden rounded-lg border border-border bg-secondary">
          <Pressable onPress={prevYear} className="px-2 py-2 active:opacity-60" disabled={yearIdx <= 0}>
            <Icon name="chevron-left" size={15} color={yearIdx <= 0 ? c.border : c.mutedForeground} />
          </Pressable>
          <Text className="text-[12px] font-bold" tabular>{year}</Text>
          <Pressable onPress={nextYear} className="px-2 py-2 active:opacity-60" disabled={yearIdx >= YEARS.length - 1}>
            <Icon name="chevron-right" size={15} color={yearIdx >= YEARS.length - 1 ? c.border : c.mutedForeground} />
          </Pressable>
        </View>

        <HeaderButton onPress={toggleLang} label={lang === 'en' ? 'EN' : 'TH'} />
        <HeaderButton icon={theme === 'light' ? 'moon' : 'sun'} onPress={toggleTheme} />
        <HeaderButton icon="menu" onPress={() => router.push('/menu')} />
      </View>
    </View>
  );
}

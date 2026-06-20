import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { Button, Card, ListRow, Screen, Segmented, Text } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { usePrefs, YEARS } from '@/lib/store';

export default function SettingsScreen() {
  const { ui } = useI18n();
  const c = useColors();
  const lang = usePrefs((s) => s.lang);
  const setLang = usePrefs((s) => s.setLang);
  const theme = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const year = usePrefs((s) => s.year);
  const setYear = usePrefs((s) => s.setYear);
  const [notif, setNotif] = useState(true);

  const yearIdx = YEARS.indexOf(year);

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.settings} back />
      <Screen>
        {/* Profile */}
        <Card className="flex-row items-center gap-4 p-5">
          <View className="h-[58px] w-[58px] items-center justify-center rounded-full bg-secondary">
            <Text className="text-[24px] font-bold">P</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[17px] font-bold" numberOfLines={1}>Ploy Srichan</Text>
            <Text variant="meta" numberOfLines={1}>ploy@email.com</Text>
          </View>
          <Button variant="outline" size="sm" label={ui.edit} left={<Icon name="pencil" size={15} color={c.foreground} />} />
        </Card>

        {/* Preferences */}
        <Card className="px-5 py-3">
          <Text variant="eyebrow" className="py-2">{ui.preferences}</Text>

          <View className="flex-row items-center gap-3 border-t border-border py-3">
            <Text className="flex-1 text-[14px]">{ui.language}</Text>
            <Segmented
              className="w-[140px]"
              options={[{ key: 'en', label: 'EN' }, { key: 'th', label: 'TH' }]}
              value={lang}
              onChange={(k) => setLang(k as typeof lang)}
            />
          </View>

          <View className="flex-row items-center gap-3 border-t border-border py-3">
            <Text className="flex-1 text-[14px]">{ui.appearance}</Text>
            <Segmented
              className="w-[160px]"
              options={[{ key: 'light', label: ui.light }, { key: 'dark', label: ui.dark }]}
              value={theme}
              onChange={(k) => setTheme(k as typeof theme)}
            />
          </View>

          <View className="flex-row items-center gap-3 border-t border-border py-3">
            <Text className="flex-1 text-[14px]">{ui.yearScope}</Text>
            <View className="flex-row items-center overflow-hidden rounded-lg border border-border bg-secondary">
              <Pressable
                onPress={() => yearIdx > 0 && setYear(YEARS[yearIdx - 1])}
                disabled={yearIdx <= 0}
                className="px-2.5 py-2 active:opacity-60">
                <Icon name="chevron-left" size={16} color={yearIdx <= 0 ? c.border : c.mutedForeground} />
              </Pressable>
              <Text className="min-w-[44px] text-center text-[14px] font-bold" tabular>{year}</Text>
              <Pressable
                onPress={() => yearIdx < YEARS.length - 1 && setYear(YEARS[yearIdx + 1])}
                disabled={yearIdx >= YEARS.length - 1}
                className="px-2.5 py-2 active:opacity-60">
                <Icon name="chevron-right" size={16} color={yearIdx >= YEARS.length - 1 ? c.border : c.mutedForeground} />
              </Pressable>
            </View>
          </View>

          <View className="flex-row items-center gap-3 border-t border-border py-3">
            <Text className="flex-1 text-[14px]">{ui.notifications}</Text>
            <Switch
              value={notif}
              onValueChange={setNotif}
              trackColor={{ false: c.secondary, true: c.primary }}
              thumbColor={c.card}
            />
          </View>

          <View className="flex-row items-center gap-3 border-t border-border py-3">
            <Text className="flex-1 text-[14px]">{ui.currency}</Text>
            <Text variant="meta" tabular>THB ฿</Text>
          </View>
        </Card>

        {/* More */}
        <Card className="px-5 py-1">
          <ListRow
            className="border-t-0"
            leftNode={<Icon name="shield" size={20} color={c.mutedForeground} />}
            title={ui.security}
            chevron
            onPress={() => {}}
          />
          <ListRow
            className="border-t border-border"
            leftNode={<Icon name="landmark" size={20} color={c.mutedForeground} />}
            title={ui.connectedBanks}
            chevron
            onPress={() => {}}
          />
          <ListRow
            className="border-t border-border"
            leftNode={<Icon name="circle-help" size={20} color={c.mutedForeground} />}
            title={ui.help}
            chevron
            onPress={() => {}}
          />
        </Card>

        {/* Sign out */}
        <Button
          variant="outline"
          left={<Icon name="log-out" size={16} color={c.destructive} />}
          className="mt-1"
          onPress={() => {}}>
          <Text className="text-[14px] font-semibold" style={{ color: c.destructive }}>{ui.signOut}</Text>
        </Button>
      </Screen>
    </View>
  );
}

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Button, Text, Tile } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { useAccounts, useCategories, useCreateTransaction } from '@/lib/hooks';

type TxType = 'expense' | 'income';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

export default function AddModal() {
  const insets = useSafeAreaInsets();
  const { ui, lang } = useI18n();
  const c = useColors();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const create = useCreateTransaction();

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('0');
  const [catKey, setCatKey] = useState('food');
  const [acct, setAcct] = useState('');

  const cats = useMemo(
    () => categories.filter((x) => (type === 'income' ? x.type === 'income' : x.type === 'expense')),
    [categories, type],
  );
  const activeAcct = acct || accounts[0]?.name || '';

  const press = (k: string) => {
    setAmount((prev) => {
      if (k === 'del') return prev.length <= 1 ? '0' : prev.slice(0, -1);
      if (k === '.') return prev.includes('.') ? prev : prev + '.';
      if (prev === '0') return k;
      return prev.length > 9 ? prev : prev + k;
    });
  };

  const disp = (() => {
    const [int, dec] = amount.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return dec !== undefined ? `${grouped}.${dec}` : grouped;
  })();

  const onSave = () => {
    const value = Math.round(parseFloat(amount) || 0);
    if (value <= 0) return router.back();
    const cat = type === 'income' ? 'income' : catKey;
    create.mutate(
      { name: categories.find((x) => x.key === cat)?.label ?? 'Transaction', cat, acct: activeAcct, amount: type === 'income' ? value : -value },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <View className="flex-1 bg-card" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between px-5 pb-2">
        <Text variant="h2">{ui.addTx}</Text>
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-lg bg-secondary active:opacity-70">
          <Icon name="x" size={18} color={c.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        {/* Type toggle */}
        <View className="my-4 flex-row rounded-xl bg-secondary p-1">
          {(['expense', 'income'] as TxType[]).map((t) => (
            <Pressable key={t} onPress={() => setType(t)} className={`flex-1 items-center rounded-lg py-2.5 ${type === t ? 'bg-card' : ''}`}>
              <Text className={`text-[14px] font-semibold ${type === t ? 'text-foreground' : 'text-muted-foreground'}`}>
                {t === 'expense' ? ui.expense : ui.income}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Amount */}
        <View className="items-center py-3">
          <Text variant="meta" className="mb-1">{ui.amount}</Text>
          <Text className="text-[40px] font-extrabold" tabular style={{ color: type === 'income' ? c.xlsFg : c.foreground }}>
            ฿{disp}
          </Text>
        </View>

        {/* Category grid (expense only) */}
        {type === 'expense' ? (
          <>
            <Text variant="eyebrow" className="mb-2.5">{ui.category}</Text>
            <View className="mb-4 flex-row flex-wrap" style={{ gap: 9 }}>
              {cats.map((cat) => {
                const active = cat.key === catKey;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => setCatKey(cat.key)}
                    className={`items-center gap-1.5 rounded-xl border p-2.5 ${active ? 'border-primary bg-secondary' : 'border-border'}`}
                    style={{ width: '22.4%' }}>
                    <Tile icon={cat.icon} tint={cat.tint} size={34} />
                    <Text className="text-[10px] font-medium" numberOfLines={1}>{lang === 'th' ? cat.short : cat.short}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Account chips */}
        <Text variant="eyebrow" className="mb-2.5">{ui.account}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {accounts.map((a) => {
              const active = a.name === activeAcct;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setAcct(a.name)}
                  className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${active ? 'border-primary bg-secondary' : 'border-border'}`}>
                  <Tile icon={a.icon} tint={a.tint} size={26} radius={8} />
                  <Text className="text-[13px] font-semibold">{a.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Keypad */}
        <View className="mb-4 flex-row flex-wrap" style={{ gap: 9 }}>
          {KEYS.map((k) => (
            <Pressable
              key={k}
              onPress={() => press(k)}
              className="items-center justify-center rounded-xl border border-border bg-secondary active:opacity-70"
              style={{ width: '31.5%', height: 48 }}>
              {k === 'del' ? <Icon name="delete" size={20} color={c.foreground} /> : <Text className="text-[19px] font-semibold">{k}</Text>}
            </Pressable>
          ))}
        </View>

        <Button label={ui.save} size="lg" loading={create.isPending} onPress={onSave} className="rounded-xl" />
      </ScrollView>
    </View>
  );
}

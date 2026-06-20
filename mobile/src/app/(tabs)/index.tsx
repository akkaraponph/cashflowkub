import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { CashflowBars, Donut, MiniBars } from '@/components/charts';
import { Badge, Card, ErrorState, Loading, Progress, Screen, Text, Tile } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { usePrefs } from '@/lib/store';
import { useBudgets, useCategories, useDashboard, useTransactions } from '@/lib/hooks';
import { HERO, tint } from '@/lib/theme';
import { compact, fmt, signed } from '@/lib/format';

function StatCard({ icon, tintKey, label, value, valueColor }: { icon: string; tintKey: string; label: string; value: string; valueColor?: string }) {
  return (
    <Card className="flex-1 p-4" style={{ minWidth: 150 }}>
      <View className="flex-row items-center gap-2.5">
        <Tile icon={icon} tint={tintKey} size={34} radius={10} />
        <Text variant="label" numberOfLines={1}>{label}</Text>
      </View>
      <Text className="mt-3 text-[24px] font-bold" tabular style={valueColor ? { color: valueColor } : undefined}>{value}</Text>
    </Card>
  );
}

export default function DashboardScreen() {
  const { ui, lang } = useI18n();
  const c = useColors();
  const theme = usePrefs((s) => s.theme);
  const dash = useDashboard();
  const { data: recent = [] } = useTransactions('limit=5');
  const { data: budgets = [] } = useBudgets();
  const { data: categories = [] } = useCategories();

  const catMap = Object.fromEntries(categories.map((x) => [x.key, x]));

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.dashboard} />
      {dash.isLoading ? (
        <Loading />
      ) : dash.isError || !dash.data ? (
        <ErrorState message={(dash.error as Error)?.message} onRetry={() => dash.refetch()} />
      ) : (
        <Screen onRefresh={() => dash.refetch()} refreshing={dash.isFetching}>
          {/* Greeting */}
          <View className="flex-row items-end justify-between">
            <View>
              <Text variant="h1">{ui.greeting}</Text>
              <Text variant="meta" className="mt-0.5 text-[14px]">{ui.today}</Text>
            </View>
          </View>

          {/* Hero net worth */}
          <LinearGradient
            colors={[HERO[theme].from, HERO[theme].to]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: 24 }}>
            <Text className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: HERO[theme].fg, opacity: 0.7 }}>{ui.netWorth}</Text>
            <Text className="mt-2 text-[40px] font-extrabold" tabular style={{ color: HERO[theme].fg }}>{fmt(dash.data.netWorth)}</Text>
            <View className="mt-3 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}>
              <Icon name="trending-up" size={15} color={HERO[theme].fg} />
              <Text className="text-[13px] font-semibold" style={{ color: HERO[theme].fg }}>{signed(dash.data.month.net)} {ui.thisMonth}</Text>
            </View>
          </LinearGradient>

          {/* Stat cards */}
          <View className="flex-row flex-wrap gap-3">
            <StatCard icon="arrow-down-left" tintKey="xls" label={ui.income} value={fmt(dash.data.month.income)} valueColor={c.xlsFg} />
            <StatCard icon="arrow-up-right" tintKey="pdf" label={ui.expenses} value={fmt(dash.data.month.expense)} />
          </View>
          <StatCard icon="wallet" tintKey="doc" label={`${ui.net} · ${ui.thisMonth}`} value={signed(dash.data.month.net)} valueColor={c.xlsFg} />

          {/* Cashflow */}
          <Card className="p-5">
            <View className="flex-row items-baseline justify-between">
              <Text variant="title">{ui.cashflow}</Text>
              <Text variant="meta">{ui.last6}</Text>
            </View>
            <View className="mt-4">
              <CashflowBars data={dash.data.cashflow.map((m) => ({ month: m.month, income: m.income, expense: m.expense }))} />
            </View>
            <View className="mt-3 flex-row gap-4">
              <View className="flex-row items-center gap-1.5"><View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.xlsFg }} /><Text variant="meta">{ui.income}</Text></View>
              <View className="flex-row items-center gap-1.5"><View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.foreground }} /><Text variant="meta">{ui.expenses}</Text></View>
            </View>
          </Card>

          {/* Spending donut */}
          <Card className="p-5">
            <Text variant="title">{ui.spending}</Text>
            <View className="mt-4 flex-row items-center gap-5">
              <Donut
                segments={dash.data.spending.map((s) => ({ value: s.spent, color: tint(s.tint, theme).fg }))}
                centerLabel={ui.spent}
                centerValue={compact(dash.data.spendTotal)}
              />
              <View className="flex-1 gap-2.5">
                {dash.data.spending.map((s) => (
                  <View key={s.cat} className="flex-row items-center gap-2">
                    <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: tint(s.tint, theme).fg }} />
                    <Text className="flex-1 text-[13px]" numberOfLines={1}>{lang === 'th' ? s.th : s.label}</Text>
                    <Text variant="meta" tabular>{Math.round(s.pct)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>

          {/* Next bill */}
          {dash.data.nextBill ? (
            <Pressable onPress={() => router.navigate('/bills')}>
              <Card className="flex-row items-center gap-3.5 p-4">
                <Tile icon={dash.data.nextBill.icon} tint={dash.data.nextBill.tint} />
                <View className="min-w-0 flex-1">
                  <Text variant="eyebrow">{ui.nextBill}</Text>
                  <View className="mt-0.5 flex-row items-center gap-2">
                    <Text className="text-[15px] font-bold" numberOfLines={1}>{lang === 'th' ? dash.data.nextBill.th : dash.data.nextBill.name}</Text>
                    <Badge label={dash.data.nextBill.status === 'overdue' ? ui.overdue : ui.dueSoon} tone={dash.data.nextBill.status === 'overdue' ? 'danger' : 'warning'} />
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-[18px] font-extrabold" tabular>{fmt(dash.data.nextBill.amount)}</Text>
                  <Text variant="meta">{ui.dueOn} {dash.data.nextBill.dueDay}</Text>
                </View>
              </Card>
            </Pressable>
          ) : null}

          {/* Debt + net worth quick cards */}
          <Pressable onPress={() => router.navigate('/debts')}>
            <Card className="gap-3.5 p-5">
              <View className="flex-row items-center justify-between">
                <Text variant="title">{ui.nav.debts}</Text>
                <View className="flex-row items-center gap-1"><Text variant="meta">{ui.viewAll}</Text><Icon name="chevron-right" size={14} color={c.mutedForeground} /></View>
              </View>
              <View className="flex-row items-center gap-4">
                <Donut size={86} stroke={11} segments={[{ value: dash.data.debt.progress, color: c.primary }, { value: 1 - dash.data.debt.progress, color: c.secondary }]} centerValue={`${Math.round(dash.data.debt.progress * 100)}%`} />
                <View className="flex-1">
                  <Text variant="eyebrow">{ui.totalDebt}</Text>
                  <Text className="text-[24px] font-extrabold" tabular>{fmt(dash.data.debt.remaining)}</Text>
                  <Text variant="meta" tabular>{ui.of} {fmt(dash.data.debt.original)}</Text>
                </View>
              </View>
              {dash.data.debt.focus ? (
                <View className="flex-row items-center gap-3 rounded-xl bg-secondary p-3">
                  <Tile icon={dash.data.debt.focus.icon} tint={dash.data.debt.focus.tint} size={32} />
                  <View className="min-w-0 flex-1">
                    <Text variant="eyebrow">Pay first · {dash.data.debt.focus.apr}% APR</Text>
                    <Text className="text-[13px] font-semibold" numberOfLines={1}>{lang === 'th' ? dash.data.debt.focus.th : dash.data.debt.focus.name}</Text>
                  </View>
                  <Text className="text-[13px] font-bold" tabular>{fmt(dash.data.debt.focus.remaining)}</Text>
                </View>
              ) : null}
            </Card>
          </Pressable>

          <Pressable onPress={() => router.navigate('/networth')}>
            <Card className="gap-3.5 p-5">
              <View className="flex-row items-center justify-between">
                <Text variant="title">{ui.netWorth}</Text>
                <View className="flex-row items-center gap-1"><Text variant="meta">{ui.viewAll}</Text><Icon name="chevron-right" size={14} color={c.mutedForeground} /></View>
              </View>
              <Text className="text-[30px] font-extrabold" tabular>{fmt(dash.data.netWorth)}</Text>
              <View className="flex-row gap-4">
                <Text className="text-[12px] font-semibold" style={{ color: c.xlsFg }}>+{fmt(dash.data.totalAssets)} {ui.assets}</Text>
                <Text className="text-[12px] font-semibold" style={{ color: c.destructive }}>-{fmt(dash.data.totalLiab)} {ui.liabilities}</Text>
              </View>
              <MiniBars values={dash.data.netWorthHist.map((p) => p.value)} />
            </Card>
          </Pressable>

          {/* Budgets preview */}
          <Card className="gap-3 p-5">
            <View className="flex-row items-center justify-between">
              <Text variant="title">{ui.budgetsTitle}</Text>
              <Pressable onPress={() => router.navigate('/budgets')} className="flex-row items-center gap-1">
                <Text variant="meta">{ui.viewAll}</Text><Icon name="chevron-right" size={14} color={c.mutedForeground} />
              </Pressable>
            </View>
            {budgets.slice(0, 4).map((b) => {
              const cat = catMap[b.cat];
              const ratio = b.spent / b.limit;
              const over = ratio > 1;
              return (
                <View key={b.id} className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-semibold">{cat ? (lang === 'th' ? cat.th : cat.label) : b.cat}</Text>
                    <Text variant="meta" tabular>{fmt(b.spent)} / {fmt(b.limit)}</Text>
                  </View>
                  <Progress value={ratio} fillClassName={over ? 'bg-destructive' : 'bg-primary'} />
                </View>
              );
            })}
          </Card>

          {/* Recent transactions */}
          <Card className="px-5 py-3">
            <View className="flex-row items-center justify-between py-2">
              <Text variant="title">{ui.recent}</Text>
              <Pressable onPress={() => router.navigate('/transactions')} className="flex-row items-center gap-1">
                <Text variant="meta">{ui.viewAll}</Text><Icon name="chevron-right" size={14} color={c.mutedForeground} />
              </Pressable>
            </View>
            {recent.map((t) => {
              const cat = catMap[t.cat];
              const income = t.amount >= 0;
              return (
                <Pressable key={t.id} onPress={() => router.push(`/tx/${t.id}`)} className="flex-row items-center gap-3 border-t border-border py-2.5 active:opacity-70">
                  <Tile icon={cat?.icon ?? 'circle'} tint={cat?.tint} />
                  <View className="min-w-0 flex-1">
                    <Text className="text-[14px] font-semibold" numberOfLines={1}>{t.name}</Text>
                    <Text variant="meta">{t.acct}</Text>
                  </View>
                  <Text className="text-[14px] font-bold" tabular style={{ color: income ? c.xlsFg : c.foreground }}>
                    {income ? signed(t.amount) : `-${fmt(t.amount)}`}
                  </Text>
                </Pressable>
              );
            })}
          </Card>

          {/* Goals */}
          <Card className="gap-3 p-5">
            <View className="flex-row items-center justify-between">
              <Text variant="title">{ui.goalsTitle}</Text>
              <Pressable onPress={() => router.navigate('/goals')} className="flex-row items-center gap-1">
                <Text variant="meta">{ui.viewAll}</Text><Icon name="chevron-right" size={14} color={c.mutedForeground} />
              </Pressable>
            </View>
            {dash.data.goals.map((g) => {
              const ratio = g.saved / g.target;
              return (
                <View key={g.id} className="gap-1.5">
                  <View className="flex-row items-center gap-2.5">
                    <Tile icon={g.icon} tint="xls" size={32} />
                    <Text className="flex-1 text-[14px] font-semibold">{lang === 'th' ? g.th : g.name}</Text>
                    <Text variant="meta" tabular>{Math.round(ratio * 100)}%</Text>
                  </View>
                  <Progress value={ratio} />
                  <Text variant="meta" tabular>{fmt(g.saved)} {ui.of} {fmt(g.target)}</Text>
                </View>
              );
            })}
          </Card>
        </Screen>
      )}
    </View>
  );
}

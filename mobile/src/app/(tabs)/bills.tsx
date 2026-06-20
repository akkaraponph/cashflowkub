import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { Badge, Card, ErrorState, Loading, Progress, Screen, Segmented, Text, Tile } from '@/components/ui';
import type { Tone } from '@/components/ui';
import { useI18n } from '@/lib/useI18n';
import { useColors } from '@/lib/useColors';
import { useBills, useBillsSummary, useToggleBillPaid } from '@/lib/hooks';
import { fmt } from '@/lib/format';
import type { Bill } from '@/lib/types';

const STATUS_ORDER: Bill['status'][] = ['overdue', 'dueToday', 'dueSoon', 'upcoming', 'paid'];
const STATUS_TONE: Record<Bill['status'], Tone> = {
  overdue: 'danger',
  dueToday: 'warning',
  dueSoon: 'warning',
  upcoming: 'neutral',
  paid: 'success',
};

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// June 2026 grid: render days 1..30 with a leading blank pad.
const MONTH_DAYS = 30;
const LEAD_PAD = 1;

export default function BillsScreen() {
  const { ui, lang } = useI18n();
  const c = useColors();
  const summary = useBillsSummary();
  const billsQ = useBills();
  const toggle = useToggleBillPaid();
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const bills = billsQ.data ?? [];

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={ui.nav.bills} />
      {summary.isLoading ? (
        <Loading />
      ) : summary.isError || !summary.data ? (
        <ErrorState message={(summary.error as Error)?.message} onRetry={() => summary.refetch()} />
      ) : (
        <Screen onRefresh={() => summary.refetch()} refreshing={summary.isFetching}>
          {/* Summary */}
          <Card className="p-5">
            <Text variant="eyebrow">{ui.billsTotal}</Text>
            <Text className="mt-1 text-[34px] font-extrabold" tabular>{fmt(summary.data.total)}</Text>
            <View className="mt-3 flex-row gap-5">
              <View>
                <Text variant="meta">{ui.billsPaid}</Text>
                <Text className="text-[16px] font-bold" tabular style={{ color: c.xlsFg }}>{fmt(summary.data.paid)}</Text>
              </View>
              <View>
                <Text variant="meta">{ui.billsRemaining}</Text>
                <Text className="text-[16px] font-bold" tabular style={{ color: c.destructive }}>{fmt(summary.data.remaining)}</Text>
              </View>
            </View>
            <View className="mt-4">
              <Progress value={summary.data.total > 0 ? summary.data.paid / summary.data.total : 0} fillClassName="bg-type-xls-fg" height={10} />
            </View>
          </Card>

          {/* View toggle */}
          <Segmented
            options={[{ key: 'list', label: ui.viewList }, { key: 'calendar', label: ui.viewCalendar }]}
            value={view}
            onChange={(k) => setView(k as 'list' | 'calendar')}
          />

          {view === 'list' ? (
            <ListView bills={bills} ui={ui} lang={lang} c={c} onToggle={(id) => toggle.mutate({ id })} />
          ) : (
            <CalendarView bills={bills} ui={ui} c={c} />
          )}
        </Screen>
      )}
    </View>
  );
}

type Strings = ReturnType<typeof useI18n>['ui'];
type Colors = ReturnType<typeof useColors>;

function sectionLabel(status: Bill['status'], ui: Strings): string {
  switch (status) {
    case 'overdue': return ui.overdue;
    case 'dueToday': return ui.dueToday;
    case 'dueSoon': return ui.dueSoon;
    case 'upcoming': return ui.upcoming;
    case 'paid': return ui.billsPaid;
  }
}

function ListView({ bills, ui, lang, c, onToggle }: { bills: Bill[]; ui: Strings; lang: string; c: Colors; onToggle: (id: number) => void }) {
  return (
    <View className="gap-5">
      {STATUS_ORDER.map((status) => {
        const items = bills.filter((b) => b.status === status);
        if (items.length === 0) return null;
        return (
          <View key={status} className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="eyebrow">{sectionLabel(status, ui)}</Text>
              <Text variant="meta" tabular>{items.length}</Text>
            </View>
            <Card className="overflow-hidden p-0">
              {items.map((b, i) => (
                <View key={b.id} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <Pressable
                    onPress={() => onToggle(b.id)}
                    className="h-6 w-6 items-center justify-center rounded-md border active:opacity-70"
                    style={{ borderColor: b.paid ? c.primary : c.border, backgroundColor: b.paid ? c.primary : 'transparent' }}>
                    {b.paid ? <Icon name="check" size={14} color="#fff" /> : null}
                  </Pressable>
                  <Tile icon={b.icon} tint={b.tint} size={38} />
                  <View className="min-w-0 flex-1">
                    <Text className={`text-[14px] font-semibold ${b.paid ? 'text-muted-foreground line-through' : ''}`} numberOfLines={1}>
                      {lang === 'th' ? b.th : b.name}
                    </Text>
                    <Text variant="meta">{ui.dueOn} {b.dueDay}</Text>
                  </View>
                  <View className="items-end gap-1">
                    <Text className="text-[15px] font-bold" tabular>{fmt(b.amount)}</Text>
                    <Badge label={sectionLabel(b.status, ui)} tone={STATUS_TONE[b.status]} />
                  </View>
                </View>
              ))}
            </Card>
          </View>
        );
      })}
    </View>
  );
}

function CalendarView({ bills, ui, c }: { bills: Bill[]; ui: Strings; c: Colors }) {
  const byDay = new Map<number, Bill[]>();
  for (const b of bills) {
    const list = byDay.get(b.dueDay) ?? [];
    list.push(b);
    byDay.set(b.dueDay, list);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < LEAD_PAD; i++) cells.push(null);
  for (let d = 1; d <= MONTH_DAYS; d++) cells.push(d);

  return (
    <Card className="p-4">
      <View className="flex-row">
        {DOW.map((d, i) => (
          <View key={i} className="flex-1 items-center py-1">
            <Text variant="meta" className="text-[11px] font-bold uppercase">{d}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((day, i) => {
          if (day === null) return <View key={`pad-${i}`} style={{ width: `${100 / 7}%` }} className="p-1" />;
          const dayBills = byDay.get(day);
          const hasBills = !!dayBills && dayBills.length > 0;
          const overdueUnpaid = hasBills && dayBills!.some((b) => !b.paid && b.status === 'overdue');
          const dotColor = overdueUnpaid ? c.destructive : c.primary;
          return (
            <Pressable
              key={day}
              disabled={!hasBills}
              onPress={() => router.push(`/day/${day}`)}
              style={{ width: `${100 / 7}%` }}
              className="p-1">
              <View className="aspect-square items-center justify-center rounded-lg" style={{ backgroundColor: hasBills ? c.secondary : 'transparent' }}>
                <Text className="text-[13px] font-semibold" tabular>{day}</Text>
                {hasBills ? <View className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

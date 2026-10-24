'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tile } from '@/components/cfk/tile';
import { useI18n } from '@/components/i18n-provider';
import { daysInMonth, firstWeekday } from '@/lib/bill-schedule';
import { fmt, formatDay } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { BillView } from '@/server/views';
import { BillCheck } from './bill-check';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function BillsCalendar({ bills, month }: { bills: BillView[]; month: string }) {
  const { ui, lang } = useI18n();
  const [day, setDay] = useState<number | null>(null);
  const byDay = new Map<number, BillView[]>();
  for (const b of bills) {
    const d = Number(b.dueDate.slice(8));
    byDay.set(d, [...(byDay.get(d) ?? []), b]);
  }
  const cells: (number | null)[] = [...Array(firstWeekday(month)).fill(null), ...Array.from({ length: daysInMonth(month) }, (_, i) => i + 1)];
  const dayBills = day ? (byDay.get(day) ?? []) : [];

  return (
    <Card className="gap-2 p-4">
      <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase text-muted-foreground">
        {DOW.map((d, i) => <span key={i} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`pad-${i}`} />;
          const list = byDay.get(d);
          const overdue = list?.some((b) => b.status === 'overdue');
          return (
            <button key={d} type="button" disabled={!list} onClick={() => setDay(d)}
              className={cn('flex aspect-square flex-col items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums', list ? 'bg-secondary hover:opacity-80' : 'cursor-default')}>
              {d}
              {list ? <span className={cn('mt-1 size-1.5 rounded-full', overdue ? 'bg-destructive' : 'bg-primary')} /> : null}
            </button>
          );
        })}
      </div>
      <Dialog open={day !== null} onOpenChange={(o) => !o && setDay(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ui.dueOn} {day ? formatDay(`${month}-${String(day).padStart(2, '0')}`, lang) : ''}</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-2xl bg-secondary">
            {dayBills.map((b) => (
              <div key={b.id} className="flex items-center gap-3 border-b px-3.5 py-3 last:border-0">
                <BillCheck id={b.id} paid={b.paid} month={month} />
                <Tile icon={b.icon} tint={b.tint} size={34} />
                <span className={cn('flex-1 truncate text-sm font-semibold', b.paid && 'text-muted-foreground line-through')}>{localized(lang, b.name, b.th)}</span>
                <span className="text-sm font-bold tabular-nums">{fmt(b.amount)}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

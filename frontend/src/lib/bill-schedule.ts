// Pure month maths and "does this bill occur in month M". Months are 'YYYY-MM'. UTC throughout so the result never depends on the machine's time zone.
import { CURRENT_MONTH } from '@/lib/clock';

export const RECUR_PERIODS = [1, 2, 3, 4, 6, 12] as const;

export interface Recurrence {
  freq: string;
  startMonth: string;
  endMonth: string;
  everyMonths: number;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonth = (v: string): boolean => MONTH_RE.test(v);

/** A valid `month` query value, else the current month. */
export const monthParam = (raw: string | undefined): string => (raw !== undefined && isMonth(raw) ? raw : CURRENT_MONTH);

const parts = (month: string): [number, number] => [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
const index = (month: string): number => {
  const [y, m] = parts(month);
  return y * 12 + (m - 1);
};

export function shiftMonth(month: string, delta: number): string {
  const i = index(month) + delta;
  return `${String(Math.floor(i / 12)).padStart(4, '0')}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** `to` minus `from`, in months (negative when `to` is earlier). */
export const monthsBetween = (from: string, to: string): number => index(to) - index(from);

export function daysInMonth(month: string): number {
  const [y, m] = parts(month);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = Sunday. */
export function firstWeekday(month: string): number {
  const [y, m] = parts(month);
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

/** The due date in `month`; a due day past the month's end falls on its last day. */
export function dueDateIn(month: string, dueDay: number): string {
  return `${month}-${String(Math.min(dueDay, daysInMonth(month))).padStart(2, '0')}`;
}

export function occursIn(r: Recurrence, month: string): boolean {
  if (month < r.startMonth) return false;
  if (r.endMonth !== '' && month > r.endMonth) return false;
  if (r.freq === 'once') return month === r.startMonth;
  return monthsBetween(r.startMonth, month) % r.everyMonths === 0;
}

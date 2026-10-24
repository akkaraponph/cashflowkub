// Pure form model for the add/edit bill dialog.
import { dueDateIn, isMonth } from '@/lib/bill-schedule';
import { CURRENT_MONTH } from '@/lib/clock';
import { localized, type Lang } from '@/lib/i18n';

export const BILL_KINDS = ['bill', 'subscription'] as const;
export type BillKind = (typeof BILL_KINDS)[number];
export type BillFreq = 'monthly' | 'once';

export const KIND_PRESETS: Record<BillKind, { icon: string; tint: string; cat: string }> = {
  bill: { icon: 'receipt', tint: 'pdf', cat: 'bills' },
  subscription: { icon: 'cloud', tint: 'image', cat: 'fun' },
};

export interface BillForm {
  name: string;
  kind: BillKind;
  amount: string;
  dueDay: string;
  freq: BillFreq;
  cat: string;
  /** Recurring bills: first month, optional last month ('' = no end) and months between repeats. */
  startMonth: string;
  endMonth: string;
  everyMonths: string;
  /** One-time bills: the exact date, YYYY-MM-DD. It replaces startMonth and dueDay. */
  date: string;
}

export const emptyBillForm: BillForm = {
  name: '', kind: 'bill', amount: '', dueDay: '1', freq: 'monthly', cat: 'bills',
  startMonth: CURRENT_MONTH, endMonth: '', everyMonths: '1', date: `${CURRENT_MONTH}-01`,
};

/** A real calendar date written YYYY-MM-DD. */
function isDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && isMonth(v.slice(0, 7)) && dueDateIn(v.slice(0, 7), Number(v.slice(8))) === v;
}

const isKind = (v: string): v is BillKind => (BILL_KINDS as readonly string[]).includes(v);

/** The form for an existing bill, showing the name as the user currently sees it. */
export function formFromBill(
  b: { name: string; th: string; kind: string; amount: number; dueDay: number; freq: string; cat: string; startMonth: string; endMonth: string; everyMonths: number },
  lang: Lang,
): BillForm {
  return {
    name: localized(lang, b.name, b.th), kind: isKind(b.kind) ? b.kind : 'bill', amount: String(b.amount),
    dueDay: String(b.dueDay), freq: b.freq === 'once' ? 'once' : 'monthly', cat: b.cat,
    startMonth: b.startMonth, endMonth: b.endMonth, everyMonths: String(b.everyMonths), date: dueDateIn(b.startMonth, b.dueDay),
  };
}

/**
 * POST / PATCH body, or null when the form is invalid (blank name or amount, negative amount, and for the schedule: a recurring
 * bill needs a due day 1-31, a start month, an end month not before it, and a period of 1-12 months; a one-time bill needs a real date).
 * One name is stored for both languages. The icon and tint follow the kind: always on add, on edit only when it changed from `previousKind`.
 */
export function billBody(f: BillForm, previousKind?: BillKind): Record<string, unknown> | null {
  const name = f.name.trim();
  const rawAmount = f.amount.replace(/[,฿\s]/g, '');
  const amount = rawAmount === '' ? NaN : Math.round(Number(rawAmount));
  if (name === '' || !Number.isFinite(amount) || amount < 0) return null;
  const schedule = scheduleBody(f);
  if (!schedule) return null;
  const { icon, tint } = KIND_PRESETS[f.kind];
  return { name, th: name, kind: f.kind, amount, freq: f.freq, cat: f.cat, ...schedule, ...(previousKind === f.kind ? {} : { icon, tint }) };
}

function scheduleBody(f: BillForm): { dueDay: number; startMonth: string; endMonth: string; everyMonths: number } | null {
  if (f.freq === 'once') {
    if (!isDate(f.date)) return null;
    return { dueDay: Number(f.date.slice(8)), startMonth: f.date.slice(0, 7), endMonth: '', everyMonths: 1 };
  }
  const dueDay = Number(f.dueDay);
  const everyMonths = Number(f.everyMonths);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return null;
  if (!isMonth(f.startMonth) || (f.endMonth !== '' && (!isMonth(f.endMonth) || f.endMonth < f.startMonth))) return null;
  if (!Number.isInteger(everyMonths) || everyMonths < 1 || everyMonths > 12) return null;
  return { dueDay, startMonth: f.startMonth, endMonth: f.endMonth, everyMonths };
}

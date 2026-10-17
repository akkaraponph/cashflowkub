// Pure form model for the add/edit bill dialog.
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
}

export const emptyBillForm: BillForm = { name: '', kind: 'bill', amount: '', dueDay: '1', freq: 'monthly', cat: 'bills' };

const isKind = (v: string): v is BillKind => (BILL_KINDS as readonly string[]).includes(v);

/** The form for an existing bill, showing the name as the user currently sees it. */
export function formFromBill(b: { name: string; th: string; kind: string; amount: number; dueDay: number; freq: string; cat: string }, lang: Lang): BillForm {
  return {
    name: localized(lang, b.name, b.th), kind: isKind(b.kind) ? b.kind : 'bill', amount: String(b.amount),
    dueDay: String(b.dueDay), freq: b.freq === 'once' ? 'once' : 'monthly', cat: b.cat,
  };
}

/**
 * POST / PATCH body, or null when the form is invalid (blank name or amount, negative amount, due day outside 1-31).
 * One name is stored for both languages. The icon and tint follow the kind: always on add, on edit only when it changed from `previousKind`.
 */
export function billBody(f: BillForm, previousKind?: BillKind): Record<string, unknown> | null {
  const name = f.name.trim();
  const rawAmount = f.amount.replace(/[,฿\s]/g, '');
  const amount = rawAmount === '' ? NaN : Math.round(Number(rawAmount));
  const dueDay = Number(f.dueDay);
  if (name === '' || !Number.isFinite(amount) || amount < 0 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return null;
  const { icon, tint } = KIND_PRESETS[f.kind];
  return { name, th: name, kind: f.kind, amount, dueDay, freq: f.freq, cat: f.cat, ...(previousKind === f.kind ? {} : { icon, tint }) };
}

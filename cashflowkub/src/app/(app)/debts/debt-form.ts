// Pure form model shared by the add and edit debt dialogs.
import { localized, type Lang } from '@/lib/i18n';
import { toApr } from '@/server/debt/terms';
import type { DebtView } from '@/server/views';

export const KINDS = ['paylater', 'cashloan', 'bankloan', 'creditcard', 'personal'] as const;
export type Kind = (typeof KINDS)[number];
export type RateUnit = 'month' | 'year';
export type Calc = 'flat' | 'reducing';

// Sensible defaults per product type; every field stays editable.
export const PRESETS: Record<Kind, { icon: string; tint: string; calc: Calc; unit: RateUnit; revolving: boolean; lender: string }> = {
  paylater: { icon: 'shopping-bag', tint: 'image', calc: 'flat', unit: 'month', revolving: true, lender: 'Shopee' },
  cashloan: { icon: 'hand-coins', tint: 'folder', calc: 'flat', unit: 'month', revolving: false, lender: 'Shopee' },
  bankloan: { icon: 'landmark', tint: 'doc', calc: 'reducing', unit: 'year', revolving: false, lender: '' },
  creditcard: { icon: 'credit-card', tint: 'pdf', calc: 'reducing', unit: 'year', revolving: true, lender: '' },
  personal: { icon: 'wallet', tint: 'xls', calc: 'flat', unit: 'year', revolving: false, lender: '' },
};

export type TextField =
  | 'name' | 'lender' | 'original' | 'openingPaid' | 'rate' | 'termMonths'
  | 'fixedPayment' | 'monthly' | 'dueDay' | 'graceDays' | 'lateFee' | 'penaltyApr';

export interface DebtForm {
  kind: Kind;
  unit: RateUnit;
  calc: Calc;
  revolving: boolean;
  fields: Record<TextField, string>;
}

export const int = (v: string): number => Math.max(0, Math.round(Number(v) || 0));
export const num = (v: string): number => Math.max(0, Number(v) || 0);

export const emptyForm: DebtForm = {
  kind: 'paylater', unit: 'month', calc: 'flat', revolving: true,
  fields: {
    name: '', lender: 'Shopee', original: '', openingPaid: '0', rate: '0', termMonths: '0',
    fixedPayment: '0', monthly: '0', dueDay: '1', graceDays: '0', lateFee: '0', penaltyApr: '0',
  },
};

const isKind = (v: string): v is Kind => (KINDS as readonly string[]).includes(v);

/** Edit form for an existing debt. The stored rate is annual, so the form shows it per year. */
export function formFromDebt(d: DebtView, lang: Lang): DebtForm {
  return {
    kind: isKind(d.kind) ? d.kind : 'personal',
    unit: 'year',
    calc: d.calc === 'flat' ? 'flat' : 'reducing',
    revolving: d.revolving,
    fields: {
      name: localized(lang, d.name, d.th), lender: d.lender, original: String(d.original), openingPaid: String(d.openingPaid), rate: String(d.apr),
      termMonths: String(d.termMonths), fixedPayment: String(d.fixedPayment), monthly: String(d.monthly), dueDay: String(d.dueDay),
      graceDays: String(d.graceDays), lateFee: String(d.lateFee), penaltyApr: String(d.penaltyApr),
    },
  };
}

/** POST / PATCH body. Add mode also sends the product-type icon and tint; edit mode keeps the stored ones. */
export function formToBody(f: DebtForm, mode: 'add' | 'edit' = 'add'): Record<string, unknown> {
  const x = f.fields;
  const name = x.name.trim();
  return {
    name, th: name, kind: f.kind, lender: x.lender.trim(),
    ...(mode === 'add' ? { icon: PRESETS[f.kind].icon, tint: PRESETS[f.kind].tint } : {}),
    original: int(x.original), openingPaid: int(x.openingPaid), apr: toApr(num(x.rate), f.unit), calc: f.calc,
    termMonths: int(x.termMonths), fixedPayment: int(x.fixedPayment), monthly: int(x.monthly),
    dueDay: int(x.dueDay), graceDays: int(x.graceDays), lateFee: int(x.lateFee), penaltyApr: num(x.penaltyApr), revolving: f.revolving,
  };
}

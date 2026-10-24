// Pure form model for the add/edit account dialog.
export const ACCOUNT_KINDS = ['bank', 'cash', 'ewallet', 'credit'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const KIND_PRESETS: Record<AccountKind, { icon: string; tint: string }> = {
  bank: { icon: 'landmark', tint: 'doc' },
  cash: { icon: 'banknote', tint: 'folder' },
  ewallet: { icon: 'smartphone', tint: 'image' },
  credit: { icon: 'credit-card', tint: 'pdf' },
};

export interface AccountForm {
  name: string;
  sub: string;
  kind: AccountKind;
  balance: string;
}

export const emptyAccountForm: AccountForm = { name: '', sub: '', kind: 'bank', balance: '0' };

const isKind = (v: string): v is AccountKind => (ACCOUNT_KINDS as readonly string[]).includes(v);

export function formFromAccount(a: { name: string; sub: string; kind: string; balance: number }): AccountForm {
  return { name: a.name, sub: a.sub, kind: isKind(a.kind) ? a.kind : 'bank', balance: String(a.balance) };
}

/**
 * POST / PATCH body, or null when the name is blank. The icon and tint follow the account type:
 * always on add, and on edit only when the type changed from `previousKind`.
 */
export function accountBody(f: AccountForm, previousKind?: AccountKind): Record<string, unknown> | null {
  const name = f.name.trim();
  if (name === '') return null;
  const balance = Math.round(Number(f.balance.replace(/[,฿\s]/g, '')) || 0);
  return {
    name, sub: f.sub.trim(), kind: f.kind, balance,
    ...(previousKind === f.kind ? {} : KIND_PRESETS[f.kind]),
  };
}

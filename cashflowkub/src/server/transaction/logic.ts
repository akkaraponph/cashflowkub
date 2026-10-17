// Pure transaction logic: read view, date-relative group label, date parsing, list filter.
import type { Transaction } from '@/generated/prisma/client';
import { badRequest } from '@/server/errors';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface TxView {
  id: number;
  name: string;
  cat: string;
  acct: string;
  amount: number;
  note: string;
  interest: number;
  fee: number;
  goal: string;
  /** "2026-06-18" */
  isoDate: string;
  /** "Jun 18, 2026" */
  date: string;
  /** "Today" | "Yesterday" | "Jun 15" */
  group: string;
}

export function formatLongDate(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

export function groupLabel(date: Date, today: Date): string {
  if (sameDay(date, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** A Transaction row with money fields as plain numbers (Prisma returns Decimal). */
export type TxPlain = Omit<Transaction, 'amount' | 'interest' | 'fee'> & { amount: number; interest: number; fee: number };

export function toPlain(t: Transaction): TxPlain {
  return { ...t, amount: t.amount.toNumber(), interest: t.interest.toNumber(), fee: t.fee.toNumber() };
}

export function hasAtMostTwoDecimals(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

export function toTxView(t: TxPlain, today: Date): TxView {
  return {
    id: t.id, name: t.name, cat: t.cat, acct: t.acct, amount: t.amount, note: t.note,
    interest: t.interest, fee: t.fee, goal: t.goal, isoDate: t.date.toISOString().slice(0, 10),
    date: formatLongDate(t.date), group: groupLabel(t.date, today),
  };
}

function utcDate(y: number, m: number, d: number): Date | null {
  if (m < 0 || m > 11) return null;
  const out = new Date(Date.UTC(y, m, d));
  return out.getUTCMonth() === m && out.getUTCDate() === d ? out : null;
}

/** Parses "Jun 18, 2026", "2026-06-18" or an RFC 3339 timestamp to a UTC calendar date; null if invalid. */
export function parseFlexDate(raw: string): Date | null {
  const s = raw.trim();
  const long = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(s);
  if (long) return utcDate(Number(long[3]), MONTHS.indexOf(long[1]), Number(long[2]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return utcDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = new Date(s);
    if (!Number.isNaN(t.getTime())) return utcDate(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  }
  return null;
}

export interface TxFilter {
  type?: 'income' | 'expense';
  category?: string;
  account?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

/** Reads list filters from a query string. Unknown type / bad limit are ignored; bad dates are a 400. */
export function parseTxFilter(params: URLSearchParams): TxFilter {
  const f: TxFilter = {};
  const type = params.get('type');
  if (type === 'income' || type === 'expense') f.type = type;
  const category = params.get('category');
  if (category) f.category = category;
  const account = params.get('account');
  if (account) f.account = account;
  for (const key of ['from', 'to'] as const) {
    const raw = params.get(key);
    if (!raw) continue;
    const parsed = parseFlexDate(raw);
    if (!parsed) throw badRequest(`invalid ${key} date: ${raw}`);
    f[key] = parsed;
  }
  const limit = Number(params.get('limit'));
  if (Number.isInteger(limit) && limit > 0) f.limit = Math.min(limit, 500);
  return f;
}

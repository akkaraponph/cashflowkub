// Pure logic for the transaction sheet: row validation, paste parsing, month range, summaries.
import type { Category } from '@/generated/prisma/client';
import type { TxView } from '@/server/transaction/logic';

export type Activity = 'income' | 'expense';

export interface RowDraft {
  id?: number;
  /** YYYY-MM-DD */
  date: string;
  activity: Activity;
  cat: string;
  acct: string;
  amount: string;
  interest: string;
  fee: string;
  goal: string;
  note: string;
  name: string;
}

export interface TxBody {
  name: string;
  cat: string;
  acct: string;
  amount: number;
  interest: number;
  fee: number;
  goal: string;
  note: string;
  date: string;
}

export type RowCheck = { kind: 'empty' } | { kind: 'incomplete'; missing: (keyof RowDraft)[] } | { kind: 'ready'; body: TxBody };

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "฿1,358.00" / "-100" → 1358 / 100 (satang kept, max 2 decimals) (sign comes from the activity); null if blank or not a number. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[฿,\s]/g, '').replace(/^-/, '');
  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(s)) return null;
  return Math.round(Number(s) * 100) / 100;
}

/** Keystroke filter for money inputs: digits and the first '.', at most 2 decimals. */
export function sanitizeAmountInput(raw: string): string {
  const s = raw.replace(/[^\d.]/g, '');
  const i = s.indexOf('.');
  if (i < 0) return s;
  return s.slice(0, i) + '.' + s.slice(i + 1).replace(/\./g, '').slice(0, 2);
}

function isoDate(y: number, m: number, d: number): string | null {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
}

/** "1 ม.ค. 2026", "1 ม.ค. 2569" (Buddhist era if year > 2400) or "2026-01-01" → "2026-01-01"; null if invalid. */
export function parseThaiOrIsoDate(raw: string): string | null {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const th = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(s);
  if (!th) return null;
  const m = THAI_MONTHS.indexOf(th[2]);
  if (m < 0) return null;
  const year = Number(th[3]);
  return isoDate(year > 2400 ? year - 543 : year, m + 1, Number(th[1]));
}

export function validateRow(d: RowDraft, cats: Category[]): RowCheck {
  const touched = [d.cat, d.acct, d.amount, d.interest, d.fee, d.goal, d.note, d.name].some((v) => v.trim() !== '');
  if (!touched) return { kind: 'empty' };
  const missing: (keyof RowDraft)[] = [];
  const category = cats.find((c) => c.key === d.cat);
  if (!category) missing.push('cat');
  if (d.acct.trim() === '') missing.push('acct');
  const amount = parseAmount(d.amount);
  if (!amount) missing.push('amount');
  const interest = d.interest.trim() === '' ? 0 : parseAmount(d.interest);
  if (interest === null) missing.push('interest');
  const fee = d.fee.trim() === '' ? 0 : parseAmount(d.fee);
  if (fee === null) missing.push('fee');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !parseThaiOrIsoDate(d.date)) missing.push('date');
  if (missing.length > 0 || !category || !amount || interest === null || fee === null) return { kind: 'incomplete', missing };
  return {
    kind: 'ready',
    body: {
      name: d.name.trim() || category.label, cat: d.cat, acct: d.acct.trim(), amount: d.activity === 'income' ? amount : -amount,
      interest, fee, goal: d.goal, note: d.note, date: d.date,
    },
  };
}

export function draftFromView(t: TxView): RowDraft {
  return {
    id: t.id, date: t.isoDate, activity: t.amount > 0 ? 'income' : 'expense', cat: t.cat, acct: t.acct, amount: String(Math.abs(t.amount)),
    interest: t.interest ? String(t.interest) : '', fee: t.fee ? String(t.fee) : '', goal: t.goal, note: t.note, name: t.name,
  };
}

function parseActivity(raw: string, category: Category): Activity | null {
  const s = raw.trim().toLowerCase();
  if (s === 'รับเงิน' || s === 'income') return 'income';
  if (s === 'จ่ายเงิน' || s === 'expense') return 'expense';
  return s === '' ? (category.type === 'income' ? 'income' : 'expense') : null;
}

/** Parses tab-separated sheet rows: date, activity, category, account, amount, interest, fee, goal, note. All-or-nothing. */
export function parsePaste(
  text: string, defaults: { date: string; acct: string }, cats: Category[],
): { ok: true; bodies: TxBody[] } | { ok: false; line: number; error: string } {
  const bodies: TxBody[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const line = i + 1;
    const fail = (error: string) => ({ ok: false as const, line, error });
    const c = lines[i].split('\t').map((v) => v.trim());
    const date = c[0] ? parseThaiOrIsoDate(c[0]) : defaults.date;
    if (!date) return fail(`invalid date: ${c[0]}`);
    const key = (c[2] ?? '').toLowerCase();
    const category = cats.find((x) => x.key === key || x.label.toLowerCase() === key || x.th === c[2]);
    if (!category) return fail(`unknown category: ${c[2] ?? ''}`);
    const activity = parseActivity(c[1] ?? '', category);
    if (!activity) return fail(`unknown activity: ${c[1]}`);
    if (c[1] && activity !== (category.type === 'income' ? 'income' : 'expense')) return fail(`activity does not match category: ${c[2]}`);
    const amount = parseAmount(c[4] ?? '');
    if (!amount) return fail(`invalid amount: ${c[4] ?? ''}`);
    const interest = c[5] ? parseAmount(c[5]) : 0;
    if (interest === null) return fail(`invalid interest: ${c[5]}`);
    const fee = c[6] ? parseAmount(c[6]) : 0;
    if (fee === null) return fail(`invalid fee: ${c[6]}`);
    if ((interest > 0 || fee > 0) && category.sub !== 'debt') return fail('interest and fee only apply to debt payments');
    if (c[7] && category.sub !== 'saving') return fail('goal only applies to savings');
    const note = c[8] ?? '';
    bodies.push({
      name: note || category.label, cat: category.key, acct: c[3] || defaults.acct, amount: activity === 'income' ? amount : -amount,
      interest, fee, goal: c[7] ?? '', note, date,
    });
  }
  if (bodies.length === 0) return { ok: false, line: 1, error: 'nothing to paste' };
  return { ok: true, bodies };
}

/** "2026-01" → first and last day (UTC dates); null if malformed. */
export function monthRange(month: string): { from: Date; to: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return { from: new Date(Date.UTC(y, mo - 1, 1)), to: new Date(Date.UTC(y, mo, 0)) };
}

/** "2026-12" + 1 → "2027-01". Assumes a valid month. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function summarize(rows: Pick<TxView, 'cat' | 'amount'>[], cats: Category[]): { income: number; saving: number; need: number; want: number; debt: number } {
  const sub = new Map(cats.map((c) => [c.key, c.sub]));
  const out = { income: 0, saving: 0, need: 0, want: 0, debt: 0 };
  for (const r of rows) {
    if (r.amount > 0) { out.income += r.amount; continue; }
    const s = sub.get(r.cat);
    out[s === 'saving' || s === 'debt' || s === 'need' ? s : 'want'] += -r.amount;
  }
  return out;
}

export function columnTotals(rows: Pick<TxView, 'amount' | 'interest' | 'fee'>[]): { income: number; expense: number; interest: number; fee: number } {
  const out = { income: 0, expense: 0, interest: 0, fee: 0 };
  for (const r of rows) {
    if (r.amount > 0) out.income += r.amount;
    else out.expense += -r.amount;
    out.interest += r.interest;
    out.fee += r.fee;
  }
  return out;
}

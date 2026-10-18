import { describe, expect, it } from 'vitest';
import {
  columnTotals, monthRange, shiftMonth, parseAmount, sanitizeAmountInput, parsePaste, parseThaiOrIsoDate, summarize, validateRow, type RowDraft,
} from '@/lib/tx-sheet';
import { category } from '../fixtures';

const cats = [
  category({ id: 1, key: 'food', label: 'Food & Dining', th: 'อาหาร', sub: 'need' }),
  category({ id: 2, key: 'shopping', label: 'Shopping', th: 'ช้อปปิ้ง', sub: 'want' }),
  category({ id: 3, key: 'income', label: 'Income', th: 'รายรับ', type: 'income', sub: '' }),
  category({ id: 4, key: 'saving', label: 'Savings & Investing', th: 'เงินสะสม', sub: 'saving' }),
  category({ id: 5, key: 'debt', label: 'Debt payment', th: 'ชำระหนี้สิน', sub: 'debt' }),
];
const blank: RowDraft = { date: '2026-01-01', activity: 'pay', item: '', cat: '', acct: '', amount: '', interest: '', fee: '', goal: '', note: '', name: '' };

describe('parseAmount', () => {
  it('strips baht sign, commas and sign; keeps satang', () => {
    expect(parseAmount('1,358.00')).toBe(1358);
    expect(parseAmount('฿550')).toBe(550);
    expect(parseAmount('-100')).toBe(100);
  });
  it('returns null for blanks and junk', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
    expect(parseAmount('.')).toBeNull();
    expect(parseAmount('1.234')).toBeNull();
  });
  it('accepts a trailing dot', () => {
    expect(parseAmount('100.')).toBe(100);
    expect(parseAmount('5.')).toBe(5);
  });
});

describe('satang', () => {
it('keeps satang and rejects finer precision', () => {
  expect(parseAmount('1,358.25')).toBe(1358.25);
  expect(parseAmount('2.6')).toBe(2.6);
  expect(parseAmount('.5')).toBe(0.5);
  expect(parseAmount('1.234')).toBeNull();
  expect(parseAmount('1e3')).toBeNull();
});
describe('sanitizeAmountInput', () => {
  it('lets only a positive decimal through', () => {
    expect(sanitizeAmountInput('abc12.345')).toBe('12.34');
    expect(sanitizeAmountInput('1,000.5')).toBe('1000.5');
    expect(sanitizeAmountInput('-1.2.3')).toBe('1.23');
    expect(sanitizeAmountInput('฿ 99')).toBe('99');
    expect(sanitizeAmountInput('.')).toBe('.');
    expect(sanitizeAmountInput('ห้าสิบ')).toBe('');
  });
});
it('parsePaste rejects a three-decimal amount with its line number', () => {
  const r = parsePaste('2026-01-05\tจ่ายเงิน\tfood\tCash\t12.345', { date: '2026-01-01', acct: 'Cash' }, cats);
  expect(r).toEqual({ ok: false, line: 1, error: 'invalid amount: 12.345' });
});
});

describe('validateRow', () => {
  it('treats an untouched row as empty', () => {
    expect(validateRow(blank, cats)).toEqual({ kind: 'empty' });
  });
  it('flags a half-filled row as incomplete', () => {
    const r = validateRow({ ...blank, amount: '100' }, cats);
    expect(r.kind).toBe('incomplete');
    if (r.kind === 'incomplete') expect(r.missing).toEqual(expect.arrayContaining(['cat', 'acct']));
  });
  it('rejects a zero amount', () => {
    const r = validateRow({ ...blank, cat: 'food', acct: 'Cash', amount: '0' }, cats);
    expect(r).toEqual({ kind: 'incomplete', missing: ['amount'] });
  });
  it('signs the amount from the activity and names the row after the category', () => {
    const exp = validateRow({ ...blank, cat: 'food', acct: 'Cash', amount: '100' }, cats);
    expect(exp).toMatchObject({ kind: 'ready', body: { amount: -100, name: 'Food & Dining', interest: 0, fee: 0, goal: '', date: '2026-01-01' } });
    const inc = validateRow({ ...blank, activity: 'receive', cat: 'income', acct: 'Cash', amount: '100', note: 'gift' }, cats);
    expect(inc).toMatchObject({ kind: 'ready', body: { amount: 100, note: 'gift' } });
  });
  it('keeps an existing name and flags an unknown category', () => {
    expect(validateRow({ ...blank, cat: 'food', acct: 'Cash', amount: '5', name: 'Starbucks' }, cats)).toMatchObject({ body: { name: 'Starbucks' } });
    expect(validateRow({ ...blank, cat: 'nope', acct: 'Cash', amount: '5' }, cats)).toEqual({ kind: 'incomplete', missing: ['cat'] });
  });
});

describe('validateRow activities', () => {
  it('requires an item for save', () => {
    expect(validateRow({ ...blank, activity: 'save', acct: 'Cash', amount: '1000' }, cats)).toEqual({ kind: 'incomplete', missing: ['item'] });
  });
  it('builds a transfer body into acct out of item with no category', () => {
    const r = validateRow({ ...blank, activity: 'transfer', acct: 'Cash Wallet', item: 'SCB Current', amount: '500' }, cats);
    expect(r).toMatchObject({ kind: 'ready', body: { activity: 'transfer', amount: 500, cat: '', acct: 'Cash Wallet', item: 'SCB Current' } });
  });
  it('flags a transfer to the same account on the item field', () => {
    expect(validateRow({ ...blank, activity: 'transfer', acct: 'Cash', item: 'cash', amount: '5' }, cats)).toEqual({ kind: 'incomplete', missing: ['item'] });
  });
  it('flags interest outside a debt payment and a saving category on pay', () => {
    expect(validateRow({ ...blank, cat: 'food', acct: 'Cash', amount: '5', interest: '1' }, cats)).toEqual({ kind: 'incomplete', missing: ['interest'] });
    expect(validateRow({ ...blank, cat: 'saving', acct: 'Cash', amount: '5' }, cats)).toEqual({ kind: 'incomplete', missing: ['cat'] });
  });
});

describe('validateRow on rows loaded from the server', () => {
  it('lets a legacy save row without an item count as ready when asked not to require one', () => {
    const d = { ...blank, activity: 'save' as const, acct: 'Cash', amount: '5000' };
    expect(validateRow(d, cats)).toEqual({ kind: 'incomplete', missing: ['item'] });
    expect(validateRow(d, cats, { requireItem: false })).toMatchObject({ kind: 'ready', body: { amount: -5000, activity: 'save', item: '' } });
  });
});

describe('parseThaiOrIsoDate', () => {
  it('reads Thai CE/BE and ISO dates', () => {
    expect(parseThaiOrIsoDate('1 ม.ค. 2026')).toBe('2026-01-01');
    expect(parseThaiOrIsoDate('31 ธ.ค. 2569')).toBe('2026-12-31');
    expect(parseThaiOrIsoDate('2026-02-28')).toBe('2026-02-28');
  });
  it('rejects impossible dates', () => {
    expect(parseThaiOrIsoDate('2026-02-30')).toBeNull();
    expect(parseThaiOrIsoDate('31 พ.ย. 2026')).toBeNull();
    expect(parseThaiOrIsoDate('soon')).toBeNull();
  });
});

describe('parsePaste', () => {
  const defaults = { date: '2026-01-05', acct: 'Cash' };
  it('parses sheet-ordered rows, skipping blank lines', () => {
    const text = '1 ม.ค. 2026\tรับเงิน\tincome\tKasikorn Savings\t100\t\t\t\tย่าให้\n\n2 ม.ค. 2026\tชำระหนี้\tKbank Nano 3\tSCB Current\t550\t20\t5';
    const r = parsePaste(text, defaults, cats);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bodies).toHaveLength(2);
    expect(r.bodies[0]).toMatchObject({ date: '2026-01-01', amount: 100, cat: 'income', acct: 'Kasikorn Savings', note: 'ย่าให้', name: 'ย่าให้' });
    expect(r.bodies[1]).toMatchObject({ date: '2026-01-02', amount: -550, interest: 20, fee: 5, activity: 'pay_debt', item: 'Kbank Nano 3', cat: 'debt', name: 'Debt payment' });
  });
  it('accepts category label or Thai name and falls back to defaults', () => {
    const r = parsePaste('\tจ่ายเงิน\tอาหาร\t\t90', defaults, cats);
    expect(r).toMatchObject({ ok: true, bodies: [{ date: '2026-01-05', acct: 'Cash', cat: 'food', amount: -90 }] });
  });
  it('rejects the whole paste, naming the bad line', () => {
    const text = '2026-01-01\tจ่ายเงิน\tfood\tCash\t10\n2026-01-02\tจ่ายเงิน\tfood\tCash\tx';
    expect(parsePaste(text, defaults, cats)).toMatchObject({ ok: false, line: 2 });
    expect(parsePaste('2026-01-01\tจ่ายเงิน\tzzz\tCash\t10', defaults, cats)).toMatchObject({ ok: false, line: 1 });
  });
});

describe('parsePaste rules match the grid', () => {
  const defaults = { date: '2026-01-05', acct: 'Cash' };
  it('rejects an activity that conflicts with the category type', () => {
    expect(parsePaste('2026-01-02\tรับเงิน\tfood\tCash\t500', defaults, cats)).toMatchObject({ ok: false, line: 1 });
    expect(parsePaste('2026-01-02\tจ่ายเงิน\tincome\tCash\t500', defaults, cats)).toMatchObject({ ok: false, line: 1 });
  });
  it('rejects interest/fee outside debt categories and goal outside saving', () => {
    expect(parsePaste('2026-01-02\tจ่ายเงิน\tfood\tCash\t500\t120\t30', defaults, cats)).toMatchObject({ ok: false, line: 1 });
    expect(parsePaste('2026-01-02\tจ่ายเงิน\tfood\tCash\t500\t\t\tCar', defaults, cats)).toMatchObject({ ok: false, line: 1 });
    expect(parsePaste('2026-01-02\tสะสมเงิน\tGold savings\tCash\t500\t\t\tCar', defaults, cats)).toMatchObject({ ok: true });
  });
});

describe('parsePaste activities', () => {
  const defaults = { date: '2026-01-05', acct: 'Cash' };
  it('reads a Thai save row whose third column is the item', () => {
    const r = parsePaste('2026-06-01\tสะสมเงิน\tGold savings\tSCB Current\t1000', defaults, cats);
    expect(r).toMatchObject({ ok: true, bodies: [{ activity: 'save', item: 'Gold savings', amount: -1000, cat: 'saving', acct: 'SCB Current' }] });
  });
  it('does not turn a blank activity with a non-category item into a pay', () => {
    expect(parsePaste('2026-06-01\t\tGold savings\tSCB Current\t1000', defaults, cats)).toEqual({ ok: false, line: 1, error: 'unknown activity' });
  });
  it('rejects interest on a pay row naming the broken rule', () => {
    expect(parsePaste('2026-06-01\tจ่ายเงิน\tfood\tSCB Current\t50\t5', defaults, cats)).toEqual({ ok: false, line: 1, error: 'interestOnlyOnDebt' });
  });
  it('rejects a saving category on pay and a transfer to itself', () => {
    expect(parsePaste('2026-06-01\tจ่ายเงิน\tsaving\tCash\t5', defaults, cats)).toMatchObject({ ok: false, line: 1 });
    expect(parsePaste('2026-06-01\tเปลี่ยนบัญชี\tCash\tcash\t5', defaults, cats)).toEqual({ ok: false, line: 1, error: 'transferToSelf' });
  });
});

describe('monthRange', () => {
  it('spans the first to last day, including December', () => {
    expect(monthRange('2026-01')).toEqual({ from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-01-31T00:00:00Z') });
    expect(monthRange('2026-02')?.to.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(monthRange('2026-12')?.to.toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });
  it('rejects malformed months', () => {
    expect(monthRange('2026-13')).toBeNull();
    expect(monthRange('2026-1')).toBeNull();
  });
});

describe('summarize / columnTotals', () => {
  const rows = [
    { activity: 'receive', cat: 'income', amount: 1000, interest: 0, fee: 0 },
    { activity: 'pay', cat: 'food', amount: -100, interest: 0, fee: 0 },
    { activity: 'pay', cat: 'shopping', amount: -50, interest: 0, fee: 0 },
    { activity: 'save', cat: 'saving', amount: -200, interest: 0, fee: 0 },
    { activity: 'pay_debt', cat: 'debt', amount: -300, interest: 20, fee: 5 },
    { activity: 'pay', cat: 'mystery', amount: -7, interest: 0, fee: 0 },
    { activity: 'transfer', cat: '', amount: 500, interest: 0, fee: 0 },
    { activity: 'withdraw', cat: '', amount: 300, interest: 0, fee: 0 },
  ] as const;
  it('buckets by category sub, unknown counts as other spending', () => {
    expect(summarize([...rows], cats)).toEqual({ income: 1000, saving: 200, need: 100, want: 57, debt: 300 });
  });
  it('totals income and expense separately', () => {
    expect(columnTotals([...rows])).toEqual({ income: 1000, expense: 657, interest: 20, fee: 5 });
  });
});

describe('shiftMonth', () => {
  it('rolls over year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-06', 0)).toBe('2026-06');
  });
});

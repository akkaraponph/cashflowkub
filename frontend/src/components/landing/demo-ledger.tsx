'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { fmt, signed } from '@/lib/format';
import { fill } from '@/lib/i18n';

const STORAGE_KEY = 'cashflowkub:landing-demo:v1';
const STORAGE_EVENT = 'cashflowkub:landing-demo:change';

type DemoTransaction = {
  id: string;
  date: string;
  name: string;
  category: string;
  amount: number;
};

const SAMPLE_TRANSACTIONS: DemoTransaction[] = [
  { id: 'salary', date: '2026-10-01', name: 'Monthly salary', category: 'Income', amount: 62000 },
  { id: 'rent', date: '2026-10-03', name: 'Apartment rent', category: 'Housing', amount: -12000 },
  { id: 'market', date: '2026-10-05', name: 'Fresh market', category: 'Groceries', amount: -1860 },
  { id: 'electricity', date: '2026-10-08', name: 'Electricity', category: 'Utilities', amount: -1420 },
  { id: 'freelance', date: '2026-10-12', name: 'Design project', category: 'Income', amount: 4500 },
  { id: 'transit', date: '2026-10-15', name: 'Train and bus', category: 'Transport', amount: -680 },
  { id: 'saving', date: '2026-10-18', name: 'Emergency fund', category: 'Savings', amount: -5000 },
];

function isDemoTransactions(value: unknown): value is DemoTransaction[] {
  return Array.isArray(value) && value.every((row) =>
    row !== null && typeof row === 'object'
    && typeof row.id === 'string' && typeof row.date === 'string'
    && typeof row.name === 'string' && typeof row.category === 'string'
    && typeof row.amount === 'number' && Number.isFinite(row.amount));
}

function sampleCopy(): DemoTransaction[] {
  return SAMPLE_TRANSACTIONS.map((row) => ({ ...row }));
}

function subscribeToDemo(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(STORAGE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(STORAGE_EVENT, listener);
  };
}

function getStoredDemo(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseStoredDemo(value: string | null): DemoTransaction[] | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isDemoTransactions(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function DemoLedger() {
  const { ui, lang } = useI18n();
  const t = ui.landing;
  const storedDemo = useSyncExternalStore(subscribeToDemo, getStoredDemo, () => null);
  const [fallbackTransactions, setFallbackTransactions] = useState<DemoTransaction[] | null>(null);
  const transactions = useMemo(() => fallbackTransactions ?? parseStoredDemo(storedDemo) ?? sampleCopy(), [fallbackTransactions, storedDemo]);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'expense' | 'income'>('expense');

  const saveTransactions = (next: DemoTransaction[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setFallbackTransactions(null);
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      // Keep edits in memory if browser storage is unavailable.
      setFallbackTransactions(next);
    }
  };

  const totals = useMemo(() => transactions.reduce((result, transaction) => {
    if (transaction.amount > 0) result.income += transaction.amount;
    else result.spending += Math.abs(transaction.amount);
    result.net += transaction.amount;
    return result;
  }, { income: 0, spending: 0, net: 0 }), [transactions]);

  const update = (id: string, patch: Partial<Pick<DemoTransaction, 'name' | 'amount'>>) => {
    saveTransactions(transactions.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const addTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(newAmount);
    const name = newName.trim();
    if (!name || !Number.isFinite(amount) || amount <= 0) return;
    const signedAmount = newType === 'income' ? amount : -amount;
    saveTransactions([{
      id: `demo-${Date.now()}`,
      date: '2026-10-24',
      name,
      category: newType === 'income' ? 'Income' : 'Other',
      amount: signedAmount,
    }, ...transactions]);
    setNewName('');
    setNewAmount('');
  };

  return (
    <section id="demo" aria-labelledby="demo-title" className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <span className="size-2 rounded-full bg-primary" />{t.sample}
          </div>
          <h2 id="demo-title" className="text-lg font-bold">{t.demoTitle}</h2>
          <p className="text-xs text-muted-foreground">{t.demoMonth}</p>
        </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => saveTransactions(sampleCopy())}>
          <Icon name="history" size={14} />{t.reset}
        </Button>
      </div>

      <div className="grid grid-cols-3 divide-x border-b">
        <div className="px-3 py-3 sm:px-5">
          <p className="text-[11px] text-muted-foreground">{t.income}</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-type-xls-fg">{fmt(totals.income)}</p>
        </div>
        <div className="px-3 py-3 sm:px-5">
          <p className="text-[11px] text-muted-foreground">{t.spending}</p>
          <p className="mt-1 text-sm font-bold tabular-nums">{fmt(totals.spending)}</p>
        </div>
        <div className="px-3 py-3 sm:px-5">
          <p className="text-[11px] text-muted-foreground">{t.remaining}</p>
          <p className={`mt-1 text-sm font-bold tabular-nums ${totals.net < 0 ? 'text-destructive' : 'text-primary'}`}>{signed(totals.net)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
        <h3 className="text-sm font-semibold">{t.recent}</h3>
        <span aria-live="polite" className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Icon name="shield-check" size={13} />{t.saved}
        </span>
      </div>

      <div className="max-h-[22rem] overflow-y-auto px-3 sm:px-5">
        {transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
        ) : transactions.map((row) => (
          <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_112px_30px] items-center gap-2 border-t py-2.5 sm:grid-cols-[minmax(0,1fr)_128px_34px] sm:gap-3">
            <div className="min-w-0">
              <label className="sr-only" htmlFor={`demo-name-${row.id}`}>{`${t.name}: ${row.name}`}</label>
              <input
                id={`demo-name-${row.id}`}
                value={row.name}
                onChange={(event) => update(row.id, { name: event.target.value })}
                className="w-full min-w-0 bg-transparent text-sm font-medium outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="truncate text-[11px] text-muted-foreground">{row.category} · {row.date.slice(8, 10)} {lang === 'th' ? 'ต.ค.' : 'Oct'}</p>
            </div>
            <div className="sm:col-auto">
              <label className="sr-only" htmlFor={`demo-amount-${row.id}`}>{`${t.amount}: ${row.name}`}</label>
              <div className="flex items-center justify-end gap-0.5">
                <span className={`shrink-0 whitespace-nowrap text-xs font-medium ${row.amount < 0 ? 'text-muted-foreground' : 'text-type-xls-fg'}`}>{row.amount < 0 ? '−' : '+'}฿</span>
                <input
                  id={`demo-amount-${row.id}`}
                  type="number"
                  min="0"
                  step="1"
                  value={Math.abs(row.amount)}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    update(row.id, { amount: Number.isFinite(value) ? (row.amount < 0 ? -Math.abs(value) : Math.abs(value)) : 0 });
                  }}
                  className={`w-20 bg-transparent text-right text-xs font-semibold tabular-nums outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring ${row.amount < 0 ? '' : 'text-type-xls-fg'}`}
                />
              </div>
            </div>
            <button type="button" aria-label={fill(t.delete, { name: row.name || t.name })} onClick={() => saveTransactions(transactions.filter((item) => item.id !== row.id))} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Icon name="trash-2" size={15} />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={addTransaction} className="grid gap-2 border-t bg-secondary/50 p-3 sm:grid-cols-[minmax(0,1fr)_112px_112px_auto] sm:p-4">
        <label className="sr-only" htmlFor="demo-new-name">{t.addName}</label>
        <input id="demo-new-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={t.addName} required maxLength={80} className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <label className="sr-only" htmlFor="demo-new-type">{t.addType}</label>
        <select id="demo-new-type" value={newType} onChange={(event) => setNewType(event.target.value as 'expense' | 'income')} className="h-9 rounded-lg border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="expense">{t.expense}</option>
          <option value="income">{t.incomeType}</option>
        </select>
        <label className="sr-only" htmlFor="demo-new-amount">{t.addAmount}</label>
        <input id="demo-new-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} placeholder={t.addAmount} required className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <Button type="submit" size="sm" className="h-9"><Icon name="plus" size={14} />{t.add}</Button>
      </form>
      <p className="px-4 pb-4 pt-2 text-[11px] leading-relaxed text-muted-foreground sm:px-5">{t.demoNote}</p>
    </section>
  );
}

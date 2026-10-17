'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Account, Category } from '@/generated/prisma/client';
import { Icon } from '@/components/cfk/icon';
import { TxSummary } from '@/components/cfk/tx-summary';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import { fmt } from '@/lib/format';
import { fill, localized } from '@/lib/i18n';
import {
  columnTotals, draftFromView, parsePaste, summarize, validateRow, type Activity, type RowDraft, type TxBody,
} from '@/lib/tx-sheet';
import { cn } from '@/lib/utils';
import type { TxView } from '@/server/transaction/logic';

let rowSeq = 0;
const PAD = 20;
const CELL = 'h-7 w-full bg-transparent px-1.5 text-xs outline-none focus:ring-1 focus:ring-inset focus:ring-primary';

interface Row {
  key: string;
  draft: RowDraft;
  /** Last persisted body; null until the row has been saved. */
  body: TxBody | null;
  /** Draft values as last persisted, for Esc-to-revert. */
  snap: RowDraft | null;
  incomplete: boolean;
}

type EditableField = Exclude<keyof RowDraft, 'id' | 'name'>;

export function TxSheet({ rows: initialRows, categories, accounts, goals, defaultDate }: {
  rows: TxView[];
  categories: Category[];
  accounts: Account[];
  goals: { name: string }[];
  defaultDate: string;
}) {
  const { ui, lang } = useI18n();
  const s = ui.sheet;
  const catByKey = new Map(categories.map((c) => [c.key, c]));
  const inflight = useRef(new Map<string, Promise<void>>());
  const tableRef = useRef<HTMLTableElement>(null);

  const blankDraft = (): RowDraft => ({ date: defaultDate, activity: 'expense', cat: '', acct: '', amount: '', interest: '', fee: '', goal: '', note: '', name: '' });
  const makeRow = (draft: RowDraft, body: TxBody | null = null, snap: RowDraft | null = null): Row => ({ key: `r${rowSeq++}`, draft, body, snap, incomplete: false });
  const isBlank = (r: Row) => r.draft.id === undefined && validateRow(r.draft, categories).kind === 'empty';
  const withPad = (list: Row[]): Row[] => {
    let trailing = 0;
    for (let i = list.length - 1; i >= 0 && isBlank(list[i]); i--) trailing++;
    return [...list, ...Array.from({ length: Math.max(0, PAD - trailing) }, () => makeRow(blankDraft()))];
  };

  const [rows, setRowsState] = useState<Row[]>(() => withPad(initialRows.map((t) => {
    const draft = draftFromView(t);
    const check = validateRow(draft, categories);
    return makeRow(draft, check.kind === 'ready' ? check.body : null, draft);
  })));
  const rowsRef = useRef(rows);
  const setRows = (fn: (r: Row[]) => Row[]) => {
    const next = fn(rowsRef.current);
    rowsRef.current = next;
    setRowsState(next);
  };
  const patchRow = (key: string, fn: (r: Row) => Row) => setRows((list) => withPad(list.map((r) => (r.key === key ? fn(r) : r))));

  const edit = (key: string, patch: Partial<RowDraft>) => patchRow(key, (r) => ({ ...r, draft: { ...r.draft, ...patch } }));

  const onActivity = (row: Row, activity: Activity) => {
    const cat = catByKey.get(row.draft.cat);
    const mismatch = cat !== undefined && cat.type !== activity;
    edit(row.key, mismatch ? { activity, cat: '', interest: '', fee: '', goal: '', name: '' } : { activity });
  };

  const onCat = (row: Row, key: string) => {
    const d = row.draft;
    const sub = catByKey.get(key)?.sub;
    const auto = d.name === '' || d.name === catByKey.get(d.cat)?.label;
    edit(row.key, {
      cat: key, name: auto ? '' : d.name,
      interest: sub === 'debt' ? d.interest : '', fee: sub === 'debt' ? d.fee : '', goal: sub === 'saving' ? d.goal : '',
    });
  };

  const run = async (key: string) => {
    const row = rowsRef.current.find((r) => r.key === key);
    if (!row) return;
    const check = validateRow(row.draft, categories);
    if (check.kind !== 'ready') {
      patchRow(key, (r) => ({ ...r, incomplete: check.kind === 'incomplete' }));
      return;
    }
    if (row.draft.id !== undefined && JSON.stringify(row.body) === JSON.stringify(check.body)) {
      patchRow(key, (r) => ({ ...r, incomplete: false }));
      return;
    }
    try {
      const view = row.draft.id === undefined
        ? await apiFetch<TxView>('/transactions', { method: 'POST', body: check.body })
        : await apiFetch<TxView>(`/transactions/${row.draft.id}`, { method: 'PATCH', body: check.body });
      patchRow(key, (r) => ({ ...r, draft: { ...r.draft, id: view.id, name: r.draft.name || view.name }, body: check.body, snap: draftFromView(view), incomplete: false }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  // Saves for one row run strictly in sequence, so a second blur during a POST becomes a PATCH, never a second create.
  const commit = (key: string) => {
    const next = (inflight.current.get(key) ?? Promise.resolve()).then(() => run(key)).finally(() => {
      if (inflight.current.get(key) === next) inflight.current.delete(key);
    });
    inflight.current.set(key, next);
  };

  const remove = async (key: string) => {
    await inflight.current.get(key);
    const row = rowsRef.current.find((r) => r.key === key);
    if (!row) return;
    try {
      if (row.draft.id !== undefined) await apiFetch(`/transactions/${row.draft.id}`, { method: 'DELETE' });
      setRows((list) => withPad(list.filter((r) => r.key !== key)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const onPaste = async (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/[\r\n]+$/, '');
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const parsed = parsePaste(text, { date: defaultDate, acct: accounts[0]?.name ?? '' }, categories);
    if (!parsed.ok) {
      toast.error(fill(s.pasteError, { line: parsed.line, error: parsed.error }));
      return;
    }
    try {
      const { data } = await apiFetch<{ data: TxView[] }>('/transactions/batch', { method: 'POST', body: { items: parsed.bodies } });
      const added = data.map((t, i) => makeRow(draftFromView(t), parsed.bodies[i], draftFromView(t)));
      setRows((list) => withPad([...list.filter((r) => !isBlank(r)), ...added]));
      toast.success(fill(s.pasted, { n: data.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const focusCell = (r: number, f: string) => tableRef.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-f="${f}"]`)?.focus();

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    const f = t.dataset.f as EditableField | undefined;
    if (f === undefined) return;
    const r = Number(t.dataset.r);
    if (e.key === 'Escape') {
      const row = rowsRef.current[r];
      edit(row.key, { [f]: row.snap?.[f] ?? blankDraft()[f] });
      return;
    }
    const arrows = t.tagName === 'INPUT' && f !== 'date';
    const dr = e.key === 'Enter' || (arrows && e.key === 'ArrowDown') ? 1 : arrows && e.key === 'ArrowUp' ? -1 : 0;
    if (dr === 0 || r + dr < 0) return;
    e.preventDefault();
    focusCell(r + dr, f);
  };

  const saved = rows.flatMap((r) => (r.body ? [r.body] : []));
  const totals = columnTotals(saved);
  const catLabel = (c: Category) => localized(lang, c.label, c.th);
  const th = 'border border-border bg-secondary px-1.5 py-1 text-center text-[11px] font-semibold';

  return (
    <div className="hidden items-start gap-4 md:grid md:grid-cols-[13.5rem_minmax(0,1fr)]">
      <TxSummary totals={summarize(saved, categories)} />
      <div className="grid gap-1.5">
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table ref={tableRef} className="w-full min-w-[60rem] border-collapse text-xs" onPaste={onPaste} onKeyDown={onKeyDown}>
            <thead>
              <tr>
                <th rowSpan={2} className={cn(th, 'w-8')} />
                <th rowSpan={2} className={th}>{s.date}</th>
                <th rowSpan={2} className={th}>{s.activity}</th>
                <th rowSpan={2} className={th}>{s.category}</th>
                <th rowSpan={2} className={th}>{s.channel}</th>
                <th rowSpan={2} className={th}>{s.amount}</th>
                <th colSpan={2} className={th}>{s.debtCase}</th>
                <th className={th}>{s.savingCase}</th>
                <th rowSpan={2} className={th}>{s.note}</th>
              </tr>
              <tr>
                <th className={th}>{s.interest}</th>
                <th className={th}>{s.fee}</th>
                <th className={th}>{s.goal}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const d = row.draft;
                const sub = catByKey.get(d.cat)?.sub;
                const tone = d.amount === '' ? '' : d.activity === 'income' ? 'text-type-xls-fg' : 'text-destructive';
                const cats = categories.filter((c) => c.type === d.activity || c.key === d.cat);
                const accts = accounts.some((a) => a.name === d.acct) || d.acct === '' ? accounts.map((a) => a.name) : [d.acct, ...accounts.map((a) => a.name)];
                const goalNames = goals.some((g) => g.name === d.goal) || d.goal === '' ? goals.map((g) => g.name) : [d.goal, ...goals.map((g) => g.name)];
                const ctl = (f: EditableField) => ({ 'data-r': i, 'data-f': f });
                return (
                  <tr
                    key={row.key}
                    className="group border-t"
                    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit(row.key); }}
                  >
                    <td
                      className={cn('w-8 border-l-2 border-r bg-muted text-center text-[10px] text-muted-foreground', row.incomplete ? 'border-l-amber-500' : 'border-l-transparent')}
                      title={row.incomplete ? s.incomplete : undefined}
                    >
                      {isBlank(row) ? i + 1 : (
                        <>
                          <span className="group-hover:hidden">{i + 1}</span>
                          <button type="button" className="hidden size-6 items-center justify-center group-hover:inline-flex" aria-label={s.deleteRow} onClick={() => void remove(row.key)}>
                            <Icon name="trash-2" size={13} />
                          </button>
                        </>
                      )}
                    </td>
                    <td className="w-28 border-r p-0"><input {...ctl('date')} type="date" className={CELL} value={d.date} onChange={(e) => edit(row.key, { date: e.target.value })} /></td>
                    <td className="w-24 border-r p-0">
                      <select {...ctl('activity')} className={cn(CELL, tone)} value={d.activity} onChange={(e) => onActivity(row, e.target.value as Activity)}>
                        <option value="income">{s.incomeAct}</option>
                        <option value="expense">{s.expenseAct}</option>
                      </select>
                    </td>
                    <td className="w-40 border-r p-0">
                      <select {...ctl('cat')} className={CELL} value={d.cat} onChange={(e) => onCat(row, e.target.value)}>
                        <option value="" />
                        {cats.map((c) => <option key={c.key} value={c.key}>{catLabel(c)}</option>)}
                      </select>
                    </td>
                    <td className="w-40 border-r p-0">
                      <select {...ctl('acct')} className={CELL} value={d.acct} onChange={(e) => edit(row.key, { acct: e.target.value })}>
                        <option value="" />
                        {accts.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>
                    <td className="w-28 border-r p-0">
                      <input {...ctl('amount')} inputMode="decimal" className={cn(CELL, 'text-right tabular-nums', tone)} value={d.amount} onChange={(e) => edit(row.key, { amount: e.target.value })} />
                    </td>
                    {sub === 'debt' ? (
                      <>
                        <td className="w-24 border-r p-0"><input {...ctl('interest')} inputMode="decimal" className={cn(CELL, 'text-right tabular-nums')} value={d.interest} onChange={(e) => edit(row.key, { interest: e.target.value })} /></td>
                        <td className="w-24 border-r p-0"><input {...ctl('fee')} inputMode="decimal" className={cn(CELL, 'text-right tabular-nums')} value={d.fee} onChange={(e) => edit(row.key, { fee: e.target.value })} /></td>
                      </>
                    ) : <td colSpan={2} className="border-r bg-muted" />}
                    {sub === 'saving' ? (
                      <td className="w-36 border-r p-0">
                        <select {...ctl('goal')} className={CELL} value={d.goal} onChange={(e) => edit(row.key, { goal: e.target.value })}>
                          <option value="" />
                          {goalNames.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </td>
                    ) : <td className="border-r bg-muted" />}
                    <td className="min-w-40 p-0"><input {...ctl('note')} className={CELL} value={d.note} onChange={(e) => edit(row.key, { note: e.target.value })} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-secondary font-semibold">
                <td colSpan={5} className="px-2 py-1 text-right">{s.total}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  <div className="text-type-xls-fg">{fmt(totals.income)}</div>
                  <div className="text-destructive">{fmt(totals.expense)}</div>
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">{fmt(totals.interest)}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{fmt(totals.fee)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

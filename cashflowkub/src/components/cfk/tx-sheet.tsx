'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Account, Category } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/cfk/icon';
import { Select } from '@/components/ui/select';
import { TxSummary } from '@/components/cfk/tx-summary';
import { useI18n } from '@/components/i18n-provider';
import { ACTIVITIES, isInflow, itemListFor } from '@/lib/activity';
import { apiFetch } from '@/lib/api-client';
import { fmt } from '@/lib/format';
import { fill, localized } from '@/lib/i18n';
import {
  columnTotals, draftFromView, parsePaste, sanitizeAmountInput, summarize, validateRow, type Activity, type RowDraft, type TxBody,
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

export function TxSheet({ rows: initialRows, categories, accounts, goals, incomeItems, channels, debts, defaultDate, summaryCaption }: {
  rows: TxView[];
  categories: Category[];
  accounts: Account[];
  goals: { name: string }[];
  incomeItems: { name: string }[];
  channels: { name: string }[];
  debts: { name: string; done: boolean }[];
  defaultDate: string;
  summaryCaption?: string;
}) {
  const { ui, lang } = useI18n();
  const s = ui.sheet;
  const catByKey = new Map(categories.map((c) => [c.key, c]));
  const inflight = useRef(new Map<string, Promise<void>>());
  const tableRef = useRef<HTMLTableElement>(null);
  // While a dropdown is open focus lives in its portal; that must not count as leaving the row.
  const openMenus = useRef(0);
  const onMenu = (open: boolean) => { openMenus.current = Math.max(0, openMenus.current + (open ? 1 : -1)); };

  const blankDraft = (): RowDraft => ({ date: defaultDate, activity: 'pay', item: '', cat: '', acct: '', amount: '', interest: '', fee: '', goal: '', note: '', name: '' });
  const makeRow = (draft: RowDraft, body: TxBody | null = null, snap: RowDraft | null = null): Row => ({ key: `r${rowSeq++}`, draft, body, snap, incomplete: false });
  const isBlank = (r: Row) => r.draft.id === undefined && validateRow(r.draft, categories).kind === 'empty';
  const withPad = (list: Row[]): Row[] => {
    let trailing = 0;
    for (let i = list.length - 1; i >= 0 && isBlank(list[i]); i--) trailing++;
    return [...list, ...Array.from({ length: Math.max(0, PAD - trailing) }, () => makeRow(blankDraft()))];
  };

  const [rows, setRowsState] = useState<Row[]>(() => withPad(initialRows.map((t) => {
    const draft = draftFromView(t);
    const check = validateRow(draft, categories, { requireItem: false });
    return makeRow(draft, check.kind === 'ready' ? check.body : null, draft);
  })));
  const rowsRef = useRef(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const setRows = (fn: (r: Row[]) => Row[]) => {
    const next = fn(rowsRef.current);
    rowsRef.current = next;
    setRowsState(next);
    // Selection only ever holds keys of rows that still exist.
    setSelected((sel) => {
      if (sel.size === 0) return sel;
      const live = new Set(next.map((r) => r.key));
      const kept = [...sel].filter((k) => live.has(k));
      return kept.length === sel.size ? sel : new Set(kept);
    });
  };
  const patchRow = (key: string, fn: (r: Row) => Row) => setRows((list) => withPad(list.map((r) => (r.key === key ? fn(r) : r))));

  const edit = (key: string, patch: Partial<RowDraft>) => patchRow(key, (r) => ({ ...r, draft: { ...r.draft, ...patch } }));

  // Changing the activity changes what the category, item, debt and goal cells mean, so they start over.
  const onActivity = (row: Row, activity: Activity) => {
    if (activity === row.draft.activity) return;
    edit(row.key, { activity, cat: '', item: '', interest: '', fee: '', goal: '', name: '' });
  };

  const onCat = (row: Row, key: string) => {
    const d = row.draft;
    const auto = d.name === '' || d.name === catByKey.get(d.cat)?.label;
    edit(row.key, { cat: key, name: auto ? '' : d.name });
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

  const toggle = (key: string) => setSelected((sel) => {
    const next = new Set(sel);
    if (!next.delete(key)) next.add(key);
    return next;
  });

  const deleteSelected = async () => {
    const keys = [...selected];
    if (keys.length === 0 || !window.confirm(fill(s.deleteSelectedConfirm, { n: keys.length }))) return;
    setDeleting(true);
    try {
      // A row created by an in-flight POST only gets its id once that save settles.
      await Promise.all(keys.map((k) => inflight.current.get(k)));
      const targets = rowsRef.current.filter((r) => keys.includes(r.key) && r.draft.id !== undefined);
      const ids = targets.map((r) => r.draft.id as number);
      if (ids.length === 0) return;
      const { deleted } = await apiFetch<{ deleted: number }>('/transactions/batch', { method: 'DELETE', body: { ids } });
      const gone = new Set(targets.map((r) => r.key));
      setRows((list) => withPad(list.filter((r) => !gone.has(r.key))));
      toast.success(fill(s.deletedN, { n: deleted }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
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
    if (t.getAttribute('role') === 'combobox') return; // Enter/arrows belong to the dropdown
    const arrows = t.tagName === 'INPUT' && f !== 'date';
    const dr = e.key === 'Enter' || (arrows && e.key === 'ArrowDown') ? 1 : arrows && e.key === 'ArrowUp' ? -1 : 0;
    if (dr === 0 || r + dr < 0) return;
    e.preventDefault();
    focusCell(r + dr, f);
  };

  const savedKeys = rows.filter((r) => r.draft.id !== undefined).map((r) => r.key);
  const selectedSaved = savedKeys.filter((k) => selected.has(k)).length;
  const allSelected = savedKeys.length > 0 && selectedSaved === savedKeys.length;
  const headBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headBox.current) headBox.current.indeterminate = selectedSaved > 0 && !allSelected;
  }, [selectedSaved, allSelected]);

  const saved = rows.flatMap((r) => (r.body ? [r.body] : []));
  const totals = columnTotals(saved);
  const catLabel = (c: Category) => localized(lang, c.label, c.th);
  const th = 'border border-border bg-secondary px-1.5 py-1 text-center text-[11px] font-semibold';

  return (
    <div className="hidden items-start gap-4 md:grid md:grid-cols-[13.5rem_minmax(0,1fr)]">
      <TxSummary totals={summarize(saved, categories)} caption={summaryCaption} />
      <div className="grid gap-1.5">
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-1.5 text-xs ring-1 ring-foreground/10">
            <span className="font-medium">{fill(s.selectedN, { n: selected.size })}</span>
            <Button type="button" variant="destructive" size="sm" disabled={deleting} onClick={() => void deleteSelected()}>
              <Icon name="trash-2" size={13} />{s.deleteSelected}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={deleting} onClick={() => setSelected(new Set())}>{s.clearSelection}</Button>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table ref={tableRef} className="w-full min-w-[72rem] border-collapse text-xs" onPaste={onPaste} onKeyDown={onKeyDown}>
            <thead>
              <tr>
                <th rowSpan={2} className={cn(th, 'w-8')}>
                  <input ref={headBox} type="checkbox" aria-label={s.selectAll} disabled={savedKeys.length === 0} checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(savedKeys))} />
                </th>
                <th rowSpan={2} className={cn(th, 'w-8')} />
                <th rowSpan={2} className={th}>{s.date}</th>
                <th rowSpan={2} className={th}>{s.activity}</th>
                <th rowSpan={2} className={th}>{s.category}</th>
                <th rowSpan={2} className={th}>{s.item}</th>
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
                const tone = d.amount === '' ? '' : isInflow(d.activity) ? 'text-type-xls-fg' : 'text-destructive';
                const cats = categories.filter((c) => (c.type === 'expense' && c.sub !== 'saving' && c.sub !== 'debt') || c.key === d.cat);
                const list = itemListFor(d.activity);
                const names = list === 'income' ? incomeItems.map((x) => x.name)
                  : list === 'channel' ? channels.map((x) => x.name)
                  : list === 'debt' ? debts.filter((x) => !x.done).map((x) => x.name)
                  : list === 'account' ? accounts.map((x) => x.name).filter((n) => n !== d.acct)
                  : [];
                const items = d.item === '' || names.includes(d.item) ? names : [d.item, ...names];
                const accts = accounts.some((a) => a.name === d.acct) || d.acct === '' ? accounts.map((a) => a.name) : [d.acct, ...accounts.map((a) => a.name)];
                const goalNames = goals.some((g) => g.name === d.goal) || d.goal === '' ? goals.map((g) => g.name) : [d.goal, ...goals.map((g) => g.name)];
                const ctl = (f: EditableField) => ({ 'data-r': i, 'data-f': f });
                return (
                  <tr
                    key={row.key}
                    className={cn('group border-t', selected.has(row.key) && 'bg-primary/5')}
                    onBlur={(e) => { if (openMenus.current === 0 && !e.currentTarget.contains(e.relatedTarget as Node | null)) commit(row.key); }}
                  >
                    <td className="w-8 border-r text-center">
                      {d.id !== undefined && (
                        <input type="checkbox" aria-label={s.selectRow} checked={selected.has(row.key)} onChange={() => toggle(row.key)} />
                      )}
                    </td>
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
                      <Select {...ctl('activity')} variant="cell" className={tone} value={d.activity} onValueChange={(v) => onActivity(row, v as Activity)} onOpenChange={onMenu}
                        options={ACTIVITIES.map((a) => ({ value: a, label: s.activities[a] }))} />
                    </td>
                    {d.activity === 'pay' ? (
                      <td className="w-40 border-r p-0">
                        <Select {...ctl('cat')} variant="cell" value={d.cat} onValueChange={(v) => onCat(row, v)} onOpenChange={onMenu}
                          options={cats.map((c) => ({ value: c.key, label: catLabel(c) }))} />
                      </td>
                    ) : <td className="border-r bg-muted" />}
                    {list === null ? <td className="border-r bg-muted" /> : (
                      <td className="w-40 border-r p-0">
                        <Select {...ctl('item')} variant="cell" value={d.item} onValueChange={(v) => edit(row.key, { item: v })} onOpenChange={onMenu}
                          clearLabel={d.activity === 'receive' ? '—' : undefined} options={items.map((n) => ({ value: n, label: n }))} />
                      </td>
                    )}
                    <td className="w-40 border-r p-0">
                      <Select {...ctl('acct')} variant="cell" value={d.acct} onValueChange={(v) => edit(row.key, { acct: v })} onOpenChange={onMenu}
                        options={accts.map((a) => ({ value: a, label: a }))} />
                    </td>
                    <td className="w-28 border-r p-0">
                      <input {...ctl('amount')} inputMode="decimal" className={cn(CELL, 'text-right tabular-nums', tone)} value={d.amount} onChange={(e) => edit(row.key, { amount: sanitizeAmountInput(e.target.value) })} />
                    </td>
                    {d.activity === 'pay_debt' ? (
                      <>
                        <td className="w-24 border-r p-0"><input {...ctl('interest')} inputMode="decimal" className={cn(CELL, 'text-right tabular-nums')} value={d.interest} onChange={(e) => edit(row.key, { interest: sanitizeAmountInput(e.target.value) })} /></td>
                        <td className="w-24 border-r p-0"><input {...ctl('fee')} inputMode="decimal" className={cn(CELL, 'text-right tabular-nums')} value={d.fee} onChange={(e) => edit(row.key, { fee: sanitizeAmountInput(e.target.value) })} /></td>
                      </>
                    ) : <td colSpan={2} className="border-r bg-muted" />}
                    {d.activity === 'save' ? (
                      <td className="w-36 border-r p-0">
                        <Select {...ctl('goal')} variant="cell" value={d.goal} onValueChange={(v) => edit(row.key, { goal: v })} onOpenChange={onMenu} clearLabel="—"
                          options={goalNames.map((g) => ({ value: g, label: g }))} />
                      </td>
                    ) : <td className="border-r bg-muted" />}
                    <td className="min-w-40 p-0"><input {...ctl('note')} className={CELL} value={d.note} onChange={(e) => edit(row.key, { note: e.target.value })} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-secondary font-semibold">
                <td colSpan={7} className="px-2 py-1 text-right">{s.total}</td>
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

// Rules for renaming a category. Expense categories store `label`, income sources store `name`.
export type LabelKind = 'expense' | 'income';

export const labelPath: Record<LabelKind, string> = { expense: '/categories', income: '/income-categories' };

/** PATCH body for a rename, or null when the name is blank. Names are user content, so one value is stored for both languages. */
export function labelPatch(kind: LabelKind, name: string): { label: string; th: string } | { name: string; th: string } | null {
  const n = name.trim();
  if (n === '') return null;
  return kind === 'expense' ? { label: n, th: n } : { name: n, th: n };
}

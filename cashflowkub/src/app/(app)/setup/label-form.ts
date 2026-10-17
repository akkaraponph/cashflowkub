// Rules for renaming a category. Expense categories store `label`, income sources store `name`.
export type LabelKind = 'expense' | 'income';

export const labelPath: Record<LabelKind, string> = { expense: '/categories', income: '/income-categories' };

/** PATCH body for a rename, or null when the English name is blank. A blank Thai name is allowed (the UI falls back to English). */
export function labelPatch(kind: LabelKind, en: string, th: string): { label: string; th: string } | { name: string; th: string } | null {
  const english = en.trim();
  if (english === '') return null;
  return kind === 'expense' ? { label: english, th: th.trim() } : { name: english, th: th.trim() };
}

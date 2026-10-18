// Pure form model for the add/edit plan-item dialog.
import { localized, type Lang } from '@/lib/i18n';
import { parseMoney } from '@/lib/money-input';

export type PlanType = 'income' | 'expense' | 'savings';

export interface PlanItemForm {
  name: string;
  planned: string;
  actual: string;
}

export const emptyPlanForm: PlanItemForm = { name: '', planned: '', actual: '' };

/** The form for an existing item, showing the name as the user currently sees it. */
export function formFromPlanItem(i: { name: string; th: string; planned: number; actual: number }, lang: Lang): PlanItemForm {
  return { name: localized(lang, i.name, i.th), planned: String(i.planned), actual: String(i.actual) };
}

/**
 * POST / PATCH body, or null when the form is invalid (blank name, negative or unreadable amount; blank amounts are 0).
 * One name is stored for both languages. On edit (`original` given) type and month are never sent, and an unchanged
 * name is left out so the other language's name is not overwritten.
 */
export function planItemBody(f: PlanItemForm, ctx: { type: PlanType; month: string }, original?: PlanItemForm): Record<string, unknown> | null {
  const name = f.name.trim();
  const planned = parseMoney(f.planned, 0);
  const actual = parseMoney(f.actual, 0);
  if (name === '' || !(planned >= 0) || !(actual >= 0)) return null;
  if (!original) return { type: ctx.type, month: ctx.month, name, th: name, planned, actual };
  const unchanged = name === original.name.trim();
  return { ...(unchanged ? {} : { name, th: name }), planned, actual };
}

// Pure form model for the add/edit goal dialog.
import { localized, type Lang } from '@/lib/i18n';
import { parseMoney } from '@/lib/money-input';

export const GOAL_ICONS = ['target', 'shield', 'plane', 'house', 'car', 'smartphone', 'graduation-cap', 'gift', 'heart-pulse', 'piggy-bank'] as const;

export interface GoalForm {
  name: string;
  icon: string;
  target: string;
  saved: string;
  monthly: string;
  by: string;
}

export const emptyGoalForm: GoalForm = { name: '', icon: 'target', target: '', saved: '0', monthly: '0', by: '' };

/** The form for an existing goal, showing the name as the user currently sees it. */
export function formFromGoal(g: { name: string; th: string; icon: string; target: number; saved: number; monthly: number; by: string }, lang: Lang): GoalForm {
  return { name: localized(lang, g.name, g.th), icon: g.icon, target: String(g.target), saved: String(g.saved), monthly: String(g.monthly), by: g.by };
}

/**
 * POST / PATCH body, or null when the form is invalid (blank name, target not above 0, negative or unreadable saved/monthly).
 * One name is stored for both languages. On edit (`original` given) an unchanged name is left out so the other language's name
 * and the transactions tagged with the goal are not touched.
 */
export function goalBody(f: GoalForm, original?: GoalForm): Record<string, unknown> | null {
  const name = f.name.trim();
  const target = parseMoney(f.target, NaN);
  const saved = parseMoney(f.saved, 0);
  const monthly = parseMoney(f.monthly, 0);
  if (name === '' || !(target > 0) || !(saved >= 0) || !(monthly >= 0)) return null;
  const unchanged = original !== undefined && name === original.name.trim();
  return { ...(unchanged ? {} : { name, th: name }), icon: f.icon, target, saved, monthly, by: f.by.trim() };
}

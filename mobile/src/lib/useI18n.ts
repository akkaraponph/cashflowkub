import { DICT } from './i18n';
import { usePrefs } from './store';

/** Returns the active language dictionary plus the current lang code. */
export function useI18n() {
  const lang = usePrefs((s) => s.lang);
  return { ui: DICT[lang], lang };
}

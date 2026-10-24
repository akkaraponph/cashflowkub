import { cookies } from 'next/headers';
import { DICT, type Dict, type Lang } from '@/lib/i18n';
import { LANG_COOKIE, resolveLang, resolveYear, YEAR_COOKIE } from '@/lib/prefs';

export async function getPrefs(): Promise<{ lang: Lang; year: number }> {
  const jar = await cookies();
  return { lang: resolveLang(jar.get(LANG_COOKIE)?.value), year: resolveYear(jar.get(YEAR_COOKIE)?.value) };
}

export async function getI18n(): Promise<{ lang: Lang; ui: Dict }> {
  const { lang } = await getPrefs();
  return { lang, ui: DICT[lang] };
}

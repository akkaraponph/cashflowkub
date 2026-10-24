'use client';

import { createContext, useContext } from 'react';
import { DICT, type Dict, type Lang } from '@/lib/i18n';

const I18nContext = createContext<{ lang: Lang; ui: Dict } | null>(null);

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ lang, ui: DICT[lang] }}>{children}</I18nContext.Provider>;
}

export function useI18n(): { lang: Lang; ui: Dict } {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

/** Like useI18n, but null outside a provider (for shared UI that must still render). */
export function useOptionalI18n(): { lang: Lang; ui: Dict } | null {
  return useContext(I18nContext);
}

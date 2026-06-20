// Global app preferences: language, theme mode, and the financial-year scope.
// Persisted to AsyncStorage so choices survive restarts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Lang } from './i18n';

export type ThemeMode = 'light' | 'dark';

interface PrefsState {
  lang: Lang;
  theme: ThemeMode;
  year: number;
  hydrated: boolean;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setYear: (y: number) => void;
}

export const YEARS = [2024, 2025, 2026, 2027, 2028];
export const CURRENT_YEAR = 2026;

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      lang: 'en',
      theme: 'light',
      year: CURRENT_YEAR,
      hydrated: false,
      setLang: (lang) => set({ lang }),
      toggleLang: () => set((s) => ({ lang: s.lang === 'en' ? 'th' : 'en' })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setYear: (year) => set({ year }),
    }),
    {
      name: 'cfk-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ lang: s.lang, theme: s.theme, year: s.year }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

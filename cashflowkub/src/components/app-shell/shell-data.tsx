'use client';

import { createContext, useContext } from 'react';
import type { Account, Category } from '@/generated/prisma/client';

interface ShellData {
  categories: Category[];
  accounts: Account[];
}

const ShellDataContext = createContext<ShellData | null>(null);

/** Reference data the global "add transaction" dialog needs, provided once by the app layout. */
export function ShellDataProvider({ categories, accounts, children }: ShellData & { children: React.ReactNode }) {
  return <ShellDataContext.Provider value={{ categories, accounts }}>{children}</ShellDataContext.Provider>;
}

export function useShellData(): ShellData {
  const value = useContext(ShellDataContext);
  if (!value) throw new Error('useShellData must be used inside <ShellDataProvider>');
  return value;
}

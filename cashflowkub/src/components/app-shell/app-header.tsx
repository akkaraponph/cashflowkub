import type { Account, Category } from '@/generated/prisma/client';
import { AddTransactionDialog } from './add-transaction-dialog';
import { MobileNav } from './app-nav';
import { LangToggle, ThemeToggle, YearStepper } from './pref-controls';

export function AppHeader({ year, categories, accounts }: { year: number; categories: Category[]; accounts: Account[] }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur">
      <MobileNav />
      <div className="flex-1" />
      <YearStepper year={year} />
      <LangToggle />
      <ThemeToggle />
      <AddTransactionDialog categories={categories} accounts={accounts} />
    </header>
  );
}

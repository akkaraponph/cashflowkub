import Link from 'next/link';
import { MobileNav } from './app-nav';
import { LangToggle, ThemeToggle, YearStepper } from './pref-controls';

export function AppHeader({ year, userName }: { year: number; userName: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur">
      <MobileNav />
      <div className="flex-1" />
      <YearStepper year={year} />
      <LangToggle />
      <ThemeToggle />
      <Link href="/settings" aria-label={userName} title={userName} className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-bold hover:opacity-80">
        {[...userName.trim()][0]?.toUpperCase() ?? '?'}
      </Link>
    </header>
  );
}

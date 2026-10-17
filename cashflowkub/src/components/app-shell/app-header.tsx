import { MobileNav } from './app-nav';
import { LangToggle, ThemeToggle, YearStepper } from './pref-controls';

export function AppHeader({ year }: { year: number }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur">
      <MobileNav />
      <div className="flex-1" />
      <YearStepper year={year} />
      <LangToggle />
      <ThemeToggle />
    </header>
  );
}

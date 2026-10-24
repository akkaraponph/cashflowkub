'use client';

import Link from 'next/link';
import { DemoLedger } from '@/components/landing/demo-ledger';
import { LogoMark } from '@/components/cfk/logo';
import { LangToggle, ThemeToggle } from '@/components/app-shell/pref-controls';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n-provider';

export function LandingHome() {
  const { ui } = useI18n();
  const t = ui.landing;

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <LogoMark size={34} />
          <span className="text-base font-bold">CashflowKub</span>
        </Link>
        <nav aria-label="Account" className="ml-auto flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
          <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground sm:inline-flex">{t.signIn}</Link>
          <Button asChild size="sm"><Link href="/signup">{t.headerSignup}</Link></Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 pb-12 pt-8 md:px-8 md:pb-16 md:pt-12 lg:grid-cols-[minmax(16rem,0.72fr)_minmax(0,1.28fr)] lg:gap-12">
          <div className="max-w-xl">
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-5xl lg:text-[3.6rem]">{t.title}</h1>
            <p className="mt-5 max-w-[42ch] text-base leading-7 text-muted-foreground sm:text-lg">{t.body}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg"><a href="#demo">{t.tryDemo}</a></Button>
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">{t.signIn}</Link>
            </div>
            <p className="mt-6 max-w-[38ch] text-xs leading-5 text-muted-foreground">{t.footer}</p>
          </div>
          <DemoLedger />
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t px-4 py-5 text-xs text-muted-foreground md:px-8">
        <span>CashflowKub</span>
        <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">{t.privacy}</Link>
      </footer>
    </div>
  );
}

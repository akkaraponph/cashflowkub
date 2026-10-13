import { AppSidebar } from '@/components/app-shell/app-nav';
import { AppHeader } from '@/components/app-shell/app-header';
import { I18nProvider } from '@/components/i18n-provider';
import { getPrefs } from '@/lib/prefs-server';
import { listResource } from '@/server/reference/service';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ lang, year }, categories, accounts] = await Promise.all([getPrefs(), listResource('categories'), listResource('accounts')]);
  return (
    <I18nProvider lang={lang}>
      <div className="flex min-h-svh">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader year={year} categories={categories} accounts={accounts} />
          <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </I18nProvider>
  );
}

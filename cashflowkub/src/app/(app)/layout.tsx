import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-shell/app-nav';
import { AppHeader } from '@/components/app-shell/app-header';
import { I18nProvider } from '@/components/i18n-provider';
import { ShellDataProvider } from '@/components/app-shell/shell-data';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { getPrefs } from '@/lib/prefs-server';
import { getCurrentUser } from '@/server/auth/current-user';
import { defaultDataFor } from '@/server/me/service';
import { getBackendResource } from '@/server/backend/client';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.privacyVersion !== PRIVACY_VERSION) redirect('/privacy-update');
  const [{ lang, year }, firstCategories, accounts] = await Promise.all([getPrefs(), getBackendResource('categories'), getBackendResource('accounts')]);
  // A sign-up whose default-data step failed leaves an account with no categories: repair it here (idempotent).
  let categories = firstCategories;
  if (categories.length === 0) {
    await defaultDataFor(user.id);
    categories = await getBackendResource('categories');
  }
  return (
    <I18nProvider lang={lang}>
      <ShellDataProvider categories={categories} accounts={accounts}>
      <div className="flex min-h-svh">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader year={year} userName={user.name} />
          <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 has-[[data-wide]]:max-w-none md:p-6">{children}</main>
        </div>
      </div>
      </ShellDataProvider>
    </I18nProvider>
  );
}

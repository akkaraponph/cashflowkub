import { redirect } from 'next/navigation';
import { LangToggle, ThemeToggle } from '@/components/app-shell/pref-controls';
import { LogoMark } from '@/components/cfk/logo';
import { I18nProvider } from '@/components/i18n-provider';
import { getPrefs } from '@/lib/prefs-server';
import { getCurrentUser } from '@/server/auth/current-user';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect('/');
  const { lang } = await getPrefs();
  return (
    <I18nProvider lang={lang}>
      <div className="flex min-h-svh flex-col">
        <header className="flex items-center gap-2 p-4">
          <LogoMark size={32} />
          <span className="flex-1 text-base font-bold">CashflowKub</span>
          <LangToggle />
          <ThemeToggle />
        </header>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pb-16">{children}</main>
      </div>
    </I18nProvider>
  );
}

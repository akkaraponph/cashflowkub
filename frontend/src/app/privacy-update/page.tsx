import { redirect } from 'next/navigation';
import { LogoMark } from '@/components/cfk/logo';
import { I18nProvider } from '@/components/i18n-provider';
import { Card } from '@/components/ui/card';
import { getI18n } from '@/lib/prefs-server';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { getCurrentUser } from '@/server/auth/current-user';
import { AcceptForm } from './accept-form';

// Not in the (auth) group: the auth layout sends signed-in users to /dashboard, and this page is for signed-in users.
export async function generateMetadata() {
  const { ui } = await getI18n();
  return { title: `${ui.privacyUpdate.title} · CashflowKub` };
}

export default async function PrivacyUpdatePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.privacyVersion === PRIVACY_VERSION) redirect('/dashboard');
  const { lang, ui } = await getI18n();
  return (
    <I18nProvider lang={lang}>
      <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-4 px-4">
        <div className="flex items-center gap-2">
          <LogoMark size={32} />
          <span className="text-base font-bold">CashflowKub</span>
        </div>
        <Card className="gap-4 p-6">
          <h1 className="text-xl font-bold tracking-tight">{ui.privacyUpdate.title}</h1>
          <AcceptForm />
        </Card>
      </main>
    </I18nProvider>
  );
}

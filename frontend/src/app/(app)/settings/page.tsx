import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { PageTitle } from '@/components/cfk/page-title';
import { getI18n, getPrefs } from '@/lib/prefs-server';
import { SignOutButton } from '@/components/app-shell/sign-out-button';
import { getCurrentUser } from '@/server/auth/current-user';
import { PreferencesRows } from './preferences';
import { YourDataCard } from './your-data';

export default async function SettingsPage() {
  const [{ ui }, { year }, user] = await Promise.all([getI18n(), getPrefs(), getCurrentUser()]);
  if (!user) redirect('/login'); // layouts and pages render in parallel, so the page guards itself too
  return (
    <>
      <PageTitle title={ui.nav.settings} />
      <Card className="flex-row items-center gap-4 p-5">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-2xl font-bold">{[...user.name.trim()][0]?.toUpperCase() ?? '?'}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <SignOutButton />
      </Card>
      <Card className="gap-0 px-5 py-3">
        <p className="py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.preferences}</p>
        <PreferencesRows year={year} />
        <div className="flex items-center gap-3 border-t py-3">
          <span className="flex-1 text-sm">{ui.currency}</span>
          <span className="text-sm text-muted-foreground">{ui.currencyValue}</span>
        </div>
      </Card>
      <YourDataCard />
    </>
  );
}

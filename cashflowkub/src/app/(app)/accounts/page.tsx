import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/cfk/list-row';
import { PageTitle } from '@/components/cfk/page-title';
import { ToneBadge, type Tone } from '@/components/cfk/tone-badge';
import { fmt } from '@/lib/format';
import { pickLabel } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { cn } from '@/lib/utils';
import { getBackendResource } from '@/server/backend/client';
import { AccountDialog } from './account-dialog';

const KIND_TONE: Record<string, Tone> = { bank: 'info', cash: 'success', ewallet: 'primary', credit: 'danger' };

export default async function AccountsPage() {
  const { ui } = await getI18n();
  const accounts = await getBackendResource('accounts');
  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <PageTitle title={ui.nav.accounts} addTransaction={false}>
        <AccountDialog />
      </PageTitle>
      <Card className="gap-1 p-6">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.totalBalance}</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums">{fmt(total)}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{accounts.length} {ui.accountsLower}</p>
      </Card>
      <Card className="gap-0 px-5 py-1">
        {accounts.map((a, i) => (
          <ListRow key={a.id} icon={a.icon} tint={a.tint} title={a.name} subtitle={a.sub} className={i > 0 ? 'border-t' : undefined}
            right={(
              <div className="flex items-center gap-1">
                <span className={cn('font-bold tabular-nums', a.balance < 0 && 'text-destructive')}>{a.balance < 0 ? `-${fmt(a.balance)}` : fmt(a.balance)}</span>
                <AccountDialog account={a} />
              </div>
            )}
            rightSub={<ToneBadge label={pickLabel(ui.accountKind, a.kind)} tone={KIND_TONE[a.kind] ?? 'neutral'} />} />
        ))}
        {accounts.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{ui.noAccounts}</p> : null}
      </Card>
    </>
  );
}

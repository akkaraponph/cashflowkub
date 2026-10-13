import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { CashflowBars, Donut, MiniBars } from '@/components/cfk/charts';
import { Hero, HeroPill } from '@/components/cfk/hero';
import { Icon } from '@/components/cfk/icon';
import { Progress } from '@/components/cfk/progress';
import { StatCard } from '@/components/cfk/stat-card';
import { Tile } from '@/components/cfk/tile';
import { tintFg } from '@/components/cfk/tint';
import { ToneBadge } from '@/components/cfk/tone-badge';
import { TxRow } from '@/components/cfk/tx-row';
import { compact, fmt, pct, signed } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { getI18n } from '@/lib/prefs-server';
import { byKey } from '@/lib/search-params';
import { getDashboard } from '@/server/analytics/service';
import { getDsr } from '@/server/debt/planning';
import { listResource } from '@/server/reference/service';
import { listTransactions } from '@/server/transaction/service';

function SectionHead({ title, href, viewAll }: { title: string; href?: string; viewAll: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-bold">{title}</h2>
      {href ? (
        <Link href={href} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {viewAll}
          <Icon name="chevron-right" size={14} />
        </Link>
      ) : null}
    </div>
  );
}

function Legend({ income, expenses }: { income: string; expenses: string }) {
  return (
    <div className="flex gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-type-xls-fg" />{income}</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-foreground" />{expenses}</span>
    </div>
  );
}

export default async function DashboardPage() {
  const { ui, lang } = await getI18n();
  const [d, recent, budgets, categories, dsr] = await Promise.all([getDashboard(), listTransactions({ limit: 5 }), listResource('budgets'), listResource('categories'), getDsr()]);
  const cats = byKey(categories);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{ui.greeting}</h1>
        <p className="text-sm text-muted-foreground">{ui.today}</p>
      </div>

      <Hero>
        <p className="text-[13px] font-semibold uppercase tracking-wider opacity-70">{ui.netWorth}</p>
        <p className="mt-2 text-4xl font-extrabold tabular-nums">{fmt(d.netWorth)}</p>
        <div className="mt-3"><HeroPill><Icon name="trending-up" size={15} />{signed(d.month.net)} {ui.thisMonth}</HeroPill></div>
      </Hero>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon="arrow-down-left" tint="xls" label={ui.income} value={fmt(d.month.income)} positive />
        <StatCard icon="arrow-up-right" tint="pdf" label={ui.expenses} value={fmt(d.month.expense)} />
        <StatCard icon="wallet" tint="doc" label={`${ui.net} · ${ui.thisMonth}`} value={signed(d.month.net)} positive />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold">{ui.cashflow}</h2>
            <span className="text-xs text-muted-foreground">{ui.last6}</span>
          </div>
          <CashflowBars data={d.cashflow} />
          <Legend income={ui.income} expenses={ui.expenses} />
        </Card>
        <Card className="gap-4 p-5">
          <h2 className="text-base font-bold">{ui.spending}</h2>
          <div className="flex items-center gap-5">
            <Donut segments={d.spending.map((s) => ({ value: s.spent, color: tintFg(s.tint) }))} centerLabel={ui.spent} centerValue={compact(d.spendTotal)} />
            <ul className="flex flex-1 flex-col gap-2.5">
              {d.spending.map((s) => (
                <li key={s.cat} className="flex items-center gap-2 text-[13px]">
                  <span className="size-2.5 rounded-sm" style={{ background: tintFg(s.tint) }} />
                  <span className="flex-1 truncate">{localized(lang, s.label, s.th)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.round(s.pct)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {d.nextBill ? (
        <Link href="/bills" className="block">
          <Card className="flex-row items-center gap-3.5 p-4 hover:opacity-90">
            <Tile icon={d.nextBill.icon} tint={d.nextBill.tint} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.nextBill}</p>
              <div className="flex items-center gap-2">
                <span className="truncate font-bold">{localized(lang, d.nextBill.name, d.nextBill.th)}</span>
                <ToneBadge label={d.nextBill.status === 'overdue' ? ui.overdue : ui.dueSoon} tone={d.nextBill.status === 'overdue' ? 'danger' : 'warning'} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold tabular-nums">{fmt(d.nextBill.amount)}</p>
              <p className="text-xs text-muted-foreground">{ui.dueOn} {d.nextBill.dueDay}</p>
            </div>
          </Card>
        </Link>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3.5 p-5">
          <SectionHead title={ui.nav.debts} href="/debts" viewAll={ui.viewAll} />
          <div className="flex items-center gap-4">
            <Donut size={86} stroke={11} segments={[{ value: d.debt.progress, color: 'var(--primary)' }]} centerValue={`${Math.round(d.debt.progress * 100)}%`} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.totalDebt}</p>
              <p className="text-2xl font-extrabold tabular-nums">{fmt(d.debt.remaining)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{ui.of} {fmt(d.debt.original)}</p>
            </div>
          </div>
          {d.debt.focus ? (
            <Link href={`/debts/${d.debt.focus.id}`} className="flex items-center gap-3 rounded-xl bg-secondary p-3 hover:opacity-90">
              <Tile icon={d.debt.focus.icon} tint={d.debt.focus.tint} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ui.payFirst} · {d.debt.focus.apr}% {ui.apr}</p>
                <p className="truncate text-[13px] font-semibold">{localized(lang, d.debt.focus.name, d.debt.focus.th)}</p>
              </div>
              <span className="text-[13px] font-bold tabular-nums">{fmt(d.debt.focus.remaining)}</span>
            </Link>
          ) : null}
          <Link href="/debts/plan" className="flex items-center justify-between rounded-xl border p-3 text-sm hover:opacity-90">
            <span className="text-muted-foreground">{ui.dsrTitle}</span>
            <span className="font-bold tabular-nums">{dsr.ratio === null ? '—' : `${pct(dsr.ratio)} · ${ui.dsrBand[dsr.band ?? 'healthy']}`}</span>
          </Link>
        </Card>
        <Card className="gap-3.5 p-5">
          <SectionHead title={ui.netWorth} href="/networth" viewAll={ui.viewAll} />
          <p className="text-3xl font-extrabold tabular-nums">{fmt(d.netWorth)}</p>
          <div className="flex gap-4 text-xs font-semibold">
            <span className="text-type-xls-fg">+{fmt(d.totalAssets)} {ui.assets}</span>
            <span className="text-destructive">-{fmt(d.totalLiab)} {ui.liabilities}</span>
          </div>
          <MiniBars values={d.netWorthHist.map((p) => p.value)} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3 p-5">
          <SectionHead title={ui.budgetsTitle} href="/budgets" viewAll={ui.viewAll} />
          {budgets.slice(0, 4).map((b) => {
            const cat = cats.get(b.cat);
            return (
              <div key={b.id} className="grid gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold">{cat ? localized(lang, cat.label, cat.th) : b.cat}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmt(b.spent)} / {fmt(b.limit)}</span>
                </div>
                <Progress value={b.limit ? b.spent / b.limit : 0} tone={b.spent > b.limit ? 'danger' : 'primary'} />
              </div>
            );
          })}
        </Card>
        <Card className="gap-1 px-5 py-3">
          <div className="py-2"><SectionHead title={ui.recent} href="/transactions" viewAll={ui.viewAll} /></div>
          {recent.map((t) => <TxRow key={t.id} tx={t} cat={cats.get(t.cat)} className="border-t" />)}
        </Card>
      </div>

      <Card className="gap-3 p-5">
        <SectionHead title={ui.goalsTitle} href="/goals" viewAll={ui.viewAll} />
        {d.goals.map((g) => {
          const ratio = g.target ? g.saved / g.target : 0;
          return (
            <div key={g.id} className="grid gap-1.5">
              <div className="flex items-center gap-2.5">
                <Tile icon={g.icon} tint="xls" size={32} />
                <span className="flex-1 text-sm font-semibold">{localized(lang, g.name, g.th)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(ratio * 100)}%</span>
              </div>
              <Progress value={ratio} />
              <span className="text-xs text-muted-foreground tabular-nums">{fmt(g.saved)} {ui.of} {fmt(g.target)}</span>
            </div>
          );
        })}
      </Card>
    </>
  );
}

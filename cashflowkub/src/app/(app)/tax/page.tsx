import { Card } from '@/components/ui/card';
import { Icon } from '@/components/cfk/icon';
import { PageTitle } from '@/components/cfk/page-title';
import { ToneBadge } from '@/components/cfk/tone-badge';
import { fmt, pct } from '@/lib/format';
import { getPrefs } from '@/lib/prefs-server';
import { DICT, fill } from '@/lib/i18n';
import { hasUsefulRoom } from '@/server/tax/logic';
import { getTaxPlan } from '@/server/tax/service';
import { TaxForm } from './tax-form';

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
  </div>
);

export default async function TaxPage() {
  const { lang, year } = await getPrefs();
  const ui = DICT[lang];
  const plan = await getTaxPlan(year);
  const { result: r } = plan;
  const shownYear = lang === 'th' ? year + 543 : year;

  return (
    <>
      <PageTitle title={ui.tax.title} />
      <p className="-mt-2 text-sm text-muted-foreground">{fill(ui.tax.sub, { year: shownYear })}</p>

      {plan.assumed ? (
        <p className="flex items-start gap-2 rounded-xl bg-type-folder-bg p-4 text-sm text-type-folder-fg">
          <Icon name="triangle-alert" size={17} />
          {fill(ui.tax.assumed, { year: shownYear, rulesYear: lang === 'th' ? plan.rulesYear + 543 : plan.rulesYear })}
        </p>
      ) : null}

      {!plan.saved ? <p className="rounded-xl bg-type-doc-bg p-4 text-sm text-type-doc-fg">{ui.tax.unsaved}</p> : null}

      <Card className="gap-3 p-5">
        <div>
          <p className="text-xs text-muted-foreground">{ui.tax.estimated}</p>
          <p className="text-3xl font-extrabold tabular-nums">{fmt(r.tax)}</p>
        </div>
        <Row label={ui.tax.withheldLbl} value={fmt(r.withheld)} />
        {plan.saved ? (
          <div className="flex items-center justify-between text-sm">
            <ToneBadge
              label={r.balance > 0 ? ui.tax.owe : r.balance < 0 ? ui.tax.refund : ui.tax.even}
              tone={r.balance > 0 ? 'danger' : r.balance < 0 ? 'success' : 'neutral'}
            />
            <span className="font-bold tabular-nums">{fmt(Math.abs(r.balance))}</span>
          </div>
        ) : null}
        <Row label={ui.tax.effectiveRate} value={pct(r.effectiveRate)} />
        <Row label={ui.tax.marginalRate} value={pct(r.marginalRate)} />
        <Row label={ui.tax.incomeLbl} value={fmt(r.income)} />
        <Row label={ui.tax.expenseLbl} value={fmt(r.expense)} />
        <Row label={ui.tax.deductionsLbl} value={fmt(r.totalDeductions)} />
        <Row label={ui.tax.netIncome} value={fmt(r.netIncome)} />
      </Card>

      {r.bands.length > 0 ? (
        <Card className="gap-2 p-5">
          <h2 className="font-bold">{ui.tax.bands}</h2>
          {r.bands.map((b) => (
            <div key={b.rate} className="flex justify-between text-sm tabular-nums">
              <span className="text-muted-foreground">{pct(b.rate)} · {fmt(b.taxable)}</span>
              <span className="font-semibold">{fmt(b.tax)}</span>
            </div>
          ))}
        </Card>
      ) : null}

      <Card className="gap-2 p-5">
        <h2 className="font-bold">{ui.tax.claims}</h2>
        {r.deductions.map((d) => (
          <div key={d.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex-1 truncate">{ui.tax.field[d.key]}</span>
            {d.capped ? <ToneBadge tone="warning" label={`${ui.tax.capped} · ${fill(ui.tax.claimedOf, { claimed: fmt(d.claimed) })}`} /> : null}
            <span className="font-semibold tabular-nums">{fmt(d.allowed)}</span>
          </div>
        ))}
      </Card>

      {hasUsefulRoom(r) ? (
        <Card className="gap-2 p-5">
          <h2 className="font-bold">{ui.tax.room}</h2>
          <Row label={ui.tax.field.rmf} value={fmt(r.room.rmf)} />
          <Row label={ui.tax.field.ssf} value={fmt(r.room.ssf)} />
          <Row label={ui.tax.field.thaiEsg} value={fmt(r.room.thaiEsg)} />
        </Card>
      ) : null}

      <TaxForm key={`${year}:${JSON.stringify(plan.input)}`} year={year} input={plan.input} />

      <p className="text-xs text-muted-foreground">{ui.tax.disclaimer}</p>
    </>
  );
}

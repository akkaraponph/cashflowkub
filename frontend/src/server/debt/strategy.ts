// Month-by-month payoff simulation across all active debts.
// Each month: accrue interest, pay every minimum, then pour the remaining budget into
// the first open debt in strategy order. With rollover, the budget stays at the
// starting total, so a closed debt's minimum flows to the next one (snowball effect).
import type { Strategy } from './logic';
import { MAX_MONTHS } from './schedule';
import { interestForMonth } from './terms';

export interface SimDebt {
  id: number;
  balance: number;
  apr: number;
  calc: string;
  original: number;
  minPayment: number;
  sort: number;
}

export interface SimResult {
  strategy: Strategy;
  extra: number;
  months: number;
  totalInterest: number;
  neverPaysOff: boolean;
  order: number[];
  payoffMonth: Record<number, number>;
}

export interface PayoffComparison {
  baseline: SimResult;
  plan: SimResult;
  interestSaved: number;
  monthsSaved: number;
}

function assertMoney(name: string, n: number): void {
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`${name} must be a finite, non-negative number`);
}

export function payoffOrder(debts: SimDebt[], strategy: Strategy): number[] {
  const list = [...debts];
  if (strategy === 'avalanche') list.sort((a, b) => b.apr - a.apr || a.balance - b.balance || a.sort - b.sort);
  else if (strategy === 'snowball') list.sort((a, b) => a.balance - b.balance || b.apr - a.apr || a.sort - b.sort);
  else list.sort((a, b) => a.sort - b.sort);
  return list.map((d) => d.id);
}

export function simulatePayoff(debts: SimDebt[], strategy: Strategy, extra: number, opts: { rollover?: boolean } = {}): SimResult {
  const rollover = opts.rollover ?? true;
  assertMoney('extra', extra);
  for (const d of debts) {
    assertMoney('balance', d.balance);
    assertMoney('apr', d.apr);
    assertMoney('original', d.original);
    assertMoney('minPayment', d.minPayment);
    if (!Number.isFinite(d.sort) || !Number.isFinite(d.id)) throw new RangeError('id and sort must be finite numbers');
  }
  const open = debts.filter((d) => d.balance > 0);
  const order = payoffOrder(open, strategy);
  const byId = new Map(open.map((d) => [d.id, d]));
  const balance = new Map(open.map((d) => [d.id, d.balance]));
  const startBudget = open.reduce((s, d) => s + d.minPayment, 0) + extra;
  const payoffMonth: Record<number, number> = {};
  let totalInterest = 0;
  let month = 0;
  const active = () => order.filter((id) => (balance.get(id) ?? 0) > 0);

  while (active().length > 0) {
    if (month >= MAX_MONTHS) return { strategy, extra, months: MAX_MONTHS, totalInterest, neverPaysOff: true, order, payoffMonth };
    month++;
    const ids = active();
    for (const id of ids) {
      const d = byId.get(id)!;
      const b = balance.get(id)!;
      const interest = interestForMonth(d, b);
      totalInterest += interest;
      balance.set(id, b + interest);
    }
    let pool = rollover ? startBudget : ids.reduce((s, id) => s + byId.get(id)!.minPayment, 0) + extra;
    for (const id of ids) {
      const pay = Math.min(byId.get(id)!.minPayment, balance.get(id)!, pool);
      balance.set(id, balance.get(id)! - pay);
      pool -= pay;
    }
    // Without rollover, unused minimum (a final partial payment) must not flow to other debts;
    // only the explicit extra is redistributed.
    if (!rollover) pool = extra;
    for (const id of ids) {
      if (pool <= 0) break;
      const pay = Math.min(pool, balance.get(id)!);
      balance.set(id, balance.get(id)! - pay);
      pool -= pay;
    }
    for (const id of ids) if (balance.get(id)! <= 0) payoffMonth[id] = month;
  }
  return { strategy, extra, months: month, totalInterest, neverPaysOff: false, order, payoffMonth };
}

/**
 * Chosen strategy + extra (with rollover) versus paying only each debt's own minimum.
 * When baseline.neverPaysOff (or plan.neverPaysOff) is true, interestSaved and monthsSaved are
 * artefacts of the MAX_MONTHS cap and must not be shown to users; callers must check the flags first.
 */
export function comparePayoff(debts: SimDebt[], strategy: Strategy, extra: number): PayoffComparison {
  const baseline = simulatePayoff(debts, strategy, 0, { rollover: false });
  const plan = simulatePayoff(debts, strategy, extra);
  return { baseline, plan, interestSaved: baseline.totalInterest - plan.totalInterest, monthsSaved: baseline.months - plan.months };
}

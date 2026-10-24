// Debt Service Ratio (DSR = monthly debt payments / monthly income) and the smart plan built on it.
import type { DueStatus } from './cycle';

export type DsrBand = 'healthy' | 'manageable' | 'high' | 'critical';
export const DSR_LIMITS = { healthy: 0.3, manageable: 0.4, high: 0.6 } as const;
export const REFINANCE_APR = 25;
export const REFINANCE_MIN_BALANCE = 10_000;
const EPS = 1e-9;

export interface PlanDebt {
  id: number;
  apr: number;
  remaining: number;
  installment: number;
  done: boolean;
  due: Pick<DueStatus, 'state' | 'amountDue' | 'paidThisCycle' | 'lateFee'>;
}

export interface DsrResult {
  income: number;
  monthlyDebt: number;
  ratio: number | null;
  band: DsrBand | null;
}

export function dsrBand(ratio: number): DsrBand {
  assertNonNegative('ratio', ratio);
  if (ratio <= DSR_LIMITS.healthy) return 'healthy';
  if (ratio <= DSR_LIMITS.manageable) return 'manageable';
  if (ratio <= DSR_LIMITS.high) return 'high';
  return 'critical';
}

function assertNonNegative(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0) throw new RangeError(`${name} must be a finite number >= 0`);
}

function assertDebts(debts: PlanDebt[]): void {
  for (const d of debts) {
    assertNonNegative('apr', d.apr);
    assertNonNegative('remaining', d.remaining);
    assertNonNegative('installment', d.installment);
  }
}

const activeOf = (debts: PlanDebt[]): PlanDebt[] => debts.filter((d) => !d.done && d.remaining > 0);

export function computeDsr(debts: PlanDebt[], income: number): DsrResult {
  assertNonNegative('income', income);
  assertDebts(debts);
  const monthlyDebt = activeOf(debts).reduce((s, d) => s + d.installment, 0);
  if (income <= 0) return { income, monthlyDebt, ratio: null, band: null };
  const ratio = monthlyDebt / income;
  return { income, monthlyDebt, ratio, band: dsrBand(ratio) };
}

export type SmartActionKey = 'setIncome' | 'payOverdue' | 'cutDsr' | 'quickWin' | 'focusHighestRate' | 'refinance' | 'noNewDebt' | 'debtFree';

export interface SmartAction {
  key: SmartActionKey;
  debtId?: number;
  amount?: number;
}

export interface QuickWin {
  id: number;
  remaining: number;
  installment: number;
  /** DSR after closing this and every quick win above it; null without income */
  dsrAfter: number | null;
}

export interface SmartPlan {
  dsr: DsrResult;
  targetDsr: number;
  monthlyCut: number;
  incomeNeeded: number;
  quickWins: QuickWin[];
  refinance: number[];
  actions: SmartAction[];
}

export function buildSmartPlan(debts: PlanDebt[], income: number, targetDsr: number = DSR_LIMITS.manageable): SmartPlan {
  assertNonNegative('income', income);
  assertNonNegative('targetDsr', targetDsr);
  assertDebts(debts);
  const active = activeOf(debts);
  const dsr = computeDsr(active, income);
  const actions: SmartAction[] = [];
  if (active.length === 0) {
    return { dsr, targetDsr, monthlyCut: 0, incomeNeeded: 0, quickWins: [], refinance: [], actions: [{ key: 'debtFree' }] };
  }
  if (dsr.ratio === null) actions.push({ key: 'setIncome' });

  for (const d of active) {
    if (d.due.state === 'overdue') actions.push({ key: 'payOverdue', debtId: d.id, amount: Math.max(0, d.due.amountDue - d.due.paidThisCycle) + d.due.lateFee });
  }

  // EPS keeps float noise (e.g. 6000 / 0.4 = 14999.999…) from rounding a whole baht up.
  const monthlyCut = dsr.ratio !== null && dsr.ratio > targetDsr ? Math.ceil(dsr.monthlyDebt - targetDsr * income - EPS) : 0;
  if (monthlyCut > 0) actions.push({ key: 'cutDsr', amount: monthlyCut });

  // Quick wins: closing these frees the most monthly payment per baht spent.
  let freed = 0;
  const quickWins: QuickWin[] = active
    .filter((d) => d.installment > 0)
    .sort((a, b) => b.installment / b.remaining - a.installment / a.remaining)
    .slice(0, 3)
    .map((d) => {
      freed += d.installment;
      return { id: d.id, remaining: d.remaining, installment: d.installment, dsrAfter: income > 0 ? (dsr.monthlyDebt - freed) / income : null };
    });
  if (quickWins[0] && (dsr.ratio === null || dsr.ratio > DSR_LIMITS.healthy)) {
    actions.push({ key: 'quickWin', debtId: quickWins[0].id, amount: quickWins[0].remaining });
  }

  const focus = active.filter((d) => d.apr > 0).sort((a, b) => b.apr - a.apr || a.remaining - b.remaining)[0];
  if (focus) actions.push({ key: 'focusHighestRate', debtId: focus.id });

  const refinance = active.filter((d) => d.apr >= REFINANCE_APR && d.remaining >= REFINANCE_MIN_BALANCE).map((d) => d.id);
  for (const id of refinance) actions.push({ key: 'refinance', debtId: id });

  if (dsr.ratio !== null && dsr.ratio > DSR_LIMITS.manageable) actions.push({ key: 'noNewDebt' });

  return {
    dsr, targetDsr, monthlyCut,
    incomeNeeded: targetDsr > 0 ? Math.ceil(dsr.monthlyDebt / targetDsr - EPS) : 0,
    quickWins, refinance, actions,
  };
}

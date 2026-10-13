// DB-backed debt planning: payoff comparison, DSR and smart plan.
import { badRequest } from '@/server/errors';
import { getMonthlyIncome } from '@/server/settings/service';
import type { DebtView } from '@/server/views';
import { buildSmartPlan, computeDsr, DSR_LIMITS, type DsrResult, type SmartPlan } from './dsr';
import { parseStrategy, type Strategy } from './logic';
import { listActiveDebtViews } from './service';
import { comparePayoff, type PayoffComparison, type SimDebt } from './strategy';

export function parsePlanningParams(params: URLSearchParams): { strategy: Strategy; extra: number; target: number } {
  const rawExtra = params.get('extra');
  const extra = rawExtra === null || rawExtra === '' ? 0 : Number(rawExtra);
  if (!Number.isInteger(extra) || extra < 0 || extra > 10_000_000) throw badRequest(`invalid extra: ${rawExtra}`);
  const rawTarget = params.get('target');
  const target = rawTarget === null || rawTarget === '' ? DSR_LIMITS.manageable : Number(rawTarget);
  if (!Number.isFinite(target) || target <= 0 || target > 1) throw badRequest(`invalid target: ${rawTarget} (expected 0 < target <= 1)`);
  return { strategy: parseStrategy(params.get('strategy') ?? undefined), extra, target };
}

export const toSimDebt = (d: DebtView): SimDebt => ({
  id: d.id, balance: d.remaining, apr: d.apr, calc: d.calc, original: d.original, minPayment: d.installment, sort: d.sort,
});

/**
 * Compares a strategy against minimums-only. NOTE: when `baseline.neverPaysOff` or `plan.neverPaysOff`
 * is true, `interestSaved`/`monthsSaved` are artefacts of the simulator's MAX_MONTHS cap; clients must
 * check those flags (exposed on `baseline` and `plan`) before presenting savings.
 */
export async function getPayoffComparison(strategy: Strategy, extra: number): Promise<PayoffComparison> {
  return comparePayoff((await listActiveDebtViews()).map(toSimDebt), strategy, extra);
}

export async function getSmartPlan(target: number = DSR_LIMITS.manageable): Promise<SmartPlan> {
  const [debts, income] = await Promise.all([listActiveDebtViews(), getMonthlyIncome()]);
  return buildSmartPlan(debts, income, target);
}

export async function getDsr(): Promise<DsrResult> {
  const [debts, income] = await Promise.all([listActiveDebtViews(), getMonthlyIncome()]);
  return computeDsr(debts, income);
}

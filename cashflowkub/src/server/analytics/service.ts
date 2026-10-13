import { prisma } from '@/lib/db';
import { todayDay } from '@/lib/clock';
import { listActiveDebtViews } from '@/server/debt/service';
import { buildDashboard, buildNetWorth, buildReports, type DashboardView, type NetWorthView, type ReportsView } from './logic';

const budgetsBySpend = () => prisma.budget.findMany({ orderBy: { spent: 'desc' } });
const assetsByValue = () => prisma.asset.findMany({ orderBy: { value: 'desc' } });
const cashflow = () => prisma.monthlyCashflow.findMany({ orderBy: { sort: 'asc' } });
const history = () => prisma.netWorthHistory.findMany({ orderBy: { sort: 'asc' } });

export async function getDashboard(): Promise<DashboardView> {
  const [assets, activeDebts, budgets, categories, flow, unpaidBills, goals, netWorthHist] = await Promise.all([
    assetsByValue(),
    listActiveDebtViews(),
    budgetsBySpend(),
    prisma.category.findMany(),
    cashflow(),
    prisma.bill.findMany({ where: { paid: false }, orderBy: [{ dueDay: 'asc' }, { sort: 'asc' }] }),
    prisma.goal.findMany({ orderBy: { sort: 'asc' } }),
    history(),
  ]);
  return buildDashboard({ assets, activeDebts, budgets, categories, cashflow: flow, unpaidBills, goals, netWorthHist, todayDay: todayDay() });
}

export async function getNetWorth(): Promise<NetWorthView> {
  const [assets, activeDebts, hist] = await Promise.all([assetsByValue(), listActiveDebtViews(), history()]);
  return buildNetWorth({ assets, activeDebts, history: hist });
}

export async function getReports(): Promise<ReportsView> {
  const [budgets, categories, expenseTx, monthly] = await Promise.all([
    budgetsBySpend(),
    prisma.category.findMany(),
    prisma.transaction.findMany({ where: { amount: { lt: 0 } }, orderBy: [{ date: 'desc' }, { id: 'desc' }] }),
    cashflow(),
  ]);
  return buildReports({ budgets, categories, expenseTx, monthly });
}

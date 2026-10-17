// Row factories for unit tests: complete Prisma rows with neutral defaults.
import type {
  Asset, AssetSnapshot, Bill, Budget, Category, Debt, DebtPayment, Goal, MonthlyCashflow, NetWorthHistory, PlanItem, Prisma, Transaction,
} from '@/generated/prisma/client';
import { toDebtView, type DebtView } from '@/server/views';

export const debt = (o: Partial<Debt> = {}): Debt => ({
  id: 1, name: 'Loan', th: 'เงินกู้', icon: 'landmark', tint: 'pdf', kind: 'personal', lender: '', original: 10000, openingPaid: 0, paid: 0,
  apr: 0, calc: 'reducing', monthly: 1000, fixedPayment: 0, termMonths: 0, dueDay: 25, graceDays: 0, lateFee: 0, penaltyApr: 0,
  done: false, revolving: false, sort: 1, ...o,
});
export const payment = (o: Partial<DebtPayment> = {}): DebtPayment => ({
  id: 1, debtId: 1, date: new Date('2026-06-01T00:00:00Z'), amount: 1000, principal: 1000, interest: 0, fee: 0, note: '', ...o,
});
export const debtView = (o: Partial<Debt> = {}, payments: DebtPayment[] = []): DebtView =>
  toDebtView({ ...debt(o), payments }, new Date('2026-06-18T00:00:00Z'));
export const bill = (o: Partial<Bill> = {}): Bill => ({
  id: 1, name: 'Bill', th: 'บิล', icon: 'receipt', tint: 'pdf', amount: 100, dueDay: 20, paid: false, freq: 'monthly', cat: 'bills', kind: 'bill', sort: 1, ...o,
});
export const tx = (o: Partial<Transaction> = {}): Transaction => ({
  id: 1, name: 'Coffee', cat: 'food', acct: 'Cash', amount: -100, date: new Date('2026-06-18T00:00:00Z'), note: '', interest: 0, fee: 0, goal: '', ...o,
});
export const budget = (o: Partial<Budget> = {}): Budget => ({ id: 1, cat: 'food', spent: 0, limit: 1000, sort: 1, ...o });
export const category = (o: Partial<Category> = {}): Category => ({
  id: 1, key: 'food', label: 'Food', th: 'อาหาร', short: 'Food', icon: 'utensils', tint: 'folder', type: 'expense', sub: 'need', sort: 1, ...o,
});
export const asset = (o: Partial<Asset> = {}): Asset => ({ id: 1, name: 'Bank', th: 'ธนาคาร', icon: 'landmark', tint: 'doc', value: 0, sort: 1, ...o });
export const planItem = (o: Partial<PlanItem> = {}): PlanItem => ({
  id: 1, type: 'income', name: 'Salary', th: 'เงินเดือน', icon: '', tint: '', cat: '', sub: '', planned: 0, actual: 0, month: '2026-06', sort: 1, ...o,
});
export const snapshot = (o: Partial<AssetSnapshot> = {}): AssetSnapshot => ({
  id: 1, name: 'Bank', th: 'ธนาคาร', group: 'bank', icon: '', tint: '', prev: 0, curr: 0, month: '2026-06', sort: 1, ...o,
});
export const nwPoint = (o: Partial<NetWorthHistory> = {}): NetWorthHistory => ({ id: 1, month: 'Jun', monthTh: 'มิ.ย.', value: 0, sort: 1, ...o });
export const cashflow = (o: Partial<MonthlyCashflow> = {}): MonthlyCashflow => ({ id: 1, month: 'Jun', income: 0, expense: 0, sort: 1, ...o });
export const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 1, name: 'Goal', th: 'เป้าหมาย', icon: 'target', saved: 0, target: 1000, monthly: 0, by: '', sort: 1, ...o,
});
export type SetupGoalRow = Prisma.SetupGoalGetPayload<{ include: { channels: true } }>;
export const setupGoal = (o: Partial<SetupGoalRow> = {}): SetupGoalRow => ({
  id: 1, kind: 'custom', name: 'Trip', th: 'เที่ยว', icon: 'plane', tint: 'image', startDate: '', startTh: '', endDate: '', endTh: '',
  inflation: 0, target: 0, opening: 0, currentAge: null, retireAge: null, useUntilAge: null, monthlyNeed: null, sort: 1, channels: [], ...o,
});

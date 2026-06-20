// React Query hooks wrapping the API. One query key per resource; mutations
// invalidate the queries whose aggregates they affect.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getList } from './api';
import type {
  Account, AssetSnapshots, Bill, BillsSummary, Budget, Category, Channel,
  Dashboard, Debt, DebtSchedule, Goal, IncomeCategory, NetWorth, Plan, Reports,
  Setup, Transaction,
} from './types';

export const qk = {
  dashboard: ['dashboard'] as const,
  transactions: (f?: string) => ['transactions', f ?? 'all'] as const,
  accounts: ['accounts'] as const,
  categories: ['categories'] as const,
  budgets: ['budgets'] as const,
  goals: ['goals'] as const,
  debts: ['debts'] as const,
  debt: (id: string | number) => ['debt', String(id)] as const,
  debtSchedule: (id: string | number) => ['debtSchedule', String(id)] as const,
  bills: ['bills'] as const,
  billsSummary: ['billsSummary'] as const,
  networth: ['networth'] as const,
  reports: ['reports'] as const,
  plan: ['plan'] as const,
  snapshots: ['snapshots'] as const,
  setup: ['setup'] as const,
  channels: ['channels'] as const,
};

export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: () => api.get<Dashboard>('/dashboard') });

export const useTransactions = (filter?: string) =>
  useQuery({
    queryKey: qk.transactions(filter),
    queryFn: () => getList<Transaction>(`/transactions${filter ? `?${filter}` : ''}`),
  });

export const useAccounts = () => useQuery({ queryKey: qk.accounts, queryFn: () => getList<Account>('/accounts') });
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: () => getList<Category>('/categories') });
export const useBudgets = () => useQuery({ queryKey: qk.budgets, queryFn: () => getList<Budget>('/budgets') });
export const useGoals = () => useQuery({ queryKey: qk.goals, queryFn: () => getList<Goal>('/goals') });
export const useChannels = () => useQuery({ queryKey: qk.channels, queryFn: () => getList<Channel>('/channels') });

export const useDebts = (status?: 'active' | 'paid') =>
  useQuery({ queryKey: [...qk.debts, status ?? 'all'], queryFn: () => getList<Debt>(`/debts${status ? `?status=${status}` : ''}`) });
export const useDebt = (id: string | number) =>
  useQuery({ queryKey: qk.debt(id), queryFn: () => api.get<Debt>(`/debts/${id}`), enabled: !!id });
export const useDebtSchedule = (id: string | number) =>
  useQuery({ queryKey: qk.debtSchedule(id), queryFn: () => api.get<DebtSchedule>(`/debts/${id}/schedule`), enabled: !!id });

export const useBills = (status?: 'paid' | 'unpaid') =>
  useQuery({ queryKey: [...qk.bills, status ?? 'all'], queryFn: () => getList<Bill>(`/bills${status ? `?status=${status}` : ''}`) });
export const useBillsSummary = () => useQuery({ queryKey: qk.billsSummary, queryFn: () => api.get<BillsSummary>('/bills/summary') });

export const useNetWorth = () => useQuery({ queryKey: qk.networth, queryFn: () => api.get<NetWorth>('/networth') });
export const useReports = () => useQuery({ queryKey: qk.reports, queryFn: () => api.get<Reports>('/reports') });
export const usePlan = () => useQuery({ queryKey: qk.plan, queryFn: () => api.get<Plan>('/plan') });
export const useAssetSnapshots = () => useQuery({ queryKey: qk.snapshots, queryFn: () => api.get<AssetSnapshots>('/plan/snapshots') });
export const useSetup = () => useQuery({ queryKey: qk.setup, queryFn: () => api.get<Setup>('/setup') });

// --- mutations ---------------------------------------------------------------

interface NewTx { name: string; cat: string; acct: string; amount: number; note?: string; date?: string; }

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewTx) => api.post<Transaction>('/transactions', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.accounts });
    },
  });
}

export function useToggleBillPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paid }: { id: number; paid?: boolean }) =>
      api.patch<Bill>(`/bills/${id}/pay`, paid === undefined ? {} : { paid }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: qk.billsSummary });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function usePayDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount?: number }) =>
      api.post<Debt>(`/debts/${id}/pay`, amount ? { amount } : {}),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['debts'] });
      qc.invalidateQueries({ queryKey: qk.debt(vars.id) });
      qc.invalidateQueries({ queryKey: qk.debtSchedule(vars.id) });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.networth });
    },
  });
}

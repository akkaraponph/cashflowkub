// API response shapes (mirror api/internal/models + aggregate handlers).

export interface Account {
  id: number; name: string; sub: string; balance: number; icon: string;
  tint: string; kind: string; startDate: string; startTh: string; sort: number;
}
export interface Category {
  id: number; key: string; label: string; th: string; short: string;
  icon: string; tint: string; type: 'income' | 'expense'; sub: string; sort: number;
}
export interface Transaction {
  id: number; name: string; cat: string; acct: string; amount: number;
  note: string; group: string; date: string;
}
export interface Budget { id: number; cat: string; spent: number; limit: number; sort: number; }
export interface Goal {
  id: number; name: string; th: string; icon: string; saved: number;
  target: number; monthly: number; by: string; sort: number;
}
export interface Debt {
  id: number; name: string; th: string; icon: string; tint: string;
  original: number; paid: number; apr: number; monthly: number; calc: 'flat' | 'reducing';
  payoff: string; payoffTh: string; monthsLeft: number; done: boolean; revolving: boolean;
  sort: number; remaining: number; progress: number;
}
export interface Asset {
  id: number; name: string; th: string; icon: string; tint: string; value: number; sort: number;
}
export interface Bill {
  id: number; name: string; th: string; icon: string; tint: string; amount: number;
  dueDay: number; paid: boolean; freq: string; cat: string; sort: number;
  status: 'paid' | 'overdue' | 'dueToday' | 'dueSoon' | 'upcoming'; daysDiff: number;
}
export interface Channel {
  id: number; name: string; th: string; kind: string; icon: string; tint: string;
  opening: number; startDate: string; startTh: string; sort: number;
}
export interface IncomeCategory {
  id: number; name: string; th: string; sub: string; icon: string; tint: string; sort: number;
}
export interface PlanItem {
  id: number; type: 'income' | 'expense' | 'savings'; name: string; th: string;
  icon: string; tint: string; cat: string; sub: string; planned: number; actual: number;
  month: string; sort: number;
}
export interface MonthCashflow { id: number; month: string; income: number; expense: number; sort: number; }
export interface NetWorthPoint { id: number; month: string; monthTh: string; value: number; sort: number; }
export interface CategorySpend {
  cat: string; label: string; th: string; tint: string; icon: string; spent: number; pct: number;
}

export interface Dashboard {
  netWorth: number; totalAssets: number; totalLiab: number;
  month: { income: number; expense: number; net: number };
  cashflow: MonthCashflow[];
  spending: CategorySpend[];
  spendTotal: number;
  debt: { original: number; paid: number; remaining: number; progress: number; focus: Debt | null };
  nextBill: Bill | null;
  goals: Goal[];
  netWorthHist: NetWorthPoint[];
}

export interface NetWorth {
  netWorth: number; totalAssets: number; totalLiab: number;
  assets: Asset[]; liabilities: Debt[]; history: NetWorthPoint[];
}

export interface Reports {
  breakdown: CategorySpend[]; spendTotal: number;
  topMerchants: { name: string; cat: string; total: number }[];
  monthly: MonthCashflow[];
}

export interface ScheduleRow {
  month: number; payment: number; principal: number; interest: number; balance: number;
}
export interface DebtSchedule {
  debt: Debt; schedule: ScheduleRow[]; totalInterest: number; months: number;
}

export interface BillsSummary {
  total: number; paid: number; remaining: number; count: number; month: string; today: number;
  nextBill: Bill | null;
  daySpend: { id: number; day: number; amount: number; month: string }[];
}

export interface PlanGroup {
  type: string; items: PlanItem[]; totalPlanned: number; totalActual: number; variance: number;
}
export interface Plan {
  income: PlanGroup; expense: PlanGroup; savings: PlanGroup;
  summary: {
    plannedNet: number; actualNet: number; netVariance: number;
    incomeRatio: number; expenseUsage: number; savingsRatio: number;
  };
}

export interface AssetSnapshotItem {
  id: number; name: string; th: string; group: string; icon: string; tint: string;
  prev: number; curr: number; month: string; sort: number;
}
export interface AssetSnapshots {
  groups: { group: string; items: AssetSnapshotItem[]; prev: number; curr: number }[];
  prev: number; curr: number; delta: number; history: NetWorthPoint[];
  labels: { prev: string; curr: string; prevTh: string; currTh: string; lastUpdate: string };
}

export interface SetupGoalChannel { id: number; name: string; th: string; pct: number; }
export interface SetupGoal {
  id: number; kind: string; name: string; th: string; icon: string; tint: string;
  startDate: string; startTh: string; endDate: string; endTh: string; inflation: number;
  target: number; opening: number; currentAge?: number; retireAge?: number;
  useUntilAge?: number; monthlyNeed?: number; sort: number; channels: SetupGoalChannel[];
}
export interface Setup {
  incomeCategories: Category[]; expenseCategories: Category[];
  incomeSources: IncomeCategory[]; channels: Channel[]; accounts: Account[];
  debts: { closing: Debt[]; revolving: Debt[] };
  goals: { emergency: SetupGoal; stocks: SetupGoal; retirement: SetupGoal; custom: SetupGoal[] };
}

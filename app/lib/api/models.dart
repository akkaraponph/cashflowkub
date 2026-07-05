// API response shapes for the CashflowKub API.
// Dart port of mobile/src/lib/types.ts — one class per interface, each with a
// `fromJson` factory. Field names match the JSON keys returned by the Go API.

// --- parse helpers -----------------------------------------------------------

int _int(Object? v) => v is int ? v : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);
double _double(Object? v) =>
    v is double ? v : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);
String _str(Object? v) => v == null ? '' : '$v';
bool _bool(Object? v) => v == true;

List<T> _list<T>(Object? v, T Function(Map<String, dynamic>) f) => v is List
    ? v.map((e) => f((e as Map).cast<String, dynamic>())).toList()
    : <T>[];

Map<String, dynamic> _map(Object? v) =>
    v is Map ? v.cast<String, dynamic>() : <String, dynamic>{};

// --- entities ----------------------------------------------------------------

class Account {
  final int id;
  final String name, sub, icon, tint, kind, startDate, startTh;
  final double balance;
  final int sort;

  Account({
    required this.id,
    required this.name,
    required this.sub,
    required this.balance,
    required this.icon,
    required this.tint,
    required this.kind,
    required this.startDate,
    required this.startTh,
    required this.sort,
  });

  factory Account.fromJson(Map<String, dynamic> j) => Account(
        id: _int(j['id']),
        name: _str(j['name']),
        sub: _str(j['sub']),
        balance: _double(j['balance']),
        icon: _str(j['icon']),
        tint: _str(j['tint']),
        kind: _str(j['kind']),
        startDate: _str(j['startDate']),
        startTh: _str(j['startTh']),
        sort: _int(j['sort']),
      );
}

class Category {
  final int id;
  final String key, label, th, short, icon, tint, type, sub;
  final int sort;

  Category({
    required this.id,
    required this.key,
    required this.label,
    required this.th,
    required this.short,
    required this.icon,
    required this.tint,
    required this.type,
    required this.sub,
    required this.sort,
  });

  factory Category.fromJson(Map<String, dynamic> j) => Category(
        id: _int(j['id']),
        key: _str(j['key']),
        label: _str(j['label']),
        th: _str(j['th']),
        short: _str(j['short']),
        icon: _str(j['icon']),
        tint: _str(j['tint']),
        type: _str(j['type']),
        sub: _str(j['sub']),
        sort: _int(j['sort']),
      );
}

class Transaction {
  final int id;
  final String name, cat, acct, note, group, date;
  final double amount;

  Transaction({
    required this.id,
    required this.name,
    required this.cat,
    required this.acct,
    required this.amount,
    required this.note,
    required this.group,
    required this.date,
  });

  factory Transaction.fromJson(Map<String, dynamic> j) => Transaction(
        id: _int(j['id']),
        name: _str(j['name']),
        cat: _str(j['cat']),
        acct: _str(j['acct']),
        amount: _double(j['amount']),
        note: _str(j['note']),
        group: _str(j['group']),
        date: _str(j['date']),
      );
}

class Budget {
  final int id;
  final String cat;
  final double spent, limit;
  final int sort;

  Budget({
    required this.id,
    required this.cat,
    required this.spent,
    required this.limit,
    required this.sort,
  });

  factory Budget.fromJson(Map<String, dynamic> j) => Budget(
        id: _int(j['id']),
        cat: _str(j['cat']),
        spent: _double(j['spent']),
        limit: _double(j['limit']),
        sort: _int(j['sort']),
      );
}

class Goal {
  final int id;
  final String name, th, icon, by;
  final double saved, target, monthly;
  final int sort;

  Goal({
    required this.id,
    required this.name,
    required this.th,
    required this.icon,
    required this.saved,
    required this.target,
    required this.monthly,
    required this.by,
    required this.sort,
  });

  factory Goal.fromJson(Map<String, dynamic> j) => Goal(
        id: _int(j['id']),
        name: _str(j['name']),
        th: _str(j['th']),
        icon: _str(j['icon']),
        saved: _double(j['saved']),
        target: _double(j['target']),
        monthly: _double(j['monthly']),
        by: _str(j['by']),
        sort: _int(j['sort']),
      );
}

class Debt {
  final int id;
  final String name, th, icon, tint, calc, payoff, payoffTh;
  final double original, paid, apr, monthly, remaining, progress;
  final int monthsLeft, sort;
  final bool done, revolving;

  Debt({
    required this.id,
    required this.name,
    required this.th,
    required this.icon,
    required this.tint,
    required this.original,
    required this.paid,
    required this.apr,
    required this.monthly,
    required this.calc,
    required this.payoff,
    required this.payoffTh,
    required this.monthsLeft,
    required this.done,
    required this.revolving,
    required this.sort,
    required this.remaining,
    required this.progress,
  });

  factory Debt.fromJson(Map<String, dynamic> j) => Debt(
        id: _int(j['id']),
        name: _str(j['name']),
        th: _str(j['th']),
        icon: _str(j['icon']),
        tint: _str(j['tint']),
        original: _double(j['original']),
        paid: _double(j['paid']),
        apr: _double(j['apr']),
        monthly: _double(j['monthly']),
        calc: _str(j['calc']),
        payoff: _str(j['payoff']),
        payoffTh: _str(j['payoffTh']),
        monthsLeft: _int(j['monthsLeft']),
        done: _bool(j['done']),
        revolving: _bool(j['revolving']),
        sort: _int(j['sort']),
        remaining: _double(j['remaining']),
        progress: _double(j['progress']),
      );
}

class Asset {
  final int id;
  final String name, th, icon, tint;
  final double value;
  final int sort;

  Asset({
    required this.id,
    required this.name,
    required this.th,
    required this.icon,
    required this.tint,
    required this.value,
    required this.sort,
  });

  factory Asset.fromJson(Map<String, dynamic> j) => Asset(
        id: _int(j['id']),
        name: _str(j['name']),
        th: _str(j['th']),
        icon: _str(j['icon']),
        tint: _str(j['tint']),
        value: _double(j['value']),
        sort: _int(j['sort']),
      );
}

class Bill {
  final int id;
  final String name, th, icon, tint, freq, cat, status;
  final double amount;
  final int dueDay, sort, daysDiff;
  final bool paid;

  Bill({
    required this.id,
    required this.name,
    required this.th,
    required this.icon,
    required this.tint,
    required this.amount,
    required this.dueDay,
    required this.paid,
    required this.freq,
    required this.cat,
    required this.sort,
    required this.status,
    required this.daysDiff,
  });

  factory Bill.fromJson(Map<String, dynamic> j) => Bill(
        id: _int(j['id']),
        name: _str(j['name']),
        th: _str(j['th']),
        icon: _str(j['icon']),
        tint: _str(j['tint']),
        amount: _double(j['amount']),
        dueDay: _int(j['dueDay']),
        paid: _bool(j['paid']),
        freq: _str(j['freq']),
        cat: _str(j['cat']),
        sort: _int(j['sort']),
        status: _str(j['status']),
        daysDiff: _int(j['daysDiff']),
      );
}

class Channel {
  final int id;
  final String name, th, kind, icon, tint, startDate, startTh;
  final double opening;
  final int sort;

  Channel({
    required this.id,
    required this.name,
    required this.th,
    required this.kind,
    required this.icon,
    required this.tint,
    required this.opening,
    required this.startDate,
    required this.startTh,
    required this.sort,
  });

  factory Channel.fromJson(Map<String, dynamic> j) => Channel(
        id: _int(j['id']),
        name: _str(j['name']),
        th: _str(j['th']),
        kind: _str(j['kind']),
        icon: _str(j['icon']),
        tint: _str(j['tint']),
        opening: _double(j['opening']),
        startDate: _str(j['startDate']),
        startTh: _str(j['startTh']),
        sort: _int(j['sort']),
      );
}

class IncomeCategory {
  final int id;
  final String name, th, sub, icon, tint;
  final int sort;

  IncomeCategory({
    required this.id,
    required this.name,
    required this.th,
    required this.sub,
    required this.icon,
    required this.tint,
    required this.sort,
  });

  factory IncomeCategory.fromJson(Map<String, dynamic> j) => IncomeCategory(
        id: _int(j['id']),
        name: _str(j['name']),
        th: _str(j['th']),
        sub: _str(j['sub']),
        icon: _str(j['icon']),
        tint: _str(j['tint']),
        sort: _int(j['sort']),
      );
}

class PlanItem {
  final int id;
  final String type, name, th, icon, tint, cat, sub, month;
  final double planned, actual;
  final int sort;

  PlanItem({
    required this.id,
    required this.type,
    required this.name,
    required this.th,
    required this.icon,
    required this.tint,
    required this.cat,
    required this.sub,
    required this.planned,
    required this.actual,
    required this.month,
    required this.sort,
  });

  factory PlanItem.fromJson(Map<String, dynamic> j) => PlanItem(
        id: _int(j['id']),
        type: _str(j['type']),
        name: _str(j['name']),
        th: _str(j['th']),
        icon: _str(j['icon']),
        tint: _str(j['tint']),
        cat: _str(j['cat']),
        sub: _str(j['sub']),
        planned: _double(j['planned']),
        actual: _double(j['actual']),
        month: _str(j['month']),
        sort: _int(j['sort']),
      );
}

class MonthCashflow {
  final int id;
  final String month;
  final double income, expense;
  final int sort;

  MonthCashflow({
    required this.id,
    required this.month,
    required this.income,
    required this.expense,
    required this.sort,
  });

  factory MonthCashflow.fromJson(Map<String, dynamic> j) => MonthCashflow(
        id: _int(j['id']),
        month: _str(j['month']),
        income: _double(j['income']),
        expense: _double(j['expense']),
        sort: _int(j['sort']),
      );
}

class NetWorthPoint {
  final int id;
  final String month, monthTh;
  final double value;
  final int sort;

  NetWorthPoint({
    required this.id,
    required this.month,
    required this.monthTh,
    required this.value,
    required this.sort,
  });

  factory NetWorthPoint.fromJson(Map<String, dynamic> j) => NetWorthPoint(
        id: _int(j['id']),
        month: _str(j['month']),
        monthTh: _str(j['monthTh']),
        value: _double(j['value']),
        sort: _int(j['sort']),
      );
}

class CategorySpend {
  final String cat, label, th, tint, icon;
  final double spent, pct;

  CategorySpend({
    required this.cat,
    required this.label,
    required this.th,
    required this.tint,
    required this.icon,
    required this.spent,
    required this.pct,
  });

  factory CategorySpend.fromJson(Map<String, dynamic> j) => CategorySpend(
        cat: _str(j['cat']),
        label: _str(j['label']),
        th: _str(j['th']),
        tint: _str(j['tint']),
        icon: _str(j['icon']),
        spent: _double(j['spent']),
        pct: _double(j['pct']),
      );
}

// --- aggregates --------------------------------------------------------------

class MonthSummary {
  final double income, expense, net;

  MonthSummary({required this.income, required this.expense, required this.net});

  factory MonthSummary.fromJson(Map<String, dynamic> j) => MonthSummary(
        income: _double(j['income']),
        expense: _double(j['expense']),
        net: _double(j['net']),
      );
}

class DashboardDebt {
  final double original, paid, remaining, progress;
  final Debt? focus;

  DashboardDebt({
    required this.original,
    required this.paid,
    required this.remaining,
    required this.progress,
    required this.focus,
  });

  factory DashboardDebt.fromJson(Map<String, dynamic> j) => DashboardDebt(
        original: _double(j['original']),
        paid: _double(j['paid']),
        remaining: _double(j['remaining']),
        progress: _double(j['progress']),
        focus: j['focus'] == null ? null : Debt.fromJson(_map(j['focus'])),
      );
}

class Dashboard {
  final double netWorth, totalAssets, totalLiab, spendTotal;
  final MonthSummary month;
  final List<MonthCashflow> cashflow;
  final List<CategorySpend> spending;
  final DashboardDebt debt;
  final Bill? nextBill;
  final List<Goal> goals;
  final List<NetWorthPoint> netWorthHist;

  Dashboard({
    required this.netWorth,
    required this.totalAssets,
    required this.totalLiab,
    required this.month,
    required this.cashflow,
    required this.spending,
    required this.spendTotal,
    required this.debt,
    required this.nextBill,
    required this.goals,
    required this.netWorthHist,
  });

  factory Dashboard.fromJson(Map<String, dynamic> j) => Dashboard(
        netWorth: _double(j['netWorth']),
        totalAssets: _double(j['totalAssets']),
        totalLiab: _double(j['totalLiab']),
        month: MonthSummary.fromJson(_map(j['month'])),
        cashflow: _list(j['cashflow'], MonthCashflow.fromJson),
        spending: _list(j['spending'], CategorySpend.fromJson),
        spendTotal: _double(j['spendTotal']),
        debt: DashboardDebt.fromJson(_map(j['debt'])),
        nextBill: j['nextBill'] == null ? null : Bill.fromJson(_map(j['nextBill'])),
        goals: _list(j['goals'], Goal.fromJson),
        netWorthHist: _list(j['netWorthHist'], NetWorthPoint.fromJson),
      );
}

class NetWorth {
  final double netWorth, totalAssets, totalLiab;
  final List<Asset> assets;
  final List<Debt> liabilities;
  final List<NetWorthPoint> history;

  NetWorth({
    required this.netWorth,
    required this.totalAssets,
    required this.totalLiab,
    required this.assets,
    required this.liabilities,
    required this.history,
  });

  factory NetWorth.fromJson(Map<String, dynamic> j) => NetWorth(
        netWorth: _double(j['netWorth']),
        totalAssets: _double(j['totalAssets']),
        totalLiab: _double(j['totalLiab']),
        assets: _list(j['assets'], Asset.fromJson),
        liabilities: _list(j['liabilities'], Debt.fromJson),
        history: _list(j['history'], NetWorthPoint.fromJson),
      );
}

class TopMerchant {
  final String name, cat;
  final double total;

  TopMerchant({required this.name, required this.cat, required this.total});

  factory TopMerchant.fromJson(Map<String, dynamic> j) => TopMerchant(
        name: _str(j['name']),
        cat: _str(j['cat']),
        total: _double(j['total']),
      );
}

class Reports {
  final List<CategorySpend> breakdown;
  final double spendTotal;
  final List<TopMerchant> topMerchants;
  final List<MonthCashflow> monthly;

  Reports({
    required this.breakdown,
    required this.spendTotal,
    required this.topMerchants,
    required this.monthly,
  });

  factory Reports.fromJson(Map<String, dynamic> j) => Reports(
        breakdown: _list(j['breakdown'], CategorySpend.fromJson),
        spendTotal: _double(j['spendTotal']),
        topMerchants: _list(j['topMerchants'], TopMerchant.fromJson),
        monthly: _list(j['monthly'], MonthCashflow.fromJson),
      );
}

class ScheduleRow {
  final int month;
  final double payment, principal, interest, balance;

  ScheduleRow({
    required this.month,
    required this.payment,
    required this.principal,
    required this.interest,
    required this.balance,
  });

  factory ScheduleRow.fromJson(Map<String, dynamic> j) => ScheduleRow(
        month: _int(j['month']),
        payment: _double(j['payment']),
        principal: _double(j['principal']),
        interest: _double(j['interest']),
        balance: _double(j['balance']),
      );
}

class DebtSchedule {
  final Debt debt;
  final List<ScheduleRow> schedule;
  final double totalInterest;
  final int months;

  DebtSchedule({
    required this.debt,
    required this.schedule,
    required this.totalInterest,
    required this.months,
  });

  factory DebtSchedule.fromJson(Map<String, dynamic> j) => DebtSchedule(
        debt: Debt.fromJson(_map(j['debt'])),
        schedule: _list(j['schedule'], ScheduleRow.fromJson),
        totalInterest: _double(j['totalInterest']),
        months: _int(j['months']),
      );
}

class DaySpend {
  final int id, day;
  final double amount;
  final String month;

  DaySpend({
    required this.id,
    required this.day,
    required this.amount,
    required this.month,
  });

  factory DaySpend.fromJson(Map<String, dynamic> j) => DaySpend(
        id: _int(j['id']),
        day: _int(j['day']),
        amount: _double(j['amount']),
        month: _str(j['month']),
      );
}

class BillsSummary {
  final double total, paid, remaining, today;
  final int count;
  final String month;
  final Bill? nextBill;
  final List<DaySpend> daySpend;

  BillsSummary({
    required this.total,
    required this.paid,
    required this.remaining,
    required this.count,
    required this.month,
    required this.today,
    required this.nextBill,
    required this.daySpend,
  });

  factory BillsSummary.fromJson(Map<String, dynamic> j) => BillsSummary(
        total: _double(j['total']),
        paid: _double(j['paid']),
        remaining: _double(j['remaining']),
        count: _int(j['count']),
        month: _str(j['month']),
        today: _double(j['today']),
        nextBill: j['nextBill'] == null ? null : Bill.fromJson(_map(j['nextBill'])),
        daySpend: _list(j['daySpend'], DaySpend.fromJson),
      );
}

class PlanGroup {
  final String type;
  final List<PlanItem> items;
  final double totalPlanned, totalActual, variance;

  PlanGroup({
    required this.type,
    required this.items,
    required this.totalPlanned,
    required this.totalActual,
    required this.variance,
  });

  factory PlanGroup.fromJson(Map<String, dynamic> j) => PlanGroup(
        type: _str(j['type']),
        items: _list(j['items'], PlanItem.fromJson),
        totalPlanned: _double(j['totalPlanned']),
        totalActual: _double(j['totalActual']),
        variance: _double(j['variance']),
      );
}

class PlanSummary {
  final double plannedNet, actualNet, netVariance, incomeRatio, expenseUsage, savingsRatio;

  PlanSummary({
    required this.plannedNet,
    required this.actualNet,
    required this.netVariance,
    required this.incomeRatio,
    required this.expenseUsage,
    required this.savingsRatio,
  });

  factory PlanSummary.fromJson(Map<String, dynamic> j) => PlanSummary(
        plannedNet: _double(j['plannedNet']),
        actualNet: _double(j['actualNet']),
        netVariance: _double(j['netVariance']),
        incomeRatio: _double(j['incomeRatio']),
        expenseUsage: _double(j['expenseUsage']),
        savingsRatio: _double(j['savingsRatio']),
      );
}

class Plan {
  final PlanGroup income, expense, savings;
  final PlanSummary summary;

  Plan({
    required this.income,
    required this.expense,
    required this.savings,
    required this.summary,
  });

  factory Plan.fromJson(Map<String, dynamic> j) => Plan(
        income: PlanGroup.fromJson(_map(j['income'])),
        expense: PlanGroup.fromJson(_map(j['expense'])),
        savings: PlanGroup.fromJson(_map(j['savings'])),
        summary: PlanSummary.fromJson(_map(j['summary'])),
      );
}

class AssetSnapshotItem {
  final int id;
  final String name, th, group, icon, tint, month;
  final double prev, curr;
  final int sort;

  AssetSnapshotItem({
    required this.id,
    required this.name,
    required this.th,
    required this.group,
    required this.icon,
    required this.tint,
    required this.prev,
    required this.curr,
    required this.month,
    required this.sort,
  });

  factory AssetSnapshotItem.fromJson(Map<String, dynamic> j) => AssetSnapshotItem(
        id: _int(j['id']),
        name: _str(j['name']),
        th: _str(j['th']),
        group: _str(j['group']),
        icon: _str(j['icon']),
        tint: _str(j['tint']),
        prev: _double(j['prev']),
        curr: _double(j['curr']),
        month: _str(j['month']),
        sort: _int(j['sort']),
      );
}

class AssetSnapshotGroup {
  final String group;
  final List<AssetSnapshotItem> items;
  final double prev, curr;

  AssetSnapshotGroup({
    required this.group,
    required this.items,
    required this.prev,
    required this.curr,
  });

  factory AssetSnapshotGroup.fromJson(Map<String, dynamic> j) => AssetSnapshotGroup(
        group: _str(j['group']),
        items: _list(j['items'], AssetSnapshotItem.fromJson),
        prev: _double(j['prev']),
        curr: _double(j['curr']),
      );
}

class AssetSnapshotLabels {
  final String prev, curr, prevTh, currTh, lastUpdate;

  AssetSnapshotLabels({
    required this.prev,
    required this.curr,
    required this.prevTh,
    required this.currTh,
    required this.lastUpdate,
  });

  factory AssetSnapshotLabels.fromJson(Map<String, dynamic> j) => AssetSnapshotLabels(
        prev: _str(j['prev']),
        curr: _str(j['curr']),
        prevTh: _str(j['prevTh']),
        currTh: _str(j['currTh']),
        lastUpdate: _str(j['lastUpdate']),
      );
}

class AssetSnapshots {
  final List<AssetSnapshotGroup> groups;
  final double prev, curr, delta;
  final List<NetWorthPoint> history;
  final AssetSnapshotLabels labels;

  AssetSnapshots({
    required this.groups,
    required this.prev,
    required this.curr,
    required this.delta,
    required this.history,
    required this.labels,
  });

  factory AssetSnapshots.fromJson(Map<String, dynamic> j) => AssetSnapshots(
        groups: _list(j['groups'], AssetSnapshotGroup.fromJson),
        prev: _double(j['prev']),
        curr: _double(j['curr']),
        delta: _double(j['delta']),
        history: _list(j['history'], NetWorthPoint.fromJson),
        labels: AssetSnapshotLabels.fromJson(_map(j['labels'])),
      );
}

// --- setup -------------------------------------------------------------------

class SetupGoalChannel {
  final int id;
  final String name, th;
  final double pct;

  SetupGoalChannel({
    required this.id,
    required this.name,
    required this.th,
    required this.pct,
  });

  factory SetupGoalChannel.fromJson(Map<String, dynamic> j) => SetupGoalChannel(
        id: _int(j['id']),
        name: _str(j['name']),
        th: _str(j['th']),
        pct: _double(j['pct']),
      );
}

class SetupGoal {
  final int id;
  final String kind, name, th, icon, tint, startDate, startTh, endDate, endTh;
  final double inflation, target, opening;
  final int? currentAge, retireAge, useUntilAge;
  final double? monthlyNeed;
  final int sort;
  final List<SetupGoalChannel> channels;

  SetupGoal({
    required this.id,
    required this.kind,
    required this.name,
    required this.th,
    required this.icon,
    required this.tint,
    required this.startDate,
    required this.startTh,
    required this.endDate,
    required this.endTh,
    required this.inflation,
    required this.target,
    required this.opening,
    required this.currentAge,
    required this.retireAge,
    required this.useUntilAge,
    required this.monthlyNeed,
    required this.sort,
    required this.channels,
  });

  factory SetupGoal.fromJson(Map<String, dynamic> j) => SetupGoal(
        id: _int(j['id']),
        kind: _str(j['kind']),
        name: _str(j['name']),
        th: _str(j['th']),
        icon: _str(j['icon']),
        tint: _str(j['tint']),
        startDate: _str(j['startDate']),
        startTh: _str(j['startTh']),
        endDate: _str(j['endDate']),
        endTh: _str(j['endTh']),
        inflation: _double(j['inflation']),
        target: _double(j['target']),
        opening: _double(j['opening']),
        currentAge: j['currentAge'] == null ? null : _int(j['currentAge']),
        retireAge: j['retireAge'] == null ? null : _int(j['retireAge']),
        useUntilAge: j['useUntilAge'] == null ? null : _int(j['useUntilAge']),
        monthlyNeed: j['monthlyNeed'] == null ? null : _double(j['monthlyNeed']),
        sort: _int(j['sort']),
        channels: _list(j['channels'], SetupGoalChannel.fromJson),
      );
}

class SetupDebts {
  final List<Debt> closing, revolving;

  SetupDebts({required this.closing, required this.revolving});

  factory SetupDebts.fromJson(Map<String, dynamic> j) => SetupDebts(
        closing: _list(j['closing'], Debt.fromJson),
        revolving: _list(j['revolving'], Debt.fromJson),
      );
}

class SetupGoals {
  final SetupGoal emergency, stocks, retirement;
  final List<SetupGoal> custom;

  SetupGoals({
    required this.emergency,
    required this.stocks,
    required this.retirement,
    required this.custom,
  });

  factory SetupGoals.fromJson(Map<String, dynamic> j) => SetupGoals(
        emergency: SetupGoal.fromJson(_map(j['emergency'])),
        stocks: SetupGoal.fromJson(_map(j['stocks'])),
        retirement: SetupGoal.fromJson(_map(j['retirement'])),
        custom: _list(j['custom'], SetupGoal.fromJson),
      );
}

class Setup {
  final List<Category> incomeCategories, expenseCategories;
  final List<IncomeCategory> incomeSources;
  final List<Channel> channels;
  final List<Account> accounts;
  final SetupDebts debts;
  final SetupGoals goals;

  Setup({
    required this.incomeCategories,
    required this.expenseCategories,
    required this.incomeSources,
    required this.channels,
    required this.accounts,
    required this.debts,
    required this.goals,
  });

  factory Setup.fromJson(Map<String, dynamic> j) => Setup(
        incomeCategories: _list(j['incomeCategories'], Category.fromJson),
        expenseCategories: _list(j['expenseCategories'], Category.fromJson),
        incomeSources: _list(j['incomeSources'], IncomeCategory.fromJson),
        channels: _list(j['channels'], Channel.fromJson),
        accounts: _list(j['accounts'], Account.fromJson),
        debts: SetupDebts.fromJson(_map(j['debts'])),
        goals: SetupGoals.fromJson(_map(j['goals'])),
      );
}

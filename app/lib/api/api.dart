// Typed CashflowKub API — one method per endpoint.
// Dart port of the query/mutation functions in mobile/src/lib/hooks.ts.

import 'api_client.dart';
import 'models.dart';

export 'api_client.dart' show ApiClient, ApiError;
export 'models.dart';

/// Payload for creating a transaction (mirrors `NewTx` in hooks.ts).
class NewTransaction {
  final String name, cat, acct;
  final double amount;
  final String? note, date;

  NewTransaction({
    required this.name,
    required this.cat,
    required this.acct,
    required this.amount,
    this.note,
    this.date,
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'cat': cat,
        'acct': acct,
        'amount': amount,
        if (note != null) 'note': note,
        if (date != null) 'date': date,
      };
}

class CashflowApi {
  CashflowApi({ApiClient? client}) : _c = client ?? ApiClient();

  final ApiClient _c;

  Map<String, dynamic> _obj(dynamic v) => (v as Map).cast<String, dynamic>();

  // --- queries ---------------------------------------------------------------

  Future<Dashboard> dashboard() async =>
      Dashboard.fromJson(_obj(await _c.get('/dashboard')));

  Future<List<Transaction>> transactions({String? filter}) async {
    final rows = await _c.getList('/transactions${filter != null ? '?$filter' : ''}');
    return rows.map(Transaction.fromJson).toList();
  }

  Future<List<Account>> accounts() async =>
      (await _c.getList('/accounts')).map(Account.fromJson).toList();

  Future<List<Category>> categories() async =>
      (await _c.getList('/categories')).map(Category.fromJson).toList();

  Future<List<Budget>> budgets() async =>
      (await _c.getList('/budgets')).map(Budget.fromJson).toList();

  Future<List<Goal>> goals() async =>
      (await _c.getList('/goals')).map(Goal.fromJson).toList();

  Future<List<Channel>> channels() async =>
      (await _c.getList('/channels')).map(Channel.fromJson).toList();

  /// [status] may be `active` or `paid`.
  Future<List<Debt>> debts({String? status}) async {
    final rows = await _c.getList('/debts${status != null ? '?status=$status' : ''}');
    return rows.map(Debt.fromJson).toList();
  }

  Future<Debt> debt(Object id) async =>
      Debt.fromJson(_obj(await _c.get('/debts/$id')));

  Future<DebtSchedule> debtSchedule(Object id) async =>
      DebtSchedule.fromJson(_obj(await _c.get('/debts/$id/schedule')));

  /// [status] may be `paid` or `unpaid`.
  Future<List<Bill>> bills({String? status}) async {
    final rows = await _c.getList('/bills${status != null ? '?status=$status' : ''}');
    return rows.map(Bill.fromJson).toList();
  }

  Future<BillsSummary> billsSummary() async =>
      BillsSummary.fromJson(_obj(await _c.get('/bills/summary')));

  Future<NetWorth> netWorth() async =>
      NetWorth.fromJson(_obj(await _c.get('/networth')));

  Future<Reports> reports() async =>
      Reports.fromJson(_obj(await _c.get('/reports')));

  Future<Plan> plan() async => Plan.fromJson(_obj(await _c.get('/plan')));

  Future<AssetSnapshots> assetSnapshots() async =>
      AssetSnapshots.fromJson(_obj(await _c.get('/plan/snapshots')));

  Future<Setup> setup() async => Setup.fromJson(_obj(await _c.get('/setup')));

  // --- mutations -------------------------------------------------------------

  Future<Transaction> createTransaction(NewTransaction tx) async =>
      Transaction.fromJson(_obj(await _c.post('/transactions', tx.toJson())));

  /// Toggle when [paid] is null, or set it explicitly.
  Future<Bill> toggleBillPaid(int id, {bool? paid}) async => Bill.fromJson(
        _obj(await _c.patch('/bills/$id/pay', paid == null ? {} : {'paid': paid})),
      );

  /// Pay the scheduled [amount], or the default monthly amount when null.
  Future<Debt> payDebt(int id, {double? amount}) async => Debt.fromJson(
        _obj(await _c.post('/debts/$id/pay', amount != null ? {'amount': amount} : {})),
      );

  void close() => _c.close();
}

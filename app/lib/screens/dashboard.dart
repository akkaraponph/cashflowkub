// Dashboard — Dart port of mobile/src/app/(tabs)/index.tsx.

import 'package:flutter/material.dart';

import '../api/api.dart';
import '../api/instance.dart';
import '../theme/format.dart';
import '../theme/palette.dart';
import '../widgets/app_header.dart';
import '../widgets/app_icon.dart';
import '../widgets/charts.dart';
import '../widgets/ui.dart';

class _DashData {
  final Dashboard dash;
  final List<Transaction> recent;
  final List<Budget> budgets;
  final Map<String, Category> catMap;
  _DashData(this.dash, this.recent, this.budgets, this.catMap);
}

Future<_DashData> _load() async {
  final results = await Future.wait([
    cfkApi.dashboard(),
    cfkApi.transactions(filter: 'limit=5'),
    cfkApi.budgets(),
    cfkApi.categories(),
  ]);
  final cats = results[3] as List<Category>;
  return _DashData(
    results[0] as Dashboard,
    results[1] as List<Transaction>,
    results[2] as List<Budget>,
    {for (final c in cats) c.key: c},
  );
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<_DashData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<void> _refresh() async {
    final f = _load();
    setState(() => _future = f);
    await f;
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return Column(
      children: [
        AppHeader(t.nav('dashboard')),
        Expanded(
          child: FutureBuilder<_DashData>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
              if (snap.hasError || !snap.hasData) {
                return ErrorView(message: snap.error?.toString(), onRetry: _refresh);
              }
              return _DashboardBody(data: snap.data!, onRefresh: _refresh);
            },
          ),
        ),
      ],
    );
  }
}

class _DashboardBody extends StatelessWidget {
  final _DashData data;
  final Future<void> Function() onRefresh;
  const _DashboardBody({required this.data, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final isTh = context.isTh;
    final p = context.palette;
    final mode = context.mode;
    final hero = heroOf(mode);
    final d = data.dash;

    return ScreenBody(
      onRefresh: onRefresh,
      children: [
        // Greeting
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppText(t['greeting'], variant: TextV.h1),
            const SizedBox(height: 2),
            AppText(t['today'], variant: TextV.meta, size: 14),
          ],
        ),

        // Hero net worth
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [hero.from, hero.to],
              begin: const Alignment(-0.8, -1),
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppText(t['netWorth'],
                  size: 13, weight: FontWeight.w600, letterSpacing: 1, color: hero.fg.withValues(alpha: 0.7)),
              const SizedBox(height: 8),
              AppText(fmt(d.netWorth), size: 40, weight: FontWeight.w800, tabular: true, color: hero.fg),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AppIcon('trending-up', size: 15, color: hero.fg),
                    const SizedBox(width: 6),
                    AppText('${signed(d.month.net)} ${t['thisMonth']}',
                        size: 13, weight: FontWeight.w600, color: hero.fg),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Stat cards
        Row(
          children: [
            Expanded(child: _StatCard('arrow-down-left', 'xls', t['income'], fmt(d.month.income), p.xlsFg)),
            const SizedBox(width: 12),
            Expanded(child: _StatCard('arrow-up-right', 'pdf', t['expenses'], fmt(d.month.expense), null)),
          ],
        ),
        _StatCard('wallet', 'doc', '${t['net']} · ${t['thisMonth']}', signed(d.month.net), p.xlsFg),

        // Cashflow
        CfkCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [AppText(t['cashflow'], variant: TextV.title), AppText(t['last6'], variant: TextV.meta)],
              ),
              const SizedBox(height: 16),
              CashflowBars(d.cashflow.map((m) => CashflowPoint(m.month, m.income, m.expense)).toList()),
              const SizedBox(height: 12),
              Row(children: [
                _Legend(p.xlsFg, t['income']),
                const SizedBox(width: 16),
                _Legend(p.foreground, t['expenses']),
              ]),
            ],
          ),
        ),

        // Spending donut
        CfkCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppText(t['spending'], variant: TextV.title),
              const SizedBox(height: 16),
              Row(
                children: [
                  Donut(
                    d.spending.map((s) => DonutSegment(s.spent, tintOf(s.tint, mode).fg)).toList(),
                    centerLabel: t['spent'],
                    centerValue: compact(d.spendTotal),
                  ),
                  const SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      children: [
                        for (final s in d.spending)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Row(
                              children: [
                                _Dot(tintOf(s.tint, mode).fg),
                                const SizedBox(width: 8),
                                Expanded(child: AppText(isTh ? s.th : s.label, size: 13, maxLines: 1)),
                                AppText('${s.pct.round()}%', variant: TextV.meta, tabular: true),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Next bill
        if (d.nextBill != null)
          _Tap(
            onTap: () {},
            child: CfkCard(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CfkTile(d.nextBill!.icon, tint: d.nextBill!.tint),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AppText(t['nextBill'], variant: TextV.eyebrow),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Flexible(
                                child: AppText(isTh ? d.nextBill!.th : d.nextBill!.name,
                                    size: 15, weight: FontWeight.w700, maxLines: 1)),
                            const SizedBox(width: 8),
                            CfkBadge(d.nextBill!.status == 'overdue' ? t['overdue'] : t['dueSoon'],
                                tone: d.nextBill!.status == 'overdue' ? Tone.danger : Tone.warning),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      AppText(fmt(d.nextBill!.amount), size: 18, weight: FontWeight.w800, tabular: true),
                      AppText('${t['dueOn']} ${d.nextBill!.dueDay}', variant: TextV.meta),
                    ],
                  ),
                ],
              ),
            ),
          ),

        // Debt quick card
        _Tap(
          onTap: () {},
          child: CfkCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CardHeader(t.nav('debts'), t['viewAll']),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Donut(
                      [
                        DonutSegment(d.debt.progress, p.primary),
                        DonutSegment(1 - d.debt.progress, p.secondary),
                      ],
                      size: 86,
                      stroke: 11,
                      centerValue: '${(d.debt.progress * 100).round()}%',
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AppText(t['totalDebt'], variant: TextV.eyebrow),
                          AppText(fmt(d.debt.remaining), size: 24, weight: FontWeight.w800, tabular: true),
                          AppText('${t['of']} ${fmt(d.debt.original)}', variant: TextV.meta, tabular: true),
                        ],
                      ),
                    ),
                  ],
                ),
                if (d.debt.focus != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: p.secondary, borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      children: [
                        CfkTile(d.debt.focus!.icon, tint: d.debt.focus!.tint, size: 32),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              AppText('Pay first · ${d.debt.focus!.apr}% APR', variant: TextV.eyebrow),
                              AppText(isTh ? d.debt.focus!.th : d.debt.focus!.name,
                                  size: 13, weight: FontWeight.w600, maxLines: 1),
                            ],
                          ),
                        ),
                        AppText(fmt(d.debt.focus!.remaining), size: 13, weight: FontWeight.w700, tabular: true),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),

        // Net worth quick card
        _Tap(
          onTap: () {},
          child: CfkCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CardHeader(t['netWorth'], t['viewAll']),
                const SizedBox(height: 14),
                AppText(fmt(d.netWorth), size: 30, weight: FontWeight.w800, tabular: true),
                const SizedBox(height: 8),
                Row(children: [
                  AppText('+${fmt(d.totalAssets)} ${t['assets']}', size: 12, weight: FontWeight.w600, color: p.xlsFg),
                  const SizedBox(width: 16),
                  AppText('-${fmt(d.totalLiab)} ${t['liabilities']}',
                      size: 12, weight: FontWeight.w600, color: p.destructive),
                ]),
                const SizedBox(height: 14),
                MiniBars(d.netWorthHist.map((e) => e.value).toList()),
              ],
            ),
          ),
        ),

        // Budgets preview
        CfkCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CardHeader(t['budgetsTitle'], t['viewAll']),
              const SizedBox(height: 12),
              for (final b in data.budgets.take(4))
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _BudgetRow(b, data.catMap[b.cat], isTh, p),
                ),
            ],
          ),
        ),

        // Recent transactions
        CfkCard(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: _CardHeader(t['recent'], t['viewAll']),
              ),
              for (final tx in data.recent) _TxRow(tx, data.catMap[tx.cat], p),
            ],
          ),
        ),

        // Goals
        CfkCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CardHeader(t['goalsTitle'], t['viewAll']),
              const SizedBox(height: 12),
              for (final g in d.goals)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _GoalRow(g, isTh, t['of']),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String icon, tint, label, value;
  final Color? valueColor;
  const _StatCard(this.icon, this.tint, this.label, this.value, this.valueColor);
  @override
  Widget build(BuildContext context) => CfkCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              CfkTile(icon, tint: tint, size: 34, radius: 10),
              const SizedBox(width: 10),
              Flexible(child: AppText(label, variant: TextV.label, maxLines: 1)),
            ]),
            const SizedBox(height: 12),
            AppText(value, size: 24, weight: FontWeight.w700, tabular: true, color: valueColor),
          ],
        ),
      );
}

class _CardHeader extends StatelessWidget {
  final String title, viewAll;
  const _CardHeader(this.title, this.viewAll);
  @override
  Widget build(BuildContext context) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          AppText(title, variant: TextV.title),
          Row(children: [
            AppText(viewAll, variant: TextV.meta),
            const SizedBox(width: 4),
            AppIcon('chevron-right', size: 14, color: context.palette.mutedForeground),
          ]),
        ],
      );
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  const _Legend(this.color, this.label);
  @override
  Widget build(BuildContext context) => Row(children: [
        _Dot(color),
        const SizedBox(width: 6),
        AppText(label, variant: TextV.meta),
      ]);
}

class _Dot extends StatelessWidget {
  final Color color;
  const _Dot(this.color);
  @override
  Widget build(BuildContext context) =>
      Container(width: 9, height: 9, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)));
}

class _BudgetRow extends StatelessWidget {
  final Budget b;
  final Category? cat;
  final bool isTh;
  final Palette p;
  const _BudgetRow(this.b, this.cat, this.isTh, this.p);
  @override
  Widget build(BuildContext context) {
    final ratio = b.limit == 0 ? 0.0 : b.spent / b.limit;
    final over = ratio > 1;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            AppText(cat != null ? (isTh ? cat!.th : cat!.label) : b.cat, size: 13, weight: FontWeight.w600),
            AppText('${fmt(b.spent)} / ${fmt(b.limit)}', variant: TextV.meta, tabular: true),
          ],
        ),
        const SizedBox(height: 6),
        Progress(ratio, fill: over ? p.destructive : p.primary),
      ],
    );
  }
}

class _TxRow extends StatelessWidget {
  final Transaction tx;
  final Category? cat;
  final Palette p;
  const _TxRow(this.tx, this.cat, this.p);
  @override
  Widget build(BuildContext context) {
    final income = tx.amount >= 0;
    return Container(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: p.border))),
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          CfkTile(cat?.icon ?? 'circle', tint: cat?.tint ?? 'doc'),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppText(tx.name, size: 14, weight: FontWeight.w600, maxLines: 1),
                AppText(tx.acct, variant: TextV.meta),
              ],
            ),
          ),
          AppText(income ? signed(tx.amount) : '-${fmt(tx.amount)}',
              size: 14, weight: FontWeight.w700, tabular: true, color: income ? p.xlsFg : p.foreground),
        ],
      ),
    );
  }
}

class _GoalRow extends StatelessWidget {
  final Goal g;
  final bool isTh;
  final String ofLabel;
  const _GoalRow(this.g, this.isTh, this.ofLabel);
  @override
  Widget build(BuildContext context) {
    final ratio = g.target == 0 ? 0.0 : g.saved / g.target;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          CfkTile(g.icon, tint: 'xls', size: 32),
          const SizedBox(width: 10),
          Expanded(child: AppText(isTh ? g.th : g.name, size: 14, weight: FontWeight.w600)),
          AppText('${(ratio * 100).round()}%', variant: TextV.meta, tabular: true),
        ]),
        const SizedBox(height: 6),
        Progress(ratio),
        const SizedBox(height: 4),
        AppText('${fmt(g.saved)} $ofLabel ${fmt(g.target)}', variant: TextV.meta, tabular: true),
      ],
    );
  }
}

class _Tap extends StatelessWidget {
  final Widget child;
  final VoidCallback onTap;
  const _Tap({required this.child, required this.onTap});
  @override
  Widget build(BuildContext context) =>
      GestureDetector(onTap: onTap, behavior: HitTestBehavior.opaque, child: child);
}

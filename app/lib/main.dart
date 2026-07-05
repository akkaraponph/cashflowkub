import 'package:flutter/material.dart';

import 'screens/dashboard.dart';
import 'screens/placeholder.dart';
import 'state/prefs.dart';
import 'theme/palette.dart';
import 'widgets/app_icon.dart';
import 'widgets/ui.dart';

void main() => runApp(CashflowKubApp(prefs: AppPrefs()));

class CashflowKubApp extends StatelessWidget {
  final AppPrefs prefs;
  const CashflowKubApp({super.key, required this.prefs});

  @override
  Widget build(BuildContext context) {
    return PrefsScope(
      prefs: prefs,
      child: AnimatedBuilder(
        animation: prefs,
        builder: (context, _) {
          final p = paletteOf(prefs.theme);
          return MaterialApp(
            title: 'CashflowKub',
            debugShowCheckedModeBanner: false,
            theme: ThemeData(
              useMaterial3: true,
              brightness: prefs.theme == Mode.light ? Brightness.light : Brightness.dark,
              scaffoldBackgroundColor: p.background,
              colorScheme: ColorScheme.fromSeed(
                seedColor: p.primary,
                brightness: prefs.theme == Mode.light ? Brightness.light : Brightness.dark,
              ),
            ),
            home: const HomeShell(),
          );
        },
      ),
    );
  }
}

/// Bottom-tab shell with the center Add FAB — port of (tabs)/_layout + TabBar.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _tabs = ['dashboard', 'bills', 'debts', 'networth'];
  static const _icons = ['layout-dashboard', 'calendar-clock', 'trending-down', 'scale'];

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final t = context.t;

    final pages = [
      const DashboardScreen(),
      PlaceholderScreen(t.nav('bills')),
      PlaceholderScreen(t.nav('debts')),
      PlaceholderScreen(t.nav('networth')),
    ];

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(bottom: false, child: IndexedStack(index: _index, children: pages)),
      floatingActionButton: _AddFab(onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Add — coming soon')));
      }),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: _BottomBar(
        index: _index,
        tabs: _tabs,
        icons: _icons,
        onTap: (i) => setState(() => _index = i),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  final int index;
  final List<String> tabs;
  final List<String> icons;
  final ValueChanged<int> onTap;
  const _BottomBar({required this.index, required this.tabs, required this.icons, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final t = context.t;
    Widget tab(int i) {
      final focused = index == i;
      final color = focused ? p.foreground : p.mutedForeground;
      return Expanded(
        child: InkWell(
          onTap: () => onTap(i),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AppIcon(icons[i], size: 21, color: color),
              const SizedBox(height: 4),
              AppText(t.nav(tabs[i]), size: 10, color: color),
            ],
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(color: p.card, border: Border(top: BorderSide(color: p.border))),
      padding: EdgeInsets.only(top: 8, bottom: MediaQuery.of(context).padding.bottom.clamp(10, 40)),
      child: SizedBox(
        height: 52,
        child: Row(children: [tab(0), tab(1), const SizedBox(width: 64), tab(2), tab(3)]),
      ),
    );
  }
}

class _AddFab extends StatelessWidget {
  final VoidCallback onTap;
  const _AddFab({required this.onTap});
  @override
  Widget build(BuildContext context) {
    final hero = heroOf(context.mode);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [hero.from, hero.to], begin: Alignment.topLeft, end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(18),
          boxShadow: [BoxShadow(color: hero.from.withValues(alpha: 0.4), blurRadius: 12, offset: const Offset(0, 6))],
        ),
        child: const Icon(Icons.add, size: 26, color: Colors.white),
      ),
    );
  }
}

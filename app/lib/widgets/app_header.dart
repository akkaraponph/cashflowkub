// Top app bar — Dart port of mobile/src/components/AppHeader.tsx.
// Brand mark, title, year switcher, EN/TH + theme toggles, menu button.

import 'package:flutter/material.dart';

import '../state/prefs.dart';
import '../theme/palette.dart';
import 'app_icon.dart';
import 'ui.dart';

class _HeaderButton extends StatelessWidget {
  final String? icon;
  final String? label;
  final VoidCallback onTap;
  const _HeaderButton({this.icon, this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 36,
        constraints: const BoxConstraints(minWidth: 36),
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: p.secondary,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: p.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) AppIcon(icon!, size: 17, color: p.foreground),
            if (label != null) AppText(label!, size: 12, weight: FontWeight.w600),
          ],
        ),
      ),
    );
  }
}

class AppHeader extends StatelessWidget {
  final String title;
  final bool back;
  final VoidCallback? onMenu;
  const AppHeader(this.title, {super.key, this.back = false, this.onMenu});

  @override
  Widget build(BuildContext context) {
    final prefs = context.prefs;
    final p = context.palette;
    final brand = brandOf(prefs.theme);
    final yearIdx = years.indexOf(prefs.year);

    return Container(
      color: p.background,
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 6, left: 16, right: 16, bottom: 12),
      child: Row(
        children: [
          if (back)
            _SquareButton(
              icon: 'chevron-left',
              onTap: () => Navigator.of(context).maybePop(),
            )
          else
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [brand.from, brand.to], begin: Alignment.topLeft, end: Alignment.bottomRight),
                borderRadius: BorderRadius.circular(9),
              ),
              alignment: Alignment.center,
              child: const Text('C', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
            ),
          const SizedBox(width: 10),
          Expanded(child: AppText(title, variant: TextV.h2, size: 17, maxLines: 1)),
          const SizedBox(width: 8),
          // Year switcher
          Container(
            decoration: BoxDecoration(
              color: p.secondary,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: p.border),
            ),
            child: Row(
              children: [
                InkWell(
                  onTap: yearIdx > 0 ? () => prefs.setYear(years[yearIdx - 1]) : null,
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: AppIcon('chevron-left', size: 15, color: yearIdx <= 0 ? p.border : p.mutedForeground),
                  ),
                ),
                AppText('${prefs.year}', size: 12, weight: FontWeight.w700, tabular: true),
                InkWell(
                  onTap: yearIdx < years.length - 1 ? () => prefs.setYear(years[yearIdx + 1]) : null,
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: AppIcon('chevron-right',
                        size: 15, color: yearIdx >= years.length - 1 ? p.border : p.mutedForeground),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _HeaderButton(label: prefs.lang == Lang.en ? 'EN' : 'TH', onTap: prefs.toggleLang),
          const SizedBox(width: 8),
          _HeaderButton(icon: prefs.theme == Mode.light ? 'moon' : 'sun', onTap: prefs.toggleTheme),
          const SizedBox(width: 8),
          _HeaderButton(
            icon: 'menu',
            onTap: onMenu ??
                () => ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Menu — coming soon')),
                    ),
          ),
        ],
      ),
    );
  }
}

class _SquareButton extends StatelessWidget {
  final String icon;
  final VoidCallback onTap;
  const _SquareButton({required this.icon, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: p.secondary,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: p.border),
        ),
        child: AppIcon(icon, size: 20, color: p.foreground),
      ),
    );
  }
}

/// Themed scrollable page body with pull-to-refresh. Pages render their own
/// header above this. Children are laid out in a column with 16px gaps.
class ScreenBody extends StatelessWidget {
  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final double bottomPad;
  const ScreenBody({super.key, required this.children, this.onRefresh, this.bottomPad = 24});

  @override
  Widget build(BuildContext context) {
    final spaced = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) spaced.add(const SizedBox(height: 16));
      spaced.add(children[i]);
    }
    final list = ListView(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPad),
      children: spaced,
    );
    if (onRefresh == null) return list;
    return RefreshIndicator(onRefresh: onRefresh!, color: context.palette.primary, child: list);
  }
}

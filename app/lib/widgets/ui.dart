// Core UI primitives — Dart port of mobile/src/components/ui/*.
// Text, Card, Tile, Badge, Progress, SplitBar, and page-state views.

import 'package:flutter/material.dart';

import '../i18n/strings.dart';
import '../state/prefs.dart';
import '../theme/format.dart';
import '../theme/palette.dart';
import 'app_icon.dart';

/// Convenience accessors off BuildContext.
extension CfkContext on BuildContext {
  AppPrefs get prefs => PrefsScope.of(this);
  Palette get palette => PrefsScope.of(this).colors;
  Mode get mode => PrefsScope.of(this).theme;
  L10n get t => L10n.of(PrefsScope.of(this).lang);
  bool get isTh => PrefsScope.of(this).lang == Lang.th;
}

const _tabular = [FontFeature.tabularFigures()];

enum TextV { body, h1, h2, h3, title, label, meta, eyebrow, amount }

class AppText extends StatelessWidget {
  final String data;
  final TextV variant;
  final bool tabular;
  final Color? color;
  final double? size;
  final FontWeight? weight;
  final int? maxLines;
  final double? letterSpacing;
  const AppText(
    this.data, {
    super.key,
    this.variant = TextV.body,
    this.tabular = false,
    this.color,
    this.size,
    this.weight,
    this.maxLines,
    this.letterSpacing,
  });

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    late TextStyle base;
    switch (variant) {
      case TextV.body:
        base = TextStyle(fontSize: 15, color: p.foreground);
        break;
      case TextV.h1:
        base = TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: p.foreground, letterSpacing: -0.3);
        break;
      case TextV.h2:
        base = TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: p.foreground, letterSpacing: -0.3);
        break;
      case TextV.h3:
        base = TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: p.foreground);
        break;
      case TextV.title:
        base = TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: p.foreground);
        break;
      case TextV.label:
        base = TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: p.mutedForeground);
        break;
      case TextV.meta:
        base = TextStyle(fontSize: 12, color: p.mutedForeground);
        break;
      case TextV.eyebrow:
        base = TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: p.mutedForeground, letterSpacing: 0.6);
        break;
      case TextV.amount:
        base = TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: p.foreground);
        break;
    }
    final style = base.copyWith(
      color: color ?? base.color,
      fontSize: size ?? base.fontSize,
      fontWeight: weight ?? base.fontWeight,
      letterSpacing: letterSpacing ?? base.letterSpacing,
      fontFeatures: tabular ? _tabular : null,
    );
    var text = variant == TextV.eyebrow ? data.toUpperCase() : data;
    return Text(text, style: style, maxLines: maxLines, overflow: maxLines != null ? TextOverflow.ellipsis : null);
  }
}

class CfkCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool flat;
  const CfkCard({super.key, required this.child, this.padding = const EdgeInsets.all(20), this.flat = false});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: p.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: p.border),
        boxShadow: flat
            ? null
            : [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 12, offset: const Offset(0, 6))],
      ),
      child: child,
    );
  }
}

class CfkTile extends StatelessWidget {
  final String icon;
  final String tint;
  final double size;
  final double radius;
  const CfkTile(this.icon, {super.key, this.tint = 'doc', this.size = 38, this.radius = 11});

  @override
  Widget build(BuildContext context) {
    final tint0 = tintOf(tint, context.mode);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: tint0.bg, borderRadius: BorderRadius.circular(radius)),
      alignment: Alignment.center,
      child: AppIcon(icon, size: (size * 0.46).roundToDouble(), color: tint0.fg),
    );
  }
}

enum Tone { neutral, success, danger, warning, info, primary }

class CfkBadge extends StatelessWidget {
  final String label;
  final Tone tone;
  const CfkBadge(this.label, {super.key, this.tone = Tone.neutral});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final m = context.mode;
    late Color bg, fg;
    switch (tone) {
      case Tone.neutral:
        bg = p.secondary;
        fg = p.foreground;
        break;
      case Tone.success:
        final ti = tintOf('xls', m);
        bg = ti.bg;
        fg = ti.fg;
        break;
      case Tone.danger:
        final ti = tintOf('pdf', m);
        bg = ti.bg;
        fg = ti.fg;
        break;
      case Tone.warning:
        final ti = tintOf('folder', m);
        bg = ti.bg;
        fg = ti.fg;
        break;
      case Tone.info:
        final ti = tintOf('doc', m);
        bg = ti.bg;
        fg = ti.fg;
        break;
      case Tone.primary:
        bg = p.primary;
        fg = Colors.white;
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
    );
  }
}

class Progress extends StatelessWidget {
  final double value; // 0..1
  final Color? fill;
  final double height;
  const Progress(this.value, {super.key, this.fill, this.height = 8});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: height,
        color: p.secondary,
        child: Align(
          alignment: Alignment.centerLeft,
          child: FractionallySizedBox(
            widthFactor: clamp01(value),
            child: Container(
              decoration: BoxDecoration(color: fill ?? p.primary, borderRadius: BorderRadius.circular(999)),
            ),
          ),
        ),
      ),
    );
  }
}

class SplitBar extends StatelessWidget {
  final double left; // 0..1
  final Color? leftColor;
  final Color? rightColor;
  final double height;
  const SplitBar(this.left, {super.key, this.leftColor, this.rightColor, this.height = 8});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final l = clamp01(left);
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: SizedBox(
        height: height,
        child: Row(children: [
          Expanded(flex: (l * 1000).round(), child: Container(color: leftColor ?? p.xlsFg)),
          Expanded(flex: ((1 - l) * 1000).round(), child: Container(color: rightColor ?? p.destructive)),
        ]),
      ),
    );
  }
}

/// Centered loading spinner.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 96),
          child: CircularProgressIndicator(color: context.palette.primary),
        ),
      );
}

/// Error state with message + optional retry.
class ErrorView extends StatelessWidget {
  final String? message;
  final VoidCallback? onRetry;
  const ErrorView({super.key, this.message, this.onRetry});
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 96),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppIcon('triangle-alert', size: 28, color: p.foreground),
            const SizedBox(height: 12),
            AppText(message ?? 'Something went wrong', variant: TextV.meta),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              GestureDetector(
                onTap: onRetry,
                child: AppText('Tap to retry', size: 13, weight: FontWeight.w600, color: p.primary),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Empty placeholder for lists.
class EmptyView extends StatelessWidget {
  final String icon;
  final String label;
  const EmptyView({super.key, this.icon = 'inbox', required this.label});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppIcon(icon, size: 26, color: context.palette.foreground),
            const SizedBox(height: 8),
            AppText(label, variant: TextV.meta),
          ],
        ),
      );
}

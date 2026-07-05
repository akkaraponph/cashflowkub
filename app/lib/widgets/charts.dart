// Lightweight charts — Dart port of mobile/src/components/charts.tsx.
// CashflowBars, MiniBars, Donut (CustomPaint), TrendChart (CustomPaint).

import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'ui.dart';

/// One bar scaled to [max] within a fixed-height row cell.
class _Bar extends StatelessWidget {
  final double factor; // 0..1
  final double width;
  final Color color;
  final BorderRadius radius;
  const _Bar(this.factor, this.width, this.color, this.radius);
  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.bottomCenter,
        child: FractionallySizedBox(
          heightFactor: factor.clamp(0.0, 1.0),
          child: Container(width: width, decoration: BoxDecoration(color: color, borderRadius: radius)),
        ),
      );
}

class CashflowPoint {
  final String month;
  final double income, expense;
  const CashflowPoint(this.month, this.income, this.expense);
}

/// Paired income/expense columns.
class CashflowBars extends StatelessWidget {
  final List<CashflowPoint> data;
  final double height;
  const CashflowBars(this.data, {super.key, this.height = 150});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final max = math.max(1.0, data.fold<double>(0, (a, d) => math.max(a, math.max(d.income, d.expense))));
    return SizedBox(
      height: height,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < data.length; i++) ...[
            if (i > 0) const SizedBox(width: 10),
            Expanded(
              child: Column(
                children: [
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _Bar(data[i].income / max, 9, p.xlsFg, BorderRadius.circular(3)),
                        const SizedBox(width: 4),
                        _Bar(data[i].expense / max, 9, p.foreground, BorderRadius.circular(3)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                  AppText(data[i].month, variant: TextV.meta, size: 11),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Single-series mini bars.
class MiniBars extends StatelessWidget {
  final List<double> values;
  final Color? color;
  final double height;
  const MiniBars(this.values, {super.key, this.color, this.height = 54});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final max = math.max(1.0, values.fold<double>(0, math.max));
    return SizedBox(
      height: height,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < values.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              child: _Bar(
                values[i] / max,
                14,
                color ?? p.primary,
                const BorderRadius.vertical(top: Radius.circular(3)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class DonutSegment {
  final double value;
  final Color color;
  const DonutSegment(this.value, this.color);
}

/// SVG-style donut with a centered label/value.
class Donut extends StatelessWidget {
  final List<DonutSegment> segments;
  final double size;
  final double stroke;
  final String? centerLabel;
  final String? centerValue;
  const Donut(this.segments, {super.key, this.size = 132, this.stroke = 18, this.centerLabel, this.centerValue});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(size: Size(size, size), painter: _DonutPainter(segments, stroke, p.secondary)),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (centerLabel != null) AppText(centerLabel!, variant: TextV.meta, size: 10),
              if (centerValue != null) AppText(centerValue!, size: 16, weight: FontWeight.w700, tabular: true),
            ],
          ),
        ],
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  final List<DonutSegment> segments;
  final double stroke;
  final Color track;
  _DonutPainter(this.segments, this.stroke, this.track);

  @override
  void paint(Canvas canvas, Size size) {
    final r = (size.width - stroke) / 2;
    final center = Offset(size.width / 2, size.height / 2);
    final total = math.max(1.0, segments.fold<double>(0, (a, s) => a + s.value));

    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = track;
    canvas.drawCircle(center, r, trackPaint);

    var start = -math.pi / 2;
    for (final s in segments) {
      final sweep = (s.value / total) * 2 * math.pi;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = s.color;
      canvas.drawArc(Rect.fromCircle(center: center, radius: r), start, sweep, false, paint);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.stroke != stroke || old.track != track || old.segments != segments;
}

/// Net-worth trend area chart (filled polyline).
class TrendChart extends StatelessWidget {
  final List<double> values;
  final List<String>? labels;
  final double height;
  final Color? color;
  const TrendChart(this.values, {super.key, this.labels, this.height = 120, this.color});

  @override
  Widget build(BuildContext context) {
    final stroke = color ?? context.palette.primary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(height: height, child: CustomPaint(painter: _TrendPainter(values, stroke))),
        if (labels != null) ...[
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [for (final l in labels!) AppText(l, variant: TextV.meta, size: 10)],
          ),
        ],
      ],
    );
  }
}

class _TrendPainter extends CustomPainter {
  final List<double> values;
  final Color color;
  _TrendPainter(this.values, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    const pad = 6.0;
    final min = values.reduce(math.min);
    final max = math.max(values.reduce(math.max), min + 1);
    final stepX = (size.width - pad * 2) / math.max(1, values.length - 1);
    double yOf(double v) => pad + (1 - (v - min) / (max - min)) * (size.height - pad * 2);

    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = pad + i * stepX;
      final y = yOf(values[i]);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    final area = Path.from(path)
      ..lineTo(pad + (values.length - 1) * stepX, size.height)
      ..lineTo(pad, size.height)
      ..close();
    canvas.drawPath(area, Paint()..color = color.withValues(alpha: 0.12));
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_TrendPainter old) => old.values != values || old.color != color;
}

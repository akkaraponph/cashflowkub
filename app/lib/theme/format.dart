// Money + number formatting — Dart port of mobile/src/lib/format.ts.

String _group(num n) {
  final s = n.abs().round().toString();
  return s.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
}

/// "฿1,234" — absolute value, no sign.
String fmt(num n) => '฿${_group(n)}';

/// "+฿1,234" / "-฿1,234".
String signed(num n) => (n < 0 ? '-' : '+') + fmt(n);

String _trim(double v) {
  final r = (v * 10).round() / 10;
  return r == r.roundToDouble() ? r.round().toString() : r.toString();
}

/// Compact baht for tight chart labels: 17700 -> "฿17.7k".
String compact(num n) {
  final abs = n.abs();
  if (abs >= 1000000) return '฿${_trim(abs / 1000000)}M';
  if (abs >= 1000) return '฿${_trim(abs / 1000)}k';
  return '฿${_group(abs)}';
}

/// "62%" from a 0..1 ratio.
String pct(num ratio) => '${(ratio * 100).round()}%';

/// Clamp a ratio to the 0..1 range for progress bars/rings.
double clamp01(num v) => v < 0 ? 0 : (v > 1 ? 1 : v.toDouble());

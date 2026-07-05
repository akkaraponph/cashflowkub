// Theme palette — Dart port of mobile/src/lib/theme.ts.
// Concrete colors for both modes plus the file-type tint set used across the UI.

import 'package:flutter/widgets.dart';

enum Mode { light, dark }

class Tint {
  final Color bg, fg;
  const Tint(this.bg, this.fg);
}

const _tintsLight = <String, Tint>{
  'folder': Tint(Color(0xFFFEF9C3), Color(0xFFCA8A04)),
  'pdf': Tint(Color(0xFFFEE2E2), Color(0xFFDC2626)),
  'image': Tint(Color(0xFFF3E8FF), Color(0xFF9333EA)),
  'doc': Tint(Color(0xFFDBEAFE), Color(0xFF2563EB)),
  'xls': Tint(Color(0xFFDCFCE7), Color(0xFF16A34A)),
  'video': Tint(Color(0xFFFCE7F3), Color(0xFFDB2777)),
};

const _tintsDark = <String, Tint>{
  'folder': Tint(Color(0xFF3A3416), Color(0xFFFACC15)),
  'pdf': Tint(Color(0xFF3A1C1C), Color(0xFFF87171)),
  'image': Tint(Color(0xFF2E1F3E), Color(0xFFC084FC)),
  'doc': Tint(Color(0xFF1C2A44), Color(0xFF60A5FA)),
  'xls': Tint(Color(0xFF14321F), Color(0xFF4ADE80)),
  'video': Tint(Color(0xFF3A1F30), Color(0xFFF472B6)),
};

/// Resolve a tint by key, falling back to `doc`.
Tint tintOf(String key, Mode mode) {
  final map = mode == Mode.light ? _tintsLight : _tintsDark;
  return map[key] ?? map['doc']!;
}

/// Hero (emerald panel) gradient per mode.
class Hero {
  final Color from, to, fg, solid;
  const Hero(this.from, this.to, this.fg, this.solid);
}

const heroLight = Hero(Color(0xFF12835D), Color(0xFF094F3B), Color(0xFFF1FAF5), Color(0xFF0A523C));
const heroDark = Hero(Color(0xFF10805B), Color(0xFF0A5640), Color(0xFFEEFAF4), Color(0xFF0A5640));
Hero heroOf(Mode m) => m == Mode.light ? heroLight : heroDark;

/// Brand (logo mark) gradient per mode.
class Brand {
  final Color from, to;
  const Brand(this.from, this.to);
}

const brandLight = Brand(Color(0xFF1A9C6A), Color(0xFF0B5C43));
const brandDark = Brand(Color(0xFF1FAE77), Color(0xFF0C6B4E));
Brand brandOf(Mode m) => m == Mode.light ? brandLight : brandDark;

/// Semantic palette (mirrors global.css tokens).
class Palette {
  final Color primary,
      background,
      foreground,
      mutedForeground,
      destructive,
      border,
      secondary,
      card,
      xlsFg;
  const Palette({
    required this.primary,
    required this.background,
    required this.foreground,
    required this.mutedForeground,
    required this.destructive,
    required this.border,
    required this.secondary,
    required this.card,
    required this.xlsFg,
  });
}

const paletteLight = Palette(
  primary: Color(0xFF15835D),
  background: Color(0xFFF5FAF7),
  foreground: Color(0xFF243430),
  mutedForeground: Color(0xFF677873),
  destructive: Color(0xFFDC4D3F),
  border: Color(0xFFDDE6E1),
  secondary: Color(0xFFEEF3F0),
  card: Color(0xFFFFFFFF),
  xlsFg: Color(0xFF16A34A),
);

const paletteDark = Palette(
  primary: Color(0xFF3CBA88),
  background: Color(0xFF161E1A),
  foreground: Color(0xFFECF2EF),
  mutedForeground: Color(0xFF93A39D),
  destructive: Color(0xFFE06A5C),
  border: Color(0xFF2D3833),
  secondary: Color(0xFF212B27),
  card: Color(0xFF1C2622),
  xlsFg: Color(0xFF4ADE80),
);

Palette paletteOf(Mode m) => m == Mode.light ? paletteLight : paletteDark;

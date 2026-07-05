// Global app preferences: language, theme mode, financial-year scope.
// Dart port of mobile/src/lib/store.ts. Exposed via an InheritedNotifier so any
// widget can read + rebuild on change. (In-memory; not yet persisted.)

import 'package:flutter/widgets.dart';

import '../theme/palette.dart';

enum Lang { en, th }

const years = [2024, 2025, 2026, 2027, 2028];
const currentYear = 2026;

class AppPrefs extends ChangeNotifier {
  Lang lang = Lang.en;
  Mode theme = Mode.light;
  int year = currentYear;

  void setLang(Lang l) {
    lang = l;
    notifyListeners();
  }

  void toggleLang() => setLang(lang == Lang.en ? Lang.th : Lang.en);

  void setTheme(Mode t) {
    theme = t;
    notifyListeners();
  }

  void toggleTheme() => setTheme(theme == Mode.light ? Mode.dark : Mode.light);

  void setYear(int y) {
    year = y;
    notifyListeners();
  }

  /// Current palette for the active mode.
  Palette get colors => paletteOf(theme);
}

/// Provides [AppPrefs] to the subtree and rebuilds dependents on change.
class PrefsScope extends InheritedNotifier<AppPrefs> {
  const PrefsScope({super.key, required AppPrefs prefs, required super.child})
      : super(notifier: prefs);

  static AppPrefs of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<PrefsScope>();
    assert(scope != null, 'PrefsScope not found in context');
    return scope!.notifier!;
  }
}

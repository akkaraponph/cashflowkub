// Smoke test: the app builds and shows the dashboard header.

import 'package:flutter_test/flutter_test.dart';

import 'package:app/main.dart';
import 'package:app/state/prefs.dart';

void main() {
  testWidgets('App builds with the dashboard tab', (WidgetTester tester) async {
    await tester.pumpWidget(CashflowKubApp(prefs: AppPrefs()));
    await tester.pump();

    // Header title + greeting from the dashboard are present.
    expect(find.text('Dashboard'), findsWidgets);
  });
}

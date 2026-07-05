// Placeholder for screens not yet ported from the mobile app.

import 'package:flutter/material.dart';

import '../widgets/app_header.dart';
import '../widgets/ui.dart';

class PlaceholderScreen extends StatelessWidget {
  final String title;
  const PlaceholderScreen(this.title, {super.key});
  @override
  Widget build(BuildContext context) => Column(
        children: [
          AppHeader(title),
          Expanded(child: Center(child: EmptyView(icon: 'inbox', label: '$title — coming soon'))),
        ],
      );
}

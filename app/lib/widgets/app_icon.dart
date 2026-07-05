// Renders a lucide-named glyph (kebab-case, as the API/design use) with the
// nearest Material icon. Dart analogue of mobile/src/components/Icon.tsx.
// Unknown names fall back to a neutral circle.

import 'package:flutter/material.dart';

const _map = <String, IconData>{
  // data icons (from the API seed)
  'arrow-down-left': Icons.south_west,
  'arrow-up-right': Icons.north_east,
  'banknote': Icons.payments,
  'bar-chart-3': Icons.bar_chart,
  'bike': Icons.pedal_bike,
  'book-open': Icons.menu_book,
  'briefcase': Icons.work,
  'car': Icons.directions_car,
  'clapperboard': Icons.movie,
  'clock-3': Icons.schedule,
  'cloud': Icons.cloud,
  'coins': Icons.monetization_on,
  'credit-card': Icons.credit_card,
  'droplet': Icons.water_drop,
  'gift': Icons.card_giftcard,
  'globe': Icons.public,
  'graduation-cap': Icons.school,
  'heart-pulse': Icons.monitor_heart,
  'house': Icons.home,
  'landmark': Icons.account_balance,
  'monitor': Icons.desktop_windows,
  'music': Icons.music_note,
  'pen-tool': Icons.edit,
  'pie-chart': Icons.pie_chart,
  'piggy-bank': Icons.savings,
  'plane': Icons.flight,
  'plus': Icons.add,
  'receipt': Icons.receipt_long,
  'shield': Icons.shield,
  'shield-check': Icons.verified_user,
  'shopping-bag': Icons.shopping_bag,
  'shower-head': Icons.shower,
  'smartphone': Icons.smartphone,
  'tent-tree': Icons.cabin,
  'trending-up': Icons.trending_up,
  'trending-down': Icons.trending_down,
  'utensils': Icons.restaurant,
  'wallet': Icons.account_balance_wallet,
  'wifi': Icons.wifi,
  'zap': Icons.bolt,
  // UI chrome
  'chevron-left': Icons.chevron_left,
  'chevron-right': Icons.chevron_right,
  'moon': Icons.dark_mode,
  'sun': Icons.light_mode,
  'menu': Icons.menu,
  'layout-dashboard': Icons.dashboard,
  'calendar-clock': Icons.event,
  'scale': Icons.balance,
  'triangle-alert': Icons.warning_amber_rounded,
  'inbox': Icons.inbox,
  'circle': Icons.circle,
  'wallet-2': Icons.account_balance_wallet,
};

IconData iconData(String name) => _map[name] ?? Icons.radio_button_unchecked;

class AppIcon extends StatelessWidget {
  final String name;
  final double size;
  final Color? color;
  const AppIcon(this.name, {super.key, this.size = 18, this.color});

  @override
  Widget build(BuildContext context) =>
      Icon(iconData(name), size: size, color: color ?? DefaultTextStyle.of(context).style.color);
}

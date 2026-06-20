// Single source of truth for the app's screens: nav key (matches i18n nav.*),
// route href, and lucide icon. Used by the tab bar and the More menu.

import type { Href } from 'expo-router';

export interface NavItem {
  key: string;
  href: Href;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/', icon: 'layout-dashboard' },
  { key: 'bills', href: '/bills', icon: 'calendar-clock' },
  { key: 'transactions', href: '/transactions', icon: 'arrow-left-right' },
  { key: 'debts', href: '/debts', icon: 'trending-down' },
  { key: 'networth', href: '/networth', icon: 'scale' },
  { key: 'budgets', href: '/budgets', icon: 'wallet' },
  { key: 'accounts', href: '/accounts', icon: 'landmark' },
  { key: 'reports', href: '/reports', icon: 'bar-chart-3' },
  { key: 'goals', href: '/goals', icon: 'target' },
  { key: 'plan', href: '/plan', icon: 'clipboard-list' },
  { key: 'setup', href: '/setup', icon: 'sliders-horizontal' },
  { key: 'settings', href: '/settings', icon: 'settings' },
];

/** The four primary destinations shown in the bottom tab bar. */
export const TAB_KEYS = ['dashboard', 'bills', 'debts', 'networth'] as const;

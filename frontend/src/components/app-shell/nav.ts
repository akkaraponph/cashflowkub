// The app's screens: i18n nav key, route, icon. Used by the sidebar and the mobile sheet.
export const NAV_ITEMS = [
  { key: 'dashboard', href: '/dashboard', icon: 'layout-dashboard' },
  { key: 'bills', href: '/bills', icon: 'calendar-clock' },
  { key: 'transactions', href: '/transactions', icon: 'arrow-left-right' },
  { key: 'debts', href: '/debts', icon: 'trending-down' },
  { key: 'networth', href: '/networth', icon: 'scale' },
  { key: 'budgets', href: '/budgets', icon: 'wallet' },
  { key: 'accounts', href: '/accounts', icon: 'landmark' },
  { key: 'reports', href: '/reports', icon: 'bar-chart-3' },
  { key: 'goals', href: '/goals', icon: 'target' },
  { key: 'plan', href: '/plan', icon: 'clipboard-list' },
  { key: 'tax', href: '/tax', icon: 'receipt' },
  { key: 'setup', href: '/setup', icon: 'sliders-horizontal' },
  { key: 'settings', href: '/settings', icon: 'settings' },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]['key'];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

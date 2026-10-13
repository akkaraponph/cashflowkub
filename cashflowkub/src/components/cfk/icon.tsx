// Renders a lucide icon by the kebab-case name stored in the data (e.g. "shopping-bag").
// A static map keeps the client bundle to the icons we actually use.
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Bike, BookOpen, Briefcase, Calendar, CalendarClock, Car,
  ChartColumn, ChartPie, Check, ChevronLeft, ChevronRight, Circle, CircleHelp, Clapperboard, ClipboardList, Clock3,
  Cloud, Coins, CreditCard, Delete, Droplet, Gift, Globe, GraduationCap, HeartPulse, House, Landmark, LayoutDashboard,
  LogOut, Menu, Monitor, Moon, Music, Package, Pencil, PenTool, PiggyBank, Plane, Plus, Receipt, Scale, Settings, Shield,
  ShieldCheck, ShoppingBag, ShowerHead, SlidersHorizontal, Smartphone, Sun, Target, TentTree, Trash2, TrendingDown,
  TrendingUp, TriangleAlert, Utensils, Wallet, Wifi, X, Zap, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  'arrow-down-left': ArrowDownLeft, 'arrow-left-right': ArrowLeftRight, 'arrow-up-right': ArrowUpRight, banknote: Banknote,
  bike: Bike, 'book-open': BookOpen, briefcase: Briefcase, calendar: Calendar, 'calendar-clock': CalendarClock, car: Car,
  'bar-chart-3': ChartColumn, 'pie-chart': ChartPie, check: Check, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  circle: Circle, 'circle-help': CircleHelp, clapperboard: Clapperboard, 'clipboard-list': ClipboardList, 'clock-3': Clock3,
  cloud: Cloud, coins: Coins, 'credit-card': CreditCard, delete: Delete, droplet: Droplet, gift: Gift, globe: Globe,
  'graduation-cap': GraduationCap, 'heart-pulse': HeartPulse, house: House, landmark: Landmark, 'layout-dashboard': LayoutDashboard,
  'log-out': LogOut, menu: Menu, monitor: Monitor, moon: Moon, music: Music, package: Package, pencil: Pencil, 'pen-tool': PenTool,
  'piggy-bank': PiggyBank, plane: Plane, plus: Plus, receipt: Receipt, scale: Scale, settings: Settings, shield: Shield,
  'shield-check': ShieldCheck, 'shopping-bag': ShoppingBag, 'shower-head': ShowerHead, 'sliders-horizontal': SlidersHorizontal,
  smartphone: Smartphone, sun: Sun, target: Target, 'tent-tree': TentTree, 'trash-2': Trash2, 'trending-down': TrendingDown,
  'trending-up': TrendingUp, 'triangle-alert': TriangleAlert, utensils: Utensils, wallet: Wallet, wifi: Wifi, x: X, zap: Zap,
};

export function Icon({ name, size = 18, className, strokeWidth = 1.75 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const Comp = ICONS[name] ?? Circle;
  return <Comp size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}

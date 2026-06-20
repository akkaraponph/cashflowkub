// Icon renders a lucide glyph by its kebab-case name (the same names the design
// and API use, e.g. "shopping-bag", "bar-chart-3"). We resolve the PascalCase
// component dynamically so screens never import icons one by one. When no color
// is given it follows the current theme's foreground.

import * as Lucide from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import { PALETTE } from '@/lib/theme';
import { usePrefs } from '@/lib/store';

const cache = new Map<string, React.ComponentType<LucideProps>>();

function resolve(name: string): React.ComponentType<LucideProps> {
  if (cache.has(name)) return cache.get(name)!;
  const pascal = name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  const comp =
    ((Lucide as Record<string, unknown>)[pascal] as React.ComponentType<LucideProps>) ??
    (Lucide.Circle as React.ComponentType<LucideProps>);
  cache.set(name, comp);
  return comp;
}

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 18, color, strokeWidth = 1.75 }: IconProps) {
  const mode = usePrefs((s) => s.theme);
  const Comp = resolve(name);
  return <Comp size={size} color={color ?? PALETTE[mode].foreground} strokeWidth={strokeWidth} />;
}

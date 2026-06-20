import { View } from 'react-native';
import { cn } from '@/lib/cn';
import { clamp01 } from '@/lib/format';

export interface ProgressProps {
  /** 0..1 */
  value: number;
  className?: string;
  /** Tailwind bg-* class for the fill (default primary). */
  fillClassName?: string;
  height?: number;
}

export function Progress({ value, className, fillClassName = 'bg-primary', height = 8 }: ProgressProps) {
  return (
    <View className={cn('overflow-hidden rounded-full bg-secondary', className)} style={{ height }}>
      <View className={cn('h-full rounded-full', fillClassName)} style={{ width: `${clamp01(value) * 100}%` }} />
    </View>
  );
}

/** Two-segment bar (e.g. assets vs liabilities split). */
export function SplitBar({ left, leftClassName = 'bg-type-xls-fg', rightClassName = 'bg-destructive', height = 8 }: {
  left: number; leftClassName?: string; rightClassName?: string; height?: number;
}) {
  const l = clamp01(left);
  return (
    <View className="flex-row overflow-hidden rounded-full bg-secondary" style={{ height }}>
      <View className={cn('h-full', leftClassName)} style={{ width: `${l * 100}%` }} />
      <View className={cn('h-full', rightClassName)} style={{ width: `${(1 - l) * 100}%` }} />
    </View>
  );
}

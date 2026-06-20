import { View } from 'react-native';
import { cn } from '@/lib/cn';
import { Text } from './text';

export type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'primary';

const TONE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'bg-secondary', fg: 'text-secondary-foreground' },
  success: { bg: 'bg-type-xls-bg', fg: 'text-type-xls-fg' },
  danger: { bg: 'bg-type-pdf-bg', fg: 'text-type-pdf-fg' },
  warning: { bg: 'bg-type-folder-bg', fg: 'text-type-folder-fg' },
  info: { bg: 'bg-type-doc-bg', fg: 'text-type-doc-fg' },
  primary: { bg: 'bg-primary', fg: 'text-primary-foreground' },
};

export interface BadgeProps {
  label: string;
  tone?: Tone;
  className?: string;
  left?: React.ReactNode;
}

export function Badge({ label, tone = 'neutral', className, left }: BadgeProps) {
  const t = TONE[tone];
  return (
    <View className={cn('flex-row items-center gap-1 self-start rounded-full px-2 py-0.5', t.bg, className)}>
      {left}
      <Text className={cn('text-[11px] font-semibold', t.fg)}>{label}</Text>
    </View>
  );
}

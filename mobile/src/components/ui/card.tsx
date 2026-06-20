import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/cn';

// Soft, almost-flat elevation matching the design's --cfk-shadow.
export const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

export interface CardProps extends ViewProps {
  className?: string;
  /** Drop the soft shadow (e.g. for nested/flat surfaces). */
  flat?: boolean;
}

export function Card({ className, flat, style, ...props }: CardProps) {
  return (
    <View
      className={cn('rounded-lg border border-border bg-card', className)}
      style={[flat ? null : CARD_SHADOW, style]}
      {...props}
    />
  );
}

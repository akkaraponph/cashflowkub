import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';
import { cn } from '@/lib/cn';
import { Text } from './text';

type Variant = 'default' | 'outline' | 'ghost' | 'secondary';
type Size = 'sm' | 'md' | 'lg';

const BG: Record<Variant, string> = {
  default: 'bg-primary border-primary',
  secondary: 'bg-secondary border-border',
  outline: 'bg-background border-border',
  ghost: 'bg-transparent border-transparent',
};
const FG: Record<Variant, string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outline: 'text-foreground',
  ghost: 'text-foreground',
};
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 rounded-md',
  md: 'h-10 px-4 rounded-lg',
  lg: 'h-12 px-5 rounded-lg',
};

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label?: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export function Button({
  label, variant = 'default', size = 'md', loading, disabled, className, children, left, right, ...props
}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled || loading}
      className={cn(
        'flex-row items-center justify-center gap-2 border active:opacity-80',
        BG[variant], SIZE[size], (disabled || loading) && 'opacity-50', className,
      )}
      {...props}>
      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <View className="flex-row items-center gap-2">
          {left}
          {label ? <Text className={cn('text-[14px] font-semibold', FG[variant])}>{label}</Text> : null}
          {children}
          {right}
        </View>
      )}
    </Pressable>
  );
}

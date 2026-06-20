import { Text as RNText, type TextProps } from 'react-native';
import { cn } from '@/lib/cn';

type Variant = 'body' | 'h1' | 'h2' | 'h3' | 'title' | 'label' | 'meta' | 'eyebrow' | 'amount';

const VARIANT: Record<Variant, string> = {
  body: 'text-[15px] text-foreground',
  h1: 'text-[22px] font-bold tracking-tight text-foreground',
  h2: 'text-[18px] font-bold tracking-tight text-foreground',
  h3: 'text-[16px] font-semibold text-foreground',
  title: 'text-[15px] font-semibold text-foreground',
  label: 'text-[13px] font-semibold text-muted-foreground',
  meta: 'text-[12px] text-muted-foreground',
  eyebrow: 'text-[11px] font-bold uppercase tracking-wider text-muted-foreground',
  amount: 'text-[15px] font-bold text-foreground',
};

export interface TextPropsX extends TextProps {
  className?: string;
  variant?: Variant;
  /** Tabular figures for aligned money columns. */
  tabular?: boolean;
}

export function Text({ className, variant = 'body', tabular, style, ...props }: TextPropsX) {
  return (
    <RNText
      className={cn(VARIANT[variant], className)}
      style={[tabular ? { fontVariant: ['tabular-nums'] } : null, style]}
      {...props}
    />
  );
}

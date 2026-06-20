import { ActivityIndicator, RefreshControl, ScrollView, View, type ScrollViewProps } from 'react-native';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/useColors';
import { Icon } from '@/components/Icon';
import { Text } from './text';

export interface ScreenProps extends ScrollViewProps {
  children: React.ReactNode;
  className?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Extra bottom padding to clear the floating tab bar. */
  pad?: number;
}

/** Themed scrollable page body. Pages render their own header above this. */
export function Screen({ children, className, contentContainerStyle, onRefresh, refreshing, pad = 120, ...props }: ScreenProps) {
  const c = useColors();
  return (
    <ScrollView
      className={cn('flex-1 bg-background', className)}
      contentContainerStyle={[{ padding: 16, paddingBottom: pad, gap: 16 }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.mutedForeground} /> : undefined
      }
      {...props}>
      {children}
    </ScrollView>
  );
}

/** Centered loading spinner filling the body. */
export function Loading() {
  const c = useColors();
  return (
    <View className="flex-1 items-center justify-center bg-background py-24">
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

/** Error state with the message and an optional retry. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-8 py-24">
      <Icon name="triangle-alert" size={28} />
      <Text variant="meta" className="text-center">{message ?? 'Something went wrong'}</Text>
      {onRetry ? (
        <Text onPress={onRetry} className="text-[13px] font-semibold text-primary">Tap to retry</Text>
      ) : null}
    </View>
  );
}

/** Empty placeholder for lists. */
export function Empty({ icon = 'inbox', label }: { icon?: string; label: string }) {
  return (
    <View className="items-center justify-center gap-2 py-12">
      <Icon name={icon} size={26} />
      <Text variant="meta">{label}</Text>
    </View>
  );
}

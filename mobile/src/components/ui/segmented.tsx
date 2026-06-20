import { Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';
import { Text } from './text';

export interface SegOption {
  key: string;
  label: string;
}

export interface SegmentedProps {
  options: SegOption[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

/** iOS-style segmented control used for tabs/toggles across the app. */
export function Segmented({ options, value, onChange, className }: SegmentedProps) {
  return (
    <View className={cn('flex-row rounded-lg border border-border bg-secondary p-1', className)}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            className={cn('flex-1 items-center justify-center rounded-md py-2', active && 'bg-card')}
            style={active ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : undefined}>
            <Text className={cn('text-[13px] font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

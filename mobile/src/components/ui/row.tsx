import { Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/Icon';
import { useColors } from '@/lib/useColors';
import { Text } from './text';
import { Tile } from './tile';

export interface ListRowProps {
  icon?: string;
  tint?: string;
  leftNode?: React.ReactNode;
  title: string;
  subtitle?: string;
  rightTop?: React.ReactNode;
  rightBottom?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  className?: string;
}

/** A standard tile + title/subtitle + right-aligned value list row. */
export function ListRow({
  icon, tint, leftNode, title, subtitle, rightTop, rightBottom, onPress, chevron, className,
}: ListRowProps) {
  const c = useColors();
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      className={cn('flex-row items-center gap-3 py-2.5', onPress && 'active:opacity-70', className)}>
      {leftNode ?? (icon ? <Tile icon={icon} tint={tint} /> : null)}
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="meta" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View className="items-end">
        {typeof rightTop === 'string' ? <Text className="text-[14px] font-bold" tabular>{rightTop}</Text> : rightTop}
        {typeof rightBottom === 'string' ? <Text variant="meta" tabular>{rightBottom}</Text> : rightBottom}
      </View>
      {chevron ? <Icon name="chevron-right" size={18} color={c.mutedForeground} /> : null}
    </Wrapper>
  );
}

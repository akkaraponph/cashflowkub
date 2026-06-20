import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { usePrefs } from '@/lib/store';
import { tint } from '@/lib/theme';

export interface TileProps {
  icon: string;
  tint?: string;
  size?: number;
  radius?: number;
}

/** A rounded, color-tinted square holding a lucide icon — the app's core motif. */
export function Tile({ icon, tint: tintKey = 'doc', size = 38, radius = 11 }: TileProps) {
  const mode = usePrefs((s) => s.theme);
  const t = tint(tintKey, mode);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: radius,
        backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center',
      }}>
      <Icon name={icon} size={Math.round(size * 0.46)} color={t.fg} />
    </View>
  );
}

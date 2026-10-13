import { cn } from '@/lib/utils';
import { Icon } from './icon';
import { tintClass } from './tint';

/** Rounded, tinted square holding an icon: the app's core motif. */
export function Tile({ icon, tint, size = 38, className }: { icon: string; tint?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-[11px]', tintClass(tint), className)}
      style={{ width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.46)} />
    </span>
  );
}

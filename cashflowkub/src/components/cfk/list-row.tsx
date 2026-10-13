import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Icon } from './icon';
import { Tile } from './tile';

export interface ListRowProps {
  icon?: string;
  tint?: string;
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  rightSub?: React.ReactNode;
  href?: string;
  className?: string;
}

/** Tile + title/subtitle + right-aligned value. Becomes a link when href is set. */
export function ListRow({ icon, tint, leading, title, subtitle, right, rightSub, href, className }: ListRowProps) {
  const body = (
    <>
      {leading ?? (icon ? <Tile icon={icon} tint={tint} /> : null)}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        {typeof right === 'string' ? <span className="text-sm font-bold tabular-nums">{right}</span> : right}
        {typeof rightSub === 'string' ? <span className="text-xs text-muted-foreground tabular-nums">{rightSub}</span> : rightSub}
      </div>
      {href ? <Icon name="chevron-right" size={16} className="text-muted-foreground" /> : null}
    </>
  );
  const cls = cn('flex items-center gap-3 py-2.5', className);
  return href ? (
    <Link href={href} className={cn(cls, 'hover:opacity-80')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Tile } from './tile';

export function StatCard({ icon, tint, label, value, positive }: { icon: string; tint: string; label: string; value: string; positive?: boolean }) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <Tile icon={icon} tint={tint} size={34} />
        <span className="truncate text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums', positive && 'text-type-xls-fg')}>{value}</p>
    </Card>
  );
}

import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Segmented control whose options are links (state lives in the URL, so it works server-side). */
export function SegmentedLinks({ options, value, hrefFor }: { options: { key: string; label: string }[]; value: string; hrefFor: (key: string) => string }) {
  return (
    <nav className="flex rounded-xl bg-secondary p-1">
      {options.map((o) => (
        <Link
          key={o.key}
          href={hrefFor(o.key)}
          scroll={false}
          aria-current={o.key === value ? 'page' : undefined}
          className={cn(
            'flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors',
            o.key === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

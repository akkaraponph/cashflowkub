import Link from 'next/link';
import { Icon } from './icon';

export function PageTitle({ title, back, children }: { title: string; back?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {back ? (
        <Link href={back} aria-label="Back" className="flex size-9 items-center justify-center rounded-lg border bg-secondary hover:opacity-80">
          <Icon name="chevron-left" size={20} />
        </Link>
      ) : null}
      <h1 className="flex-1 truncate text-2xl font-bold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

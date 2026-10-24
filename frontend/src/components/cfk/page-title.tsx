import Link from 'next/link';
import { AddTransactionDialog } from '@/components/app-shell/add-transaction-dialog';
import { Icon } from './icon';

/** `addTransaction={false}` hides the global add-transaction button, for pages whose own primary action is a different "add". */
export function PageTitle({ title, back, children, addTransaction = true }: { title: string; back?: string; children?: React.ReactNode; addTransaction?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {back ? (
        <Link href={back} aria-label="Back" className="flex size-9 items-center justify-center rounded-lg border bg-secondary hover:opacity-80">
          <Icon name="chevron-left" size={20} />
        </Link>
      ) : null}
      <h1 className="flex-1 truncate text-2xl font-bold tracking-tight">{title}</h1>
      {children}
      {addTransaction ? <AddTransactionDialog /> : null}
    </div>
  );
}

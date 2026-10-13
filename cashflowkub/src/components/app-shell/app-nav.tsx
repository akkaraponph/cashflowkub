'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Icon } from '@/components/cfk/icon';
import { useI18n } from '@/components/i18n-provider';
import { cn } from '@/lib/utils';
import { isActive, NAV_ITEMS } from './nav';

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-4">
      <span className="flex size-8 items-center justify-center rounded-[9px] bg-linear-to-br from-(--brand-from) to-(--brand-to) text-[15px] font-extrabold text-white">C</span>
      <span className="text-base font-bold">CashflowKub</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { ui } = useI18n();
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive(pathname, item.href) ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
          )}>
          <Icon name={item.icon} size={17} />
          {ui.nav[item.key]}
        </Link>
      ))}
    </nav>
  );
}

/** Fixed sidebar on md+; a sheet opened from the header on small screens. */
export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <Brand />
      <NavLinks />
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { ui } = useI18n();
  return (
    <>
      <button type="button" aria-label={ui.menu} onClick={() => setOpen(true)} className="flex size-9 items-center justify-center rounded-lg border bg-secondary md:hidden">
        <Icon name="menu" size={17} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{ui.menu}</SheetTitle>
          </SheetHeader>
          <Brand />
          <NavLinks onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

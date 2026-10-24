import { cn } from '@/lib/utils';

/** Large emerald gradient panel used for headline numbers. */
export function Hero({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[20px] bg-linear-to-br from-(--hero-from) to-(--hero-to) p-6 text-(--hero-fg)', className)}>
      {children}
    </section>
  );
}

export function HeroPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold">{children}</span>;
}

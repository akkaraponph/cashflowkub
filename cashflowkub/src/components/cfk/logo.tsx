/** CashflowKub mark: a "C" ring with a rising cash-flow line leaving its opening. Gradient follows the brand tokens. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="CashflowKub" className={className}>
      <defs>
        <linearGradient id="cfk-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--brand-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--brand-to)' }} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#cfk-logo-bg)" />
      <path d="M41.3 20.7A16 16 0 1 0 41.3 43.3" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <path d="M28 38l7-7 5 5 12-12M47 24h6v6" fill="none" stroke="#9af0c8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

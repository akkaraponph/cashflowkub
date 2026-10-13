// Money + number formatting, done by hand so output is identical on server and client.

function group(n: number): string {
  return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "฿1,234": absolute value, no sign. */
export function fmt(n: number): string {
  return '฿' + group(n);
}

/** "+฿1,234" / "-฿1,234". */
export function signed(n: number): string {
  return (n < 0 ? '-' : '+') + fmt(n);
}

/** Compact baht for chart labels: 17700 -> "฿17.7k", 1_250_000 -> "฿1.3M". */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return '฿' + trim(abs / 1_000_000) + 'M';
  if (abs >= 1_000) return '฿' + trim(abs / 1_000) + 'k';
  return '฿' + group(abs);
}

function trim(v: number): string {
  return (Math.round(v * 10) / 10).toString();
}

/** "62%" from a 0..1 ratio. */
export function pct(ratio: number): string {
  return Math.round(ratio * 100) + '%';
}

/** Clamp a ratio into 0..1 for progress bars. */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

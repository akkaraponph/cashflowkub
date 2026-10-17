import type { Lang } from '@/lib/i18n';

// Money + number formatting, done by hand so output is identical on server and client.

function group(n: number): string {
  const cents = Math.round(Math.abs(n) * 100);
  const whole = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sat = cents % 100;
  return sat ? `${whole}.${sat.toString().padStart(2, '0')}` : whole;
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

const MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
};

/** "2026-06-28" → "28 มิ.ย. 2026" / "28 Jun 2026" (Gregorian year). Anything unparseable is returned as given. */
export function formatDay(iso: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return iso;
  return `${day} ${MONTHS[lang][month - 1]} ${m[1]}`;
}

/** "2026-06" → "Jun 2026" / "มิ.ย. 2026" (Gregorian year). Anything unparseable is returned as given. */
export function formatMonth(month: string, lang: Lang): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  return m ? `${MONTHS[lang][Number(m[2]) - 1]} ${m[1]}` : month;
}

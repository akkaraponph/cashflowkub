/** Whole baht from typed text: blank counts as `blank`; unreadable is NaN; commas, ฿ and spaces are ignored. */
export function parseMoney(raw: string, blank: number): number {
  const s = raw.replace(/[,฿\s]/g, '');
  return s === '' ? blank : Math.round(Number(s));
}

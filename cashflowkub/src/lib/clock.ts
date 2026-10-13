// The design comp is a fixed snapshot, so "today" is a constant (Jun 18, 2026)
// rather than the wall clock. Every date-relative label derives from today().
export const REF_TODAY = new Date(Date.UTC(2026, 5, 18));
export const CURRENT_MONTH = '2026-06';

export function today(): Date {
  return new Date(REF_TODAY);
}

export function todayDay(): number {
  return REF_TODAY.getUTCDate();
}

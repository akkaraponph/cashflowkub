export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `raw` when it is a valid YYYY-MM, else `fallback`. */
export function resolveMonth(raw: string | undefined, fallback: string): string {
  return raw !== undefined && MONTH_RE.test(raw) ? raw : fallback;
}

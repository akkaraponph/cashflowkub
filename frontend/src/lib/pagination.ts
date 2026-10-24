export const PAGE_SIZES = [50, 100, 200, 500] as const;
export const DEFAULT_PAGE_SIZE = 200;

/** Reads `page` / `size` query values: unlisted sizes fall back to 200, non-positive-integer pages to 1. */
export function parsePaging(page: string | undefined, size: string | undefined): { page: number; size: number } {
  const s = Number(size);
  const p = Number(page);
  return {
    page: page && Number.isInteger(p) && p > 0 ? p : 1,
    size: (PAGE_SIZES as readonly number[]).includes(s) ? s : DEFAULT_PAGE_SIZE,
  };
}

export function clampPage(page: number, total: number, size: number): number {
  return Math.min(page, Math.max(1, Math.ceil(total / size)));
}

/** 1-based inclusive window of rows on a page; zeros when there are none. */
export function pageRange(page: number, size: number, total: number): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  return { from: (page - 1) * size + 1, to: Math.min(page * size, total) };
}

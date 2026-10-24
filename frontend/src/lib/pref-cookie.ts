/** Client-side: persist a preference cookie for a year. Callers then router.refresh(). */
export function writePrefCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

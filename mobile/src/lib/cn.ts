// Tiny className combiner. NativeWind applies later utilities last, so a plain
// truthy-join is enough for our conflict cases (no tailwind-merge needed).
type ClassValue = string | false | null | undefined;

export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ');
}

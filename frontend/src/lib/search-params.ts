import type { Category } from '@/generated/prisma/client';

export type SearchParamsRecord = Record<string, string | string[] | undefined>;
export type SearchParams = Promise<SearchParamsRecord>;

export function firstParam(sp: SearchParamsRecord, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export function byKey<T extends Pick<Category, 'key'>>(categories: T[]): Map<string, T> {
  return new Map(categories.map((c) => [c.key, c]));
}

import type { Category } from '@/generated/prisma/client';

export type SearchParamsRecord = Record<string, string | string[] | undefined>;
export type SearchParams = Promise<SearchParamsRecord>;

export function firstParam(sp: SearchParamsRecord, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export function byKey(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((c) => [c.key, c]));
}

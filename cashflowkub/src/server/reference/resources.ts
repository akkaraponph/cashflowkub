// The seven plain-CRUD resources: their URL names, row types and input schemas.
import { z } from 'zod';
import type { Account, Asset, Budget, Category, Channel, Goal, IncomeCategory } from '@/generated/prisma/client';

const name = z.string().trim().min(1);
const text = z.string().optional();
const int = z.number().int().optional();

export const RESOURCE_SCHEMAS = {
  accounts: z.object({
    name, sub: text, balance: int, icon: text, tint: text,
    kind: z.enum(['bank', 'cash', 'ewallet', 'credit']).optional(), startDate: text, startTh: text, sort: int,
  }),
  categories: z.object({
    key: name, label: name, th: text, short: text, icon: text, tint: text,
    type: z.enum(['income', 'expense']).optional(), sub: text, sort: int,
  }),
  budgets: z.object({ cat: name, spent: z.number().int().nonnegative().optional(), limit: z.number().int().nonnegative(), sort: int }),
  goals: z.object({
    name, th: text, icon: text, saved: z.number().int().nonnegative().optional(), target: z.number().int().positive(),
    monthly: z.number().int().nonnegative().optional(), by: text, sort: int,
  }),
  assets: z.object({ name, th: text, icon: text, tint: text, value: int, sort: int }),
  channels: z.object({
    name, th: text, kind: z.enum(['saving', 'mf', 'pf', 'stock', 'gold', 'bond']).optional(), icon: text, tint: text,
    opening: int, startDate: text, startTh: text, sort: int,
  }),
  'income-categories': z.object({ name, th: text, sub: z.enum(['main', 'side', 'passive']).optional(), icon: text, tint: text, sort: int }),
} as const;

export interface ResourceRows {
  accounts: Account;
  categories: Category;
  budgets: Budget;
  goals: Goal;
  assets: Asset;
  channels: Channel;
  'income-categories': IncomeCategory;
}

export type ResourceName = keyof ResourceRows;

export function isResourceName(v: string): v is ResourceName {
  return Object.hasOwn(RESOURCE_SCHEMAS, v);
}

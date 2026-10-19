import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUserId } from '@/lib/user-context';
import { parseBody } from '@/server/validate';

export interface AppSettings {
  monthlyIncome: number;
}

const settingsSchema = z.object({ monthlyIncome: z.number().int().nonnegative() });
const INCOME_KEY = 'monthlyIncome';

/** Configured income, else the latest month's actual income, else 0. */
export async function getMonthlyIncome(): Promise<number> {
  const row = await prisma.setting.findFirst({ where: { key: INCOME_KEY } });
  if (row) return Number(row.value) || 0;
  const latest = await prisma.monthlyCashflow.findFirst({ orderBy: { sort: 'desc' } });
  return latest?.income ?? 0;
}

export async function getSettings(): Promise<AppSettings> {
  return { monthlyIncome: await getMonthlyIncome() };
}

export async function updateSettings(body: unknown): Promise<AppSettings> {
  const { monthlyIncome } = parseBody(settingsSchema, body);
  const userId = await requireUserId();
  const value = String(monthlyIncome);
  await prisma.setting.upsert({ where: { userId_key: { userId, key: INCOME_KEY } }, create: { userId, key: INCOME_KEY, value }, update: { value } });
  return { monthlyIncome };
}

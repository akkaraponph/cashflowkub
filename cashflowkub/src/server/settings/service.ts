import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseBody } from '@/server/validate';

export interface AppSettings {
  monthlyIncome: number;
}

const settingsSchema = z.object({ monthlyIncome: z.number().int().nonnegative() });
const INCOME_KEY = 'monthlyIncome';

/** Configured income, else the latest month's actual income, else 0. */
export async function getMonthlyIncome(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: INCOME_KEY } });
  if (row) return Number(row.value) || 0;
  const latest = await prisma.monthlyCashflow.findFirst({ orderBy: { sort: 'desc' } });
  return latest?.income ?? 0;
}

export async function getSettings(): Promise<AppSettings> {
  return { monthlyIncome: await getMonthlyIncome() };
}

export async function updateSettings(body: unknown): Promise<AppSettings> {
  const { monthlyIncome } = parseBody(settingsSchema, body);
  await prisma.setting.upsert({ where: { key: INCOME_KEY }, create: { key: INCOME_KEY, value: String(monthlyIncome) }, update: { value: String(monthlyIncome) } });
  return { monthlyIncome };
}

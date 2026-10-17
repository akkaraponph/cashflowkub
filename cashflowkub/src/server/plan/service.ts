import { z } from 'zod';
import { prisma } from '@/lib/db';
import type { PlanItem } from '@/generated/prisma/client';
import { MONTH_RE } from '@/lib/month';
import { badRequest } from '@/server/errors';
import { parseBody } from '@/server/validate';
import { buildPlan, buildSnapshots, type PlanView, type SnapshotsView } from './logic';

const text = z.string().optional();
const int = z.number().int().nonnegative().optional();
const planItemSchema = z.object({
  type: z.enum(['income', 'expense', 'savings']),
  name: z.string().trim().min(1),
  th: text, icon: text, tint: text, cat: text, sub: text,
  planned: int, actual: int,
  month: z.string().regex(MONTH_RE, 'month must be YYYY-MM'),
  sort: z.number().int().optional(),
});

/** month omitted = every month (Go parity); malformed = 400. */
export async function getPlan(month?: string): Promise<PlanView> {
  if (month !== undefined && !MONTH_RE.test(month)) throw badRequest(`invalid month: ${month} (expected YYYY-MM)`);
  return buildPlan(await prisma.planItem.findMany({ where: month ? { month } : {}, orderBy: [{ sort: 'asc' }, { id: 'asc' }] }));
}

export async function getSnapshots(): Promise<SnapshotsView> {
  const [snaps, hist] = await Promise.all([
    prisma.assetSnapshot.findMany({ orderBy: { sort: 'asc' } }),
    prisma.netWorthHistory.findMany({ orderBy: { sort: 'asc' } }),
  ]);
  return buildSnapshots(snaps, hist);
}

export function createPlanItem(body: unknown): Promise<PlanItem> {
  return prisma.planItem.create({ data: parseBody(planItemSchema, body) });
}

export function updatePlanItem(id: number, body: unknown): Promise<PlanItem> {
  return prisma.planItem.update({ where: { id }, data: parseBody(planItemSchema.partial(), body) });
}

export async function deletePlanItem(id: number): Promise<void> {
  await prisma.planItem.delete({ where: { id } });
}

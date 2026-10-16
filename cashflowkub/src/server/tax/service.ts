import { z } from 'zod';
import { prisma } from '@/lib/db';
import { CURRENT_YEAR } from '@/lib/prefs';
import { badRequest } from '@/server/errors';
import { getMonthlyIncome } from '@/server/settings/service';
import { parseBody } from '@/server/validate';
import { computeTax, EMPTY_TAX_INPUT, type TaxInput, type TaxResult } from './logic';
import { rulesFor } from './rules';

export interface TaxPlan {
  year: number;
  rulesYear: number;
  assumed: boolean;
  saved: boolean;
  input: TaxInput;
  result: TaxResult;
}

const money = z.number().int().nonnegative().max(1_000_000_000);
const count = (max: number) => z.number().int().min(0).max(max);

export const taxInputSchema: z.ZodType<TaxInput> = z
  .strictObject({
    salary: money, freelance: money, otherNet: money, withheld: money, spouse: z.boolean(),
    children: count(20), children2018Extra: count(20), parents: count(4), disabledDependents: count(10),
    maternity: money, socialSecurity: money, lifeInsurance: money, healthInsurance: money, parentHealthInsurance: money,
    pensionInsurance: money, pvd: money, gpf: money, nsf: money, rmf: money, ssf: money, thaiEsg: money,
    homeLoanInterest: money, easyEReceipt: money, donation: money, donationDouble: money,
  })
  .refine((v) => v.children2018Extra <= Math.max(0, v.children - 1), { message: 'children2018Extra cannot exceed children - 1' });

const keyOf = (year: number): string => `tax:${year}`;

export function parseTaxYear(raw: string | null): number {
  if (raw === null || raw === '') return CURRENT_YEAR;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest(`invalid year: ${raw}`);
  return year;
}

function build(year: number, input: TaxInput, saved: boolean): TaxPlan {
  const { rules, rulesYear, assumed } = rulesFor(year);
  return { year, rulesYear, assumed, saved, input, result: computeTax(input, rules) };
}

/** Parses a stored plan; anything unreadable counts as not saved. */
function readStored(value: string): TaxInput | null {
  try {
    const parsed = taxInputSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function getTaxPlan(year: number): Promise<TaxPlan> {
  const row = await prisma.setting.findUnique({ where: { key: keyOf(year) } });
  const stored = row ? readStored(row.value) : null;
  if (stored) return build(year, stored, true);
  return build(year, { ...EMPTY_TAX_INPUT, salary: (await getMonthlyIncome()) * 12 }, false);
}

export async function saveTaxPlan(year: number, body: unknown): Promise<TaxPlan> {
  const input = parseBody(taxInputSchema, body);
  const value = JSON.stringify(input);
  await prisma.setting.upsert({ where: { key: keyOf(year) }, create: { key: keyOf(year), value }, update: { value } });
  return build(year, input, true);
}

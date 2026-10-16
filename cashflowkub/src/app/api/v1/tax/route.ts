import { ok, readJson, route } from '@/server/http';
import { getTaxPlan, parseTaxYear, saveTaxPlan } from '@/server/tax/service';

const yearOf = (req: Request): number => parseTaxYear(new URL(req.url).searchParams.get('year'));

export const GET = route(async (req: Request) => ok(await getTaxPlan(yearOf(req))));

export const PUT = route(async (req: Request) => ok(await saveTaxPlan(yearOf(req), await readJson(req))));

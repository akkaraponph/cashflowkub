import { ok, route } from '@/server/http';
import { getSmartPlan, parsePlanningParams } from '@/server/debt/planning';

export const GET = route(async (req: Request) => ok(await getSmartPlan(parsePlanningParams(new URL(req.url).searchParams).target)));

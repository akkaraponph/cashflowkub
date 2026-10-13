import { ok, route } from '@/server/http';
import { getPayoffComparison, parsePlanningParams } from '@/server/debt/planning';

export const GET = route(async (req: Request) => {
  const { strategy, extra } = parsePlanningParams(new URL(req.url).searchParams);
  return ok(await getPayoffComparison(strategy, extra));
});

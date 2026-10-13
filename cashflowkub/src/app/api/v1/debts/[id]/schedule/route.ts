import { ok, parseId, route } from '@/server/http';
import { getDebtSchedule } from '@/server/debt/service';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => ok(await getDebtSchedule(parseId((await ctx.params).id))));

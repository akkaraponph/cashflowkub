import { ok, parseId, readJson, route } from '@/server/http';
import { payDebt } from '@/server/debt/service';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, ctx: Ctx) =>
  ok(await payDebt(parseId((await ctx.params).id), await readJson(req, { optional: true }))),
);

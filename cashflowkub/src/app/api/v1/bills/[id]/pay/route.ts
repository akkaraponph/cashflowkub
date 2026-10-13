import { ok, parseId, readJson, route } from '@/server/http';
import { toggleBillPaid } from '@/server/bill/service';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) =>
  ok(await toggleBillPaid(parseId((await ctx.params).id), await readJson(req, { optional: true }))),
);

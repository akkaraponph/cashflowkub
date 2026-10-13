import { noContent, ok, parseId, readJson, route } from '@/server/http';
import { deleteDebt, getDebt, updateDebt } from '@/server/debt/service';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => ok(await getDebt(parseId((await ctx.params).id))));

const update = route(async (req: Request, ctx: Ctx) => ok(await updateDebt(parseId((await ctx.params).id), await readJson(req))));
export const PUT = update;
export const PATCH = update;

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  await deleteDebt(parseId((await ctx.params).id));
  return noContent();
});

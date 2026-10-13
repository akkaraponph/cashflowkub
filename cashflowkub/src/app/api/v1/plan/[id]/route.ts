import { noContent, ok, parseId, readJson, route } from '@/server/http';
import { deletePlanItem, updatePlanItem } from '@/server/plan/service';

type Ctx = { params: Promise<{ id: string }> };

const update = route(async (req: Request, ctx: Ctx) => ok(await updatePlanItem(parseId((await ctx.params).id), await readJson(req))));
export const PUT = update;
export const PATCH = update;

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  await deletePlanItem(parseId((await ctx.params).id));
  return noContent();
});

import { noContent, ok, parseId, readJson, route } from '@/server/http';
import { notFound } from '@/server/errors';
import { isResourceName, type ResourceName } from '@/server/reference/resources';
import { deleteResource, getResource, updateResource } from '@/server/reference/service';

type Ctx = { params: Promise<{ resource: string; id: string }> };

async function target(ctx: Ctx): Promise<{ name: ResourceName; id: number }> {
  const { resource, id } = await ctx.params;
  if (!isResourceName(resource)) throw notFound();
  return { name: resource, id: parseId(id) };
}

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { name, id } = await target(ctx);
  return ok(await getResource(name, id));
});

const update = route(async (req: Request, ctx: Ctx) => {
  const { name, id } = await target(ctx);
  return ok(await updateResource(name, id, await readJson(req)));
});
export const PUT = update;
export const PATCH = update;

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { name, id } = await target(ctx);
  await deleteResource(name, id);
  return noContent();
});

import { created, list, readJson, route } from '@/server/http';
import { notFound } from '@/server/errors';
import { isResourceName, type ResourceName } from '@/server/reference/resources';
import { createResource, listResource } from '@/server/reference/service';

type Ctx = { params: Promise<{ resource: string }> };

async function resourceOf(ctx: Ctx): Promise<ResourceName> {
  const { resource } = await ctx.params;
  if (!isResourceName(resource)) throw notFound();
  return resource;
}

export const GET = route(async (_req: Request, ctx: Ctx) => list(await listResource(await resourceOf(ctx))));

export const POST = route(async (req: Request, ctx: Ctx) => created(await createResource(await resourceOf(ctx), await readJson(req))));

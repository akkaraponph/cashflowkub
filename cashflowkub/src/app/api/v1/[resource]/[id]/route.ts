import { proxyToBackend } from '@/server/backend/client';

type Ctx = { params: Promise<{ resource: string; id: string }> };

async function target(ctx: Ctx): Promise<string> {
  const { resource, id } = await ctx.params;
  return `/api/v1/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`;
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  return proxyToBackend(req, await target(ctx));
}

export async function PUT(req: Request, ctx: Ctx): Promise<Response> {
  return proxyToBackend(req, await target(ctx));
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  return proxyToBackend(req, await target(ctx));
}

export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  return proxyToBackend(req, await target(ctx));
}

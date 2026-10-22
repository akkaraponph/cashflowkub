import { proxyToBackend } from '@/server/backend/client';

type Ctx = { params: Promise<{ resource: string }> };

async function target(ctx: Ctx): Promise<string> {
  const { resource } = await ctx.params;
  return `/api/v1/${encodeURIComponent(resource)}`;
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  return proxyToBackend(req, await target(ctx));
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  return proxyToBackend(req, await target(ctx));
}

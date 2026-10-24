import { proxyToBackend } from '@/server/backend/client';
type Ctx = { params: Promise<{ id: string }> };
const forward = async (req: Request, ctx: Ctx) => proxyToBackend(req, `/api/v1/plan/${(await ctx.params).id}`);
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;

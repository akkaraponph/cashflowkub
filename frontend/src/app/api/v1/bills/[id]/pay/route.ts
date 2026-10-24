import { proxyToBackend } from '@/server/backend/client';
type Ctx = { params: Promise<{ id: string }> };
export const PATCH = async (req: Request, ctx: Ctx) => proxyToBackend(req, `/api/v1/bills/${(await ctx.params).id}/pay`);

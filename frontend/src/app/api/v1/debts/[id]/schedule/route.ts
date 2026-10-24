import { proxyToBackend } from '@/server/backend/client';
type Ctx={params:Promise<{id:string}>};
export const GET=async(req:Request,ctx:Ctx)=>proxyToBackend(req,`/api/v1/debts/${(await ctx.params).id}/schedule`);

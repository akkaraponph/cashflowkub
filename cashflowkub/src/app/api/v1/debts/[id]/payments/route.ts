import { proxyToBackend } from '@/server/backend/client';
type Ctx={params:Promise<{id:string}>};
const forward=async(req:Request,ctx:Ctx)=>proxyToBackend(req,`/api/v1/debts/${(await ctx.params).id}/payments`);
export const GET=forward; export const POST=forward;

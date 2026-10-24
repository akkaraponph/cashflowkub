import { proxyToBackend } from '@/server/backend/client';
type Ctx={params:Promise<{id:string;paymentId:string}>};
export const DELETE=async(req:Request,ctx:Ctx)=>{const p=await ctx.params;return proxyToBackend(req,`/api/v1/debts/${p.id}/payments/${p.paymentId}`)};

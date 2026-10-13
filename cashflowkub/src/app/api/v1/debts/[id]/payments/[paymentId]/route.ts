import { ok, parseId, route } from '@/server/http';
import { deletePayment } from '@/server/debt/service';

type Ctx = { params: Promise<{ id: string; paymentId: string }> };

/** Returns the recomputed debt so the client can show the reopened balance. */
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { id, paymentId } = await ctx.params;
  return ok(await deletePayment(parseId(id), parseId(paymentId)));
});

import { created, list, parseId, readJson, route } from '@/server/http';
import { listPayments, recordPayment } from '@/server/debt/service';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => list(await listPayments(parseId((await ctx.params).id))));

export const POST = route(async (req: Request, ctx: Ctx) => created(await recordPayment(parseId((await ctx.params).id), await readJson(req))));

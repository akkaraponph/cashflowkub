import { ok, route } from '@/server/http';
import { getBillSummary } from '@/server/bill/service';

export const GET = route(async (req: Request) => ok(await getBillSummary(new URL(req.url).searchParams.get('month') ?? undefined)));

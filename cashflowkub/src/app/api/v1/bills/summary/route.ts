import { ok, route } from '@/server/http';
import { getBillSummary } from '@/server/bill/service';

export const GET = route(async () => ok(await getBillSummary()));

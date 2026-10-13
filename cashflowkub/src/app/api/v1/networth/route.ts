import { ok, route } from '@/server/http';
import { getNetWorth } from '@/server/analytics/service';

export const GET = route(async () => ok(await getNetWorth()));

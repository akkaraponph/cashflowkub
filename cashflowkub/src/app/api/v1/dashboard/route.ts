import { ok, route } from '@/server/http';
import { getDashboard } from '@/server/analytics/service';

export const GET = route(async () => ok(await getDashboard()));

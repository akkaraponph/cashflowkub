import { ok, route } from '@/server/http';
import { getReports } from '@/server/analytics/service';

export const GET = route(async () => ok(await getReports()));

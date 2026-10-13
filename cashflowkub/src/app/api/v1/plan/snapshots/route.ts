import { ok, route } from '@/server/http';
import { getSnapshots } from '@/server/plan/service';

export const GET = route(async () => ok(await getSnapshots()));

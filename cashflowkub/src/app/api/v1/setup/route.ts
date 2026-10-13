import { ok, route } from '@/server/http';
import { getSetup } from '@/server/setup/service';

export const GET = route(async () => ok(await getSetup()));

import { ok, readJson, route } from '@/server/http';
import { getSettings, updateSettings } from '@/server/settings/service';

export const GET = route(async () => ok(await getSettings()));

export const PUT = route(async (req: Request) => ok(await updateSettings(await readJson(req))));

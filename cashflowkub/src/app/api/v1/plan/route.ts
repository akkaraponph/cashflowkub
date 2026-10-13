import { created, ok, readJson, route } from '@/server/http';
import { createPlanItem, getPlan } from '@/server/plan/service';

export const GET = route(async (req: Request) => ok(await getPlan(new URL(req.url).searchParams.get('month') ?? undefined)));

export const POST = route(async (req: Request) => created(await createPlanItem(await readJson(req))));

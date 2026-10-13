import { created, list, readJson, route } from '@/server/http';
import { createDebt, listDebts } from '@/server/debt/service';

export const GET = route(async (req: Request) => list(await listDebts(new URL(req.url).searchParams.get('status') ?? undefined)));

export const POST = route(async (req: Request) => created(await createDebt(await readJson(req))));

import { created, list, readJson, route } from '@/server/http';
import { createBill, listBills } from '@/server/bill/service';

export const GET = route(async (req: Request) => list(await listBills(new URL(req.url).searchParams.get('status') ?? undefined)));

export const POST = route(async (req: Request) => created(await createBill(await readJson(req))));

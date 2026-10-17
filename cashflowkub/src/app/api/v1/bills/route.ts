import { created, list, readJson, route } from '@/server/http';
import { createBill, listBills } from '@/server/bill/service';

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  return list(await listBills(q.get('status') ?? undefined, q.get('kind') ?? undefined));
});

export const POST = route(async (req: Request) => created(await createBill(await readJson(req))));

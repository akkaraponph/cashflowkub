import { created, list, readJson, route } from '@/server/http';
import { createBill, listBills } from '@/server/bill/service';

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const status = q.get('status');
  return list(await listBills({
    month: q.get('month') ?? undefined,
    status: status === 'paid' || status === 'unpaid' ? status : undefined,
    kind: q.get('kind') ?? undefined,
  }));
});

export const POST = route(async (req: Request) => created(await createBill(await readJson(req))));

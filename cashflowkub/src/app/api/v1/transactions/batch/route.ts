import { ok, readJson, route } from '@/server/http';
import { createTransactions, deleteTransactions } from '@/server/transaction/service';

export const POST = route(async (req: Request) => {
  const rows = await createTransactions(await readJson(req));
  return Response.json({ data: rows }, { status: 201 });
});

export const DELETE = route(async (req: Request) => ok(await deleteTransactions(await readJson(req))));

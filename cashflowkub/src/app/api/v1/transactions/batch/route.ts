import { readJson, route } from '@/server/http';
import { createTransactions } from '@/server/transaction/service';

export const POST = route(async (req: Request) => {
  const rows = await createTransactions(await readJson(req));
  return Response.json({ data: rows }, { status: 201 });
});

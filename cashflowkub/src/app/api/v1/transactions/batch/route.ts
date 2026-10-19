import { created, ok, readJson, route } from '@/server/http';
import { createTransactions, deleteTransactions } from '@/server/transaction/service';

export const POST = route(async (req: Request) => created({ data: await createTransactions(await readJson(req)) }));

export const DELETE = route(async (req: Request) => ok(await deleteTransactions(await readJson(req))));

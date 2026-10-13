import { created, list, readJson, route } from '@/server/http';
import { parseTxFilter } from '@/server/transaction/logic';
import { createTransaction, listTransactions } from '@/server/transaction/service';

export const GET = route(async (req: Request) => list(await listTransactions(parseTxFilter(new URL(req.url).searchParams))));

export const POST = route(async (req: Request) => created(await createTransaction(await readJson(req))));

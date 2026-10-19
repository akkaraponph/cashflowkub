import { ok, publicRoute } from '@/server/http';

export const GET = publicRoute(async () => ok({ status: 'ok', service: 'cashflowkub' }));

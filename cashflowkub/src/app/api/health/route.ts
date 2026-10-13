import { ok, route } from '@/server/http';

export const GET = route(async () => ok({ status: 'ok', service: 'cashflowkub' }));

import { proxyToBackend } from '@/server/backend/client';

export const GET = (req: Request) => proxyToBackend(req, '/api/v1/plan/snapshots');

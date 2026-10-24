import { proxyToBackend } from '@/server/backend/client';

export const GET = (req: Request) => proxyToBackend(req, '/api/v1/tax');
export const PUT = (req: Request) => proxyToBackend(req, '/api/v1/tax');

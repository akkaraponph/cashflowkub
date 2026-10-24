import { proxyToBackend } from '@/server/backend/client';

export const POST = (req: Request) => proxyToBackend(req, '/api/v1/transactions/batch');
export const DELETE = (req: Request) => proxyToBackend(req, '/api/v1/transactions/batch');

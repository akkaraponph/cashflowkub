import { proxyToBackend } from '@/server/backend/client';

export function GET(req: Request): Promise<Response> {
  return proxyToBackend(req, '/api/v1/settings');
}

export function PUT(req: Request): Promise<Response> {
  return proxyToBackend(req, '/api/v1/settings');
}

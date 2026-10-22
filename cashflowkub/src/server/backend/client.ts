import { headers } from 'next/headers';
import { getSession } from '@/server/auth/auth';
import { ApiError } from '@/lib/api-client';

function backendOrigin(): string {
  const origin = process.env.BACKEND_URL;
  if (!origin) throw new Error('BACKEND_URL is not set');
  return origin.endsWith('/') ? origin : `${origin}/`;
}

function serviceToken(): string {
  const token = process.env.BACKEND_SERVICE_TOKEN;
  if (!token) throw new Error('BACKEND_SERVICE_TOKEN is not set');
  return token;
}

function authenticatedHeaders(userId: string, incoming?: Headers): Headers {
  const outgoing = new Headers();
  for (const name of ['accept', 'content-type']) {
    const value = incoming?.get(name);
    if (value) outgoing.set(name, value);
  }
  outgoing.set('authorization', `Bearer ${serviceToken()}`);
  outgoing.set('x-cfk-user-id', userId);
  return outgoing;
}

async function sessionUser(incoming: Headers): Promise<string | null> {
  const session = await getSession(incoming);
  return session?.user.id ?? null;
}

function unauthorized(): Response {
  return Response.json({ error: 'not signed in', code: 'unauthorized' }, { status: 401 });
}

async function backendFetch<T>(url: URL, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code: string | undefined;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') message = body.error;
      if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string') code = body.code;
    } catch {
      // Preserve the upstream status when a private service returns a non-JSON error.
    }
    throw new ApiError(response.status, message, code);
  }
  return (await response.json()) as T;
}

/** Server Component client. The session is resolved on the incoming Next.js request. */
export async function backendJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const incoming = await headers();
  const userId = await sessionUser(incoming);
  if (!userId) throw new ApiError(401, 'not signed in', 'unauthorized');
  const url = new URL(path, backendOrigin());
  const requestHeaders = authenticatedHeaders(userId, new Headers(init.headers));
  return backendFetch<T>(url, { ...init, headers: requestHeaders });
}

/** Authenticated public API gateway. Browser identity headers are never forwarded. */
export async function proxyToBackend(req: Request, path: string): Promise<Response> {
  const userId = await sessionUser(req.headers);
  if (!userId) return unauthorized();

  const url = new URL(path, backendOrigin());
  url.search = new URL(req.url).search;
  const headers = authenticatedHeaders(userId, req.headers);
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  const upstream = await fetch(url, { method: req.method, headers, body, cache: 'no-store' });
  const responseHeaders = new Headers();
  for (const name of ['content-type', 'content-disposition', 'cache-control']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

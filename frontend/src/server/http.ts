// Route-handler helpers: error mapping, body/id parsing, response envelopes.
import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { runAsUser } from '@/lib/user-context';
import { getSession } from '@/server/auth/auth';
import { badRequest, HttpError } from '@/server/errors';

// Rows carry their owner's userId; API row shapes keep the keys they had before tenancy.
const withoutOwner = (key: string, value: unknown): unknown => (key === 'userId' ? undefined : value);
const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value, withoutOwner), { status, headers: { 'Content-Type': 'application/json' } });

export const ok = (value: unknown): Response => json(value);
export const created = (value: unknown): Response => json(value, 201);
export const list = (rows: unknown[]): Response => json({ data: rows });
export const noContent = (): Response => new Response(null, { status: 204 });

function toErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) return NextResponse.json(err.code ? { error: err.message, code: err.code } : { error: err.message }, { status: err.status });
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'resource not found', code: 'notFound' }, { status: 404 });
    if (err.code === 'P2002') return NextResponse.json({ error: 'resource already exists' }, { status: 409 });
  }
  console.error(err);
  return NextResponse.json({ error: 'internal server error' }, { status: 500 });
}

/** Wraps a handler with no auth, so every thrown error becomes a JSON error response. */
export function publicRoute<A extends unknown[]>(fn: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/**
 * Wraps a handler that needs a signed-in user: 401 without a session, otherwise the handler runs
 * as that user, so every Prisma query it makes is scoped to their rows. Next passes the Request
 * first even when the handler ignores it.
 */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return publicRoute(async (...args: A) => {
    const req = args[0];
    const session = req instanceof Request ? await getSession(req.headers) : null;
    if (!session) return NextResponse.json({ error: 'not signed in', code: 'unauthorized' }, { status: 401 });
    return runAsUser(session.user.id, () => fn(...args));
  });
}

/** Reads a JSON body. Empty body: `{}` when optional, otherwise 400. */
export async function readJson(req: Request, opts: { optional?: boolean } = {}): Promise<unknown> {
  const text = await req.text();
  if (text.trim() === '') {
    if (opts.optional) return {};
    throw badRequest('request body is required');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('request body is not valid JSON');
  }
}

export function parseId(raw: string): number {
  if (!/^\d{1,9}$/.test(raw)) throw badRequest(`invalid id: ${raw}`);
  return Number(raw);
}

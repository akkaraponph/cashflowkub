import { prisma } from '@/lib/db';
import { seedDatabase } from '../../prisma/seed-lib';

export const resetDb = (): Promise<void> => seedDatabase(prisma);

type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

/** Invokes a route handler directly. `body` is JSON-encoded unless it is already a string. */
export async function call<P = Record<string, string>>(
  handler: Handler<P>,
  opts: { method?: string; url?: string; body?: unknown; params?: P } = {},
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests assert on arbitrary JSON
): Promise<{ status: number; json: any }> {
  const init: RequestInit = { method: opts.method ?? 'GET' };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  const res = await handler(new Request(`http://test${opts.url ?? '/'}`, init), { params: Promise.resolve((opts.params ?? {}) as P) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

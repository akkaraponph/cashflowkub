import { AsyncLocalStorage } from 'node:async_hooks';
import { cache } from 'react';

export type Scope = { kind: 'user'; userId: string } | { kind: 'system' };

const store = new AsyncLocalStorage<Scope>();

// `await` inside the store: Prisma queries are lazy thenables that run when awaited, so
// returning one unawaited would run it outside the scope (and fail closed).
export function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ kind: 'user', userId }, async () => await fn());
}

export function runAsSystem<T>(fn: () => Promise<T>): Promise<T> {
  return store.run({ kind: 'system' }, async () => await fn());
}

export function currentScope(): Scope | null {
  return store.getStore() ?? null;
}

// Next-dependent: only reached outside any ALS store (server components / actions).
// Imports are lazy so unit tests never load next or the auth config.
const sessionUserId = cache(async (): Promise<string | null> => {
  const { headers } = await import('next/headers');
  const { getSession } = await import('@/server/auth/auth');
  const session = await getSession(await headers());
  return session?.user.id ?? null;
});

export async function requireUserId(): Promise<string> {
  const scope = store.getStore();
  if (scope?.kind === 'user') return scope.userId;
  if (scope?.kind === 'system') throw new Error('system scope has no user');
  const userId = await sessionUserId();
  if (userId) return userId;
  const { redirect } = await import('next/navigation');
  return redirect('/login');
}

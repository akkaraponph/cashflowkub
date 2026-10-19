import { cache } from 'react';
import { headers } from 'next/headers';
import { getSession } from '@/server/auth/auth';

export type CurrentUser = { id: string; name: string; email: string };

/** The signed-in user for this server render, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession(await headers());
  return session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null;
});

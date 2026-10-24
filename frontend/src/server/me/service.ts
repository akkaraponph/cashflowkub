import { backendInternal } from '@/server/backend/client';

/** Adds the standard categories for a new account. Rust applies this operation idempotently. */
export async function defaultDataFor(userId: string): Promise<void> {
  await backendInternal('/internal/v1/me/default-data', userId, { method: 'POST' });
}

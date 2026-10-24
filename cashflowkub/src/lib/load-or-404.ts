import { notFound } from 'next/navigation';
import { ApiError } from '@/lib/api-client';
import { HttpError } from '@/server/errors';

/** Runs a service call; a 400/404 HttpError renders the Next.js not-found page. */
export async function loadOr404<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if ((err instanceof HttpError || err instanceof ApiError) && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
}

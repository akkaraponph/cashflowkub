import { z } from 'zod';
import { badRequest } from '@/server/errors';

/** Validates untrusted input; a failure becomes a 400 with zod's readable message. */
export function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw badRequest(z.prettifyError(result.error));
  return result.data;
}

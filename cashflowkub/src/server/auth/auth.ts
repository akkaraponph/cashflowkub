import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/lib/db';

export const PRIVACY_VERSION = '2026-10-19';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

export const auth = betterAuth({
  secret: requireEnv('BETTER_AUTH_SECRET'),
  baseURL: requireEnv('BETTER_AUTH_URL'),
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  account: { modelName: 'authAccount' },
  user: {
    additionalFields: {
      privacyVersion: { type: 'string', required: true, input: true },
      privacyAcceptedAt: { type: 'date', required: false, input: false },
    },
    deleteUser: { enabled: true },
  },
  rateLimit: { enabled: process.env.BETTER_AUTH_RATE_LIMIT !== 'off' },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if ((user as { privacyVersion?: unknown }).privacyVersion !== PRIVACY_VERSION) {
            throw new APIError('BAD_REQUEST', { message: 'privacy_version_required' });
          }
          return { data: { ...user, privacyAcceptedAt: new Date() } };
        },
      },
    },
  },
});

export async function getSession(headers: Headers): Promise<{ user: { id: string; email: string; name: string } } | null> {
  return auth.api.getSession({ headers });
}

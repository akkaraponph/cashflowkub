import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { basePrisma } from '@/lib/db';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { runAsUser } from '@/lib/user-context';
import { defaultDataFor } from '@/server/me/service';

export { PRIVACY_VERSION };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

export const auth = betterAuth({
  secret: requireEnv('BETTER_AUTH_SECRET'),
  baseURL: requireEnv('BETTER_AUTH_URL'),
  database: prismaAdapter(basePrisma, { provider: 'postgresql' }),
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
  hooks: {
    // Better Auth only checks the password on delete-user when one is sent (a fresh session may skip it). D5 says the password is always required.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/delete-user') return;
      const password = (ctx.body as { password?: unknown } | null | undefined)?.password;
      if (typeof password !== 'string' || password === '') throw new APIError('BAD_REQUEST', { message: 'password_required' });
    }),
  },
  databaseHooks: {
    user: {
      update: {
        // The notice version is changed only by POST /api/v1/me/privacy (plain Prisma, so it never passes through here).
        before: async (data) => {
          if ('privacyVersion' in data || 'privacyAcceptedAt' in data) throw new APIError('BAD_REQUEST', { message: 'privacy_version_not_editable' });
        },
      },
      create: {
        before: async (user) => {
          if ((user as { privacyVersion?: unknown }).privacyVersion !== PRIVACY_VERSION) {
            throw new APIError('BAD_REQUEST', { message: 'privacy_version_required' });
          }
          return { data: { ...user, privacyAcceptedAt: new Date() } };
        },
        // Runs after the user row is committed.
        after: async (user) => {
          await runAsUser(user.id, () => defaultDataFor(user.id));
        },
      },
    },
  },
});

export async function getSession(headers: Headers): Promise<{ user: { id: string; email: string; name: string; privacyVersion: string } } | null> {
  return auth.api.getSession({ headers }) as Promise<{ user: { id: string; email: string; name: string; privacyVersion: string } } | null>;
}

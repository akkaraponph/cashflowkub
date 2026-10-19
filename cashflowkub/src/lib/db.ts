import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { currentScope, requireUserId } from '@/lib/user-context';
import { OWNED_MODELS, scopeArgs } from '@/server/tenancy';

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see .env.example)');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

// Reuse one client across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Unscoped client: sees every user's rows. Only for auth, the seed and admin scripts. */
export const basePrisma: PrismaClient = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

/**
 * Scoped client: every query and write on an owned model is limited to the current user.
 * With no user context it fails closed (requireUserId throws or redirects to /login);
 * runAsSystem passes queries through unchanged.
 */
export const prisma = basePrisma.$extends({
  name: 'tenancy',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!OWNED_MODELS.has(model)) return query(args);
        if (currentScope()?.kind === 'system') return query(args);
        const userId = await requireUserId();
        return query(scopeArgs(model, operation, args as Record<string, unknown>, userId) as typeof args);
      },
    },
  },
});

/** The scoped client's type; use it wherever code typed a PrismaClient. */
export type Db = typeof prisma;
/** The client handed to an interactive `prisma.$transaction(async (tx) => …)` callback. */
export type DbTx = Parameters<Parameters<Db['$transaction']>[0]>[0];

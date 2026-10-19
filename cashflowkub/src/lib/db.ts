import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { currentScope, requireUserId } from '@/lib/user-context';
import { decryptDeep, encryptData } from '@/server/crypto/fields';
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

type Args = Record<string, unknown>;

const WRITES_DATA = new Set(['create', 'update', 'updateMany', 'updateManyAndReturn']);

/** Encrypts the free-text columns in whatever write payload the operation carries. */
function encryptArgs(model: string, operation: string, args: Args): Args {
  const enc = (d: unknown): unknown => (Array.isArray(d) ? d.map((r) => encryptData(model, r as Args)) : encryptData(model, (d ?? {}) as Args));
  if (WRITES_DATA.has(operation) || operation === 'createMany' || operation === 'createManyAndReturn') return { ...args, data: enc(args.data) };
  if (operation === 'upsert') return { ...args, create: enc(args.create), update: enc(args.update) };
  return args;
}

/**
 * Scoped client: every query and write on an owned model is limited to the current user, and
 * the free-text columns in ENCRYPTED_FIELDS are encrypted on write and decrypted on read.
 * With no user context it fails closed (requireUserId throws or redirects to /login);
 * runAsSystem skips scoping but still encrypts.
 */
export const prisma = basePrisma.$extends({
  name: 'tenancy',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!OWNED_MODELS.has(model)) return query(args);
        let a = args as Args;
        if (currentScope()?.kind !== 'system') a = scopeArgs(model, operation, a, await requireUserId());
        return decryptDeep(await query(encryptArgs(model, operation, a) as typeof args));
      },
    },
  },
});

/** The scoped client's type; use it wherever code typed a PrismaClient. */
export type Db = typeof prisma;
/** The client handed to an interactive `prisma.$transaction(async (tx) => …)` callback. */
export type DbTx = Parameters<Parameters<Db['$transaction']>[0]>[0];

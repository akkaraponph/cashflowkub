import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { basePrisma } from '../src/lib/db';
import { runAsSystem } from '../src/lib/user-context';
import { ENCRYPTED_FIELDS, encryptField, isEncrypted } from '../src/server/crypto/fields';
import { OWNED_MODELS } from '../src/server/tenancy';

export const LEGACY_OWNER = 'legacy-owner';

type Row = Record<string, unknown>;
interface Delegate {
  findMany(args: { where: Row }): Promise<Row[]>;
  deleteMany(args: { where: Row }): Promise<unknown>;
  updateMany(args: { where: Row; data: Row }): Promise<{ count: number }>;
  update(args: { where: Row; data: Row }): Promise<unknown>;
}

/**
 * Hands every row owned by the migration's placeholder user to the account with this email,
 * encrypts the free-text columns that were stored as plaintext, and deletes the placeholder.
 * Categories and settings are unique per user and key: the account's sign-up defaults that
 * collide with a legacy row are replaced by the legacy row.
 * Returns the number of rows moved per model.
 */
export async function claimLegacyData(email: string): Promise<Record<string, number>> {
  // Explicit system scope: nothing here may depend on a request user, whoever calls this.
  return runAsSystem(async () => {
    const target = await basePrisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!target) throw new Error(`no user with email ${email}`);
    if (target.id === LEGACY_OWNER) throw new Error('cannot claim into the placeholder user');
    return basePrisma.$transaction(async (tx) => {
      const delegates = tx as unknown as Record<string, Delegate>;
      const counts: Record<string, number> = {};
      for (const model of OWNED_MODELS) {
        const table = delegates[model.charAt(0).toLowerCase() + model.slice(1)]!;
        const legacy: Row = { userId: LEGACY_OWNER };
        if (model === 'Category' || model === 'Setting') {
          const keys = (await table.findMany({ where: legacy })).map((r) => r.key);
          await table.deleteMany({ where: { userId: target.id, key: { in: keys } } });
        }
        let moved = 0;
        const fields = ENCRYPTED_FIELDS[model];
        if (fields) {
          for (const row of await table.findMany({ where: legacy })) {
            const data: Row = { userId: target.id };
            for (const f of fields) {
              const v = row[f];
              if (typeof v === 'string' && v !== '' && !isEncrypted(v)) data[f] = encryptField(v);
            }
            await table.update({ where: { id: row.id }, data });
            moved += 1;
          }
        }
        moved += (await table.updateMany({ where: legacy, data: { userId: target.id } })).count;
        counts[model] = moved;
      }
      await tx.user.deleteMany({ where: { id: LEGACY_OWNER } });
      return counts;
    }, { maxWait: 10_000, timeout: 120_000 });
  });
}

async function main(): Promise<void> {
  const i = process.argv.indexOf('--email');
  const email = i >= 0 ? process.argv[i + 1] : undefined;
  if (!email) {
    console.error('usage: pnpm db:claim --email <email>');
    process.exitCode = 1;
    return;
  }
  try {
    const counts = await claimLegacyData(email);
    for (const [model, n] of Object.entries(counts)) console.log(`${model}: ${n}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await basePrisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();

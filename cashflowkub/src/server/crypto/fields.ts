import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Free-text columns encrypted at rest. Never filter, sort or group by these in SQL. */
export const ENCRYPTED_FIELDS: Record<string, readonly string[]> = {
  Transaction: ['name', 'note'],
  DebtPayment: ['note'],
  Debt: ['lender'],
};

const PREFIX = 'enc:v1:';
const TAG_BYTES = 16;

export const isEncrypted = (value: string): boolean => value.startsWith(PREFIX);

// Read on every call (no fallback) so a missing or malformed key fails loudly instead of storing plaintext.
function key(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error('DATA_ENCRYPTION_KEY is not set');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes');
  return buf;
}

export function encryptField(plain: string): string {
  if (plain === '') return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv, { authTagLength: TAG_BYTES });
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ct.toString('base64url')}`;
}

/** Values without the prefix are legacy plaintext and pass through; a bad tag throws. */
export function decryptField(value: string): string {
  if (!isEncrypted(value)) return value;
  const [iv, tag, ct] = value.slice(PREFIX.length).split(':');
  if (iv === undefined || tag === undefined || ct === undefined) throw new Error('malformed encrypted value');
  const tagBytes = Buffer.from(tag, 'base64url');
  if (tagBytes.length !== TAG_BYTES) throw new Error('malformed encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'), { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tagBytes);
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

/** Relations a result may include that lead to another model with encrypted columns. */
const RELATIONS: Record<string, Record<string, string>> = {
  Debt: { payments: 'DebtPayment' },
  DebtPayment: { debt: 'Debt' },
};

/**
 * Decrypts the model's ENCRYPTED_FIELDS in a result (row or array of rows), following the
 * included relations in RELATIONS. Other columns are never touched, so a user-typed value
 * that happens to start with the prefix stays as typed. Dates, Decimals and other class
 * instances are left alone.
 */
export function decryptResult<T>(model: string, value: T): T {
  if (Array.isArray(value)) return value.map((v) => decryptResult(model, v)) as T;
  if (value === null || typeof value !== 'object') return value;
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const f of ENCRYPTED_FIELDS[model] ?? []) {
    const v = out[f];
    if (typeof v === 'string') out[f] = decryptField(v);
  }
  for (const [rel, target] of Object.entries(RELATIONS[model] ?? {})) {
    if (out[rel] !== undefined) out[rel] = decryptResult(target, out[rel]);
  }
  return out as T;
}

/** Encrypts the model's free-text columns in a write payload (plain strings or `{ set }`). */
export function encryptData(model: string, data: Record<string, unknown>): Record<string, unknown> {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields) return data;
  // Nested writes would bypass encryption; no service uses them.
  if (model === 'Debt' && data.payments !== undefined) throw new Error('nested debt payment writes are not allowed');
  const out = { ...data };
  for (const f of fields) {
    const v = out[f];
    if (typeof v === 'string') out[f] = encryptField(v);
    else if (v !== null && typeof v === 'object' && typeof (v as { set?: unknown }).set === 'string') {
      out[f] = { ...(v as object), set: encryptField((v as { set: string }).set) };
    }
  }
  return out;
}

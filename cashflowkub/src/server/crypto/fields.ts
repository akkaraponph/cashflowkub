import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Free-text columns encrypted at rest. Never filter, sort or group by these in SQL. */
export const ENCRYPTED_FIELDS: Record<string, readonly string[]> = {
  Transaction: ['name', 'note'],
  DebtPayment: ['note'],
  Debt: ['lender'],
};

const PREFIX = 'enc:v1:';

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
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ct.toString('base64url')}`;
}

/** Values without the prefix are legacy plaintext and pass through; a bad tag throws. */
export function decryptField(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const [iv, tag, ct] = value.slice(PREFIX.length).split(':');
  if (iv === undefined || tag === undefined || ct === undefined) throw new Error('malformed encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

/** Decrypts every prefixed string in a result tree; Dates, Decimals and other class instances are left alone. */
export function decryptDeep<T>(value: T): T {
  if (typeof value === 'string') return (value.startsWith(PREFIX) ? decryptField(value) : value) as T;
  if (Array.isArray(value)) return value.map(decryptDeep) as T;
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value) as unknown;
    if (proto !== Object.prototype && proto !== null) return value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decryptDeep(v)])) as T;
  }
  return value;
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

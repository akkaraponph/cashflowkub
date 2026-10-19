import { Prisma } from '@/generated/prisma/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { decryptResult, decryptField, encryptData, encryptField } from '@/server/crypto/fields';

const KEY = Buffer.alloc(32, 7).toString('base64');
const original = process.env.DATA_ENCRYPTION_KEY;
process.env.DATA_ENCRYPTION_KEY = KEY;
afterEach(() => {
  process.env.DATA_ENCRYPTION_KEY = KEY;
});

describe('field encryption', () => {
  it("round-trips Thai text 'ยืมแม่ 5,000 ค่าหมอ'", () => {
    const enc = encryptField('ยืมแม่ 5,000 ค่าหมอ');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc).not.toContain('ยืมแม่');
    expect(decryptField(enc)).toBe('ยืมแม่ 5,000 ค่าหมอ');
  });

  it('the same input encrypts to different ciphertexts', () => {
    expect(encryptField('abc')).not.toBe(encryptField('abc'));
  });

  it('empty string stays empty', () => {
    expect(encryptField('')).toBe('');
    expect(decryptField('')).toBe('');
  });

  it('plaintext without the prefix passes through decryptField', () => {
    expect(decryptField('Rent')).toBe('Rent');
  });

  it('a flipped ciphertext byte throws', () => {
    const parts = encryptField('secret note').split(':');
    const bytes = Buffer.from(parts[4]!, 'base64url');
    bytes[0] = bytes[0]! ^ 1;
    parts[4] = bytes.toString('base64url');
    expect(() => decryptField(parts.join(':'))).toThrow();
  });

  it("a missing key throws 'DATA_ENCRYPTION_KEY is not set'", () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(() => encryptField('x')).toThrow('DATA_ENCRYPTION_KEY is not set');
  });

  it("a 16-byte key throws 'DATA_ENCRYPTION_KEY must be 32 bytes'", () => {
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64');
    expect(() => encryptField('x')).toThrow('DATA_ENCRYPTION_KEY must be 32 bytes');
  });

  it('a tag truncated to 4 bytes throws', () => {
    const parts = encryptField('secret note').split(':');
    parts[3] = Buffer.from(parts[3]!, 'base64url').subarray(0, 4).toString('base64url');
    expect(() => decryptField(parts.join(':'))).toThrow();
  });

  it('decryptResult handles arrays, nested includes, Dates and Prisma Decimals unchanged', () => {
    const date = new Date('2026-10-19');
    const amount = new Prisma.Decimal('12.50');
    const tree = [{ lender: encryptField('แม่'), paid: amount, payments: [{ note: encryptField('ค่าหมอ'), date }, { note: 'plain', date }] }];
    const out = decryptResult('Debt', tree);
    expect(out[0]!.lender).toBe('แม่');
    expect(out[0]!.payments.map((p) => p.note)).toEqual(['ค่าหมอ', 'plain']);
    expect(out[0]!.paid).toBe(amount);
    expect(out[0]!.payments[0]!.date).toBe(date);
  });

  it('decryptResult touches only the model columns', () => {
    const typed = 'enc:v1:abc';
    expect(decryptResult('Account', { name: typed })).toEqual({ name: typed });
    expect(decryptResult('Debt', { name: typed, lender: encryptField('x') })).toEqual({ name: typed, lender: 'x' });
    expect(decryptResult('DebtPayment', { note: encryptField('n'), debt: { lender: encryptField('m'), name: typed } })).toEqual({ note: 'n', debt: { lender: 'm', name: typed } });
  });

  it('encryptData encrypts only the model columns, plain or { set }', () => {
    const out = encryptData('Transaction', { name: 'Lunch', note: { set: 'ค่าหมอ' }, cat: 'Food' });
    expect(out.cat).toBe('Food');
    expect(String(out.name)).toMatch(/^enc:v1:/);
    expect(String((out.note as { set: string }).set)).toMatch(/^enc:v1:/);
    expect(encryptData('Account', { name: 'Cash' })).toEqual({ name: 'Cash' });
  });
});

afterAll(() => {
  if (original === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = original;
});

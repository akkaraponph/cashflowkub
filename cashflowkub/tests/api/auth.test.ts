import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { auth, PRIVACY_VERSION } from '@/server/auth/auth';

const post = (path: string, body: unknown): Promise<Response> =>
  auth.handler(
    new Request(`http://test/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://test' },
      body: JSON.stringify(body),
    }),
  );

const signUp = (over: Record<string, unknown> = {}): Promise<Response> =>
  post('sign-up/email', { name: 'Ploy', email: 'ploy@example.test', password: 'abcdefghij', privacyVersion: PRIVACY_VERSION, ...over });

describe('auth', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE users, sessions, auth_accounts, verifications CASCADE');
  });
  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE users, sessions, auth_accounts, verifications CASCADE');
  });

  it('signs up with a 10-char password and the current privacy version', async () => {
    const res = await signUp();
    expect(res.status).toBe(200);
    const [row] = await prisma.$queryRaw<{ privacy_version: string; privacy_accepted_at: Date }[]>`SELECT privacy_version, privacy_accepted_at FROM users`;
    expect(row.privacy_version).toBe('2026-10-19');
    expect(Math.abs(Date.now() - row.privacy_accepted_at.getTime())).toBeLessThan(5000);
  });

  it('rejects a 9-char password', async () => {
    expect((await signUp({ password: 'abcdefghi' })).status).toBe(400);
  });

  it("rejects sign-up without privacyVersion or with '2020-01-01'", async () => {
    for (const privacyVersion of [undefined, '2020-01-01']) {
      const res = await signUp({ privacyVersion });
      expect([400, 422]).toContain(res.status);
    }
    expect(await prisma.user.count()).toBe(0);
  });

  it('signs in and returns a session cookie', async () => {
    await signUp();
    const res = await post('sign-in/email', { email: 'ploy@example.test', password: 'abcdefghij' });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('session_token');
  });
});

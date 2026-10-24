import { beforeEach, describe, expect, it } from 'vitest';
import * as privacyRoute from '@/app/api/v1/me/privacy/route';
import { basePrisma } from '@/lib/db';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { runAsUser } from '@/lib/user-context';
import { defaultDataFor } from '@/server/me/service';
import { call, demoUserId, resetDb } from './helpers';

beforeEach(resetDb);

const accept = (body: unknown, cookie?: string | null) => call(privacyRoute.POST, { method: 'POST', url: '/api/v1/me/privacy', body, ...(cookie !== undefined ? { cookie } : {}) });
const stored = async () => basePrisma.user.findUniqueOrThrow({ where: { id: await demoUserId() }, select: { privacyVersion: true, privacyAcceptedAt: true } });

describe('POST /api/v1/me/privacy', () => {
  it('accepting the current version updates both columns', async () => {
    await basePrisma.user.update({ where: { id: await demoUserId() }, data: { privacyVersion: '2020-01-01', privacyAcceptedAt: new Date('2020-01-01') } });
    const { status, json } = await accept({ privacy_version: PRIVACY_VERSION });
    expect(status).toBe(200);
    expect(json.privacy_version).toBe(PRIVACY_VERSION);
    expect(Math.abs(Date.now() - new Date(json.privacy_accepted_at).getTime())).toBeLessThan(5000);
    const row = await stored();
    expect(row.privacyVersion).toBe(PRIVACY_VERSION);
    expect(Math.abs(Date.now() - row.privacyAcceptedAt.getTime())).toBeLessThan(5000);
  });

  it('an old version is rejected', async () => {
    const before = await stored();
    for (const body of [{ privacy_version: '2020-01-01' }, {}, { privacy_version: 5 }]) expect((await accept(body)).status).toBe(400);
    expect(await stored()).toEqual(before);
  });

  it('needs a session', async () => {
    expect((await accept({ privacy_version: PRIVACY_VERSION }, null)).status).toBe(401);
  });
});

describe('defaultDataFor', () => {
  it('is idempotent: a second run adds nothing and does not throw', async () => {
    const userId = await demoUserId();
    await basePrisma.category.deleteMany({ where: { userId } });
    await runAsUser(userId, () => defaultDataFor(userId));
    const n = await basePrisma.category.count({ where: { userId } });
    expect(n).toBeGreaterThan(0);
    await runAsUser(userId, () => defaultDataFor(userId));
    expect(await basePrisma.category.count({ where: { userId } })).toBe(n);
  });
});

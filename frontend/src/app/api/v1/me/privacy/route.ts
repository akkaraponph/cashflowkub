import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { requireUserId } from '@/lib/user-context';
import { badRequest } from '@/server/errors';
import { readJson, route } from '@/server/http';

const bodySchema = z.object({ privacy_version: z.literal(PRIVACY_VERSION) });

/** Records that the signed-in user acknowledged the current privacy notice. */
export const POST = route(async (req: Request) => {
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest('privacy_version must be the current version', 'privacyVersionOutdated');
  const userId = await requireUserId();
  const row = await prisma.user.update({
    where: { id: userId },
    data: { privacyVersion: PRIVACY_VERSION, privacyAcceptedAt: new Date() },
    select: { privacyVersion: true, privacyAcceptedAt: true },
  });
  return NextResponse.json({ privacy_version: row.privacyVersion, privacy_accepted_at: row.privacyAcceptedAt.toISOString() });
});

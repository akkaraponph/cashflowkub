// The signed-in user's own account data.
import { prisma } from '@/lib/db';
import { DEFAULT_CATEGORIES } from '../../../prisma/seed-data';

/** Gives a new user the default categories. Runs inside runAsUser(userId), so the scoped client checks the owner. */
export async function defaultDataFor(userId: string): Promise<void> {
  await prisma.category.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })) });
}

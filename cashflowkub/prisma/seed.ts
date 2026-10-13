import { prisma } from '../src/lib/db';
import { seedDatabase } from './seed-lib';

seedDatabase(prisma)
  .then(() => console.log('seed: complete'))
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import { basePrisma } from '../src/lib/db';
import { seedDatabase } from './seed-lib';

seedDatabase(basePrisma)
  .then(() => console.log('seed: complete'))
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => basePrisma.$disconnect());

import { execSync } from 'node:child_process';
import 'dotenv/config';

// Brings the test database schema up to date once per run. Data is reset per
// test file by seedDatabase() (TRUNCATE ... RESTART IDENTITY), never by migrate reset.
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}

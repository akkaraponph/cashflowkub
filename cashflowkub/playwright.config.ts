import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
// The config is evaluated again inside every worker, so the guard and the setup run once, in the main process.
if (!process.env.PW_E2E_READY) {
  if (testDb === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL: the e2e suite reseeds (truncates) it');
  // Workers and the app server both talk to the test database, never the dev one.
  process.env.DATABASE_URL = testDb;
  process.env.PW_E2E_READY = '1';
  execSync('pnpm prisma migrate deploy', { stdio: 'ignore', env: process.env });
}

const PORT = 3210;
// Artifacts live outside the project so nothing under test is touched by the report writers.
const OUT = join(tmpdir(), 'cashflowkub-playwright');

export default defineConfig({
  testDir: './tests/playwright',
  outputDir: join(OUT, 'test-results'),
  // One shared database, reseeded before every test.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: join(OUT, 'report') }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    // A production build: the dev server's hot reload re-navigates the page under the test.
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { NEXT_DIST_DIR: '.next-e2e', DATABASE_URL: testDb },
  },
});

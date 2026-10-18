import { execFileSync } from 'node:child_process';
import { test as base, expect, type APIRequestContext } from '@playwright/test';

const ORIGIN = 'http://localhost:3210';

/** Reseeds the test database through the project's own seed script (the generated Prisma client cannot load in Playwright's CJS runner). */
export function reseed(): void {
  execFileSync('./node_modules/.bin/tsx', ['prisma/seed.ts'], { stdio: 'pipe', env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } });
}

/** Every test starts from the canonical seed, in English (the app's default), with "today" fixed at 2026-06-18 by the app. */
export const test = base.extend<{ lang: 'en' | 'th'; reseedFirst: boolean }>({
  lang: ['en', { option: true }],
  reseedFirst: [true, { option: true }],
  page: async ({ page, context, lang, reseedFirst }, use) => {
    if (reseedFirst) reseed();
    await context.addCookies([{ name: 'cfk-lang', value: lang, url: ORIGIN }]);
    await use(page);
  },
});

export { expect };

/** Reads JSON from the app's own API, the way a user's data would be checked. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests assert on arbitrary JSON, as tests/api/helpers.ts does
export async function api<T = any>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(`/api/v1${path}`);
  expect(res.ok(), `${path} → ${res.status()}`).toBe(true);
  return res.json();
}

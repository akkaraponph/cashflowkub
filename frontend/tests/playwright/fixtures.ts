import { execFileSync } from 'node:child_process';
import { test as base, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';

const ORIGIN = 'http://localhost:3210';

/** Reseeds the test database through the project's own seed script (the generated Prisma client cannot load in Playwright's CJS runner). */
export function reseed(): void {
  execFileSync('./node_modules/.bin/tsx', ['prisma/seed.ts'], { stdio: 'pipe', env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } });
}

/** Every test starts from the canonical seed, in English (the app's default), with "today" fixed at 2026-06-18 by the app. */
export const DEMO_EMAIL = 'demo@cashflowkub.local';

/** Signs the context in as the demo user; the session cookie lands in the context's cookie jar. Reseeding truncates sessions, so call it after every reseed. */
export async function signInAsDemo(context: BrowserContext): Promise<void> {
  const res = await context.request.post(`${ORIGIN}/api/auth/sign-in/email`, {
    data: { email: DEMO_EMAIL, password: process.env.SEED_DEMO_PASSWORD },
    headers: { Origin: ORIGIN },
  });
  expect(res.ok(), `demo sign-in → ${res.status()}`).toBe(true);
}

/** Every test starts signed in as the demo user (`signedIn: false` opts out). `request` shares the browser context's cookies. */
export const test = base.extend<{ lang: 'en' | 'th'; reseedFirst: boolean; signedIn: boolean }>({
  lang: ['en', { option: true }],
  reseedFirst: [true, { option: true }],
  signedIn: [true, { option: true }],
  // Depends on `page` so a request-only test is still reseeded and signed in.
  request: async ({ page, context }, use) => {
    void page;
    await use(context.request);
  },
  page: async ({ page, context, lang, reseedFirst, signedIn }, use) => {
    if (reseedFirst) reseed();
    if (signedIn) await signInAsDemo(context);
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

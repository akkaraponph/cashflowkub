import { basePrisma } from '@/lib/db';
import { runAsUser } from '@/lib/user-context';
import { auth, PRIVACY_VERSION } from '@/server/auth/auth';
import { DEMO_EMAIL, seedDatabase } from '../../prisma/seed-lib';

export { DEMO_EMAIL };

let cachedCookie: Promise<string> | null = null;
let cachedDemoId: Promise<string> | null = null;

/** Reseeds; the seed truncates users and sessions, so cached demo credentials are dropped. */
export const resetDb = async (): Promise<void> => {
  cachedCookie = null;
  cachedDemoId = null;
  await seedDatabase(basePrisma);
};

/** POSTs to Better Auth's handler, as the browser client would. */
export const authPost = (path: string, body: unknown): Promise<Response> =>
  auth.handler(
    new Request(`http://test/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://test' },
      body: JSON.stringify(body),
    }),
  );

/** The `Cookie` header value a browser would send back after this response. */
export function cookieFrom(res: Response): string {
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]);
  if (cookies.length === 0) throw new Error(`no session cookie (status ${res.status})`);
  return cookies.join('; ');
}

/** Signs up a fresh user (with the default categories) and returns their cookie. */
export async function signUpCookie(email: string, password = 'password-for-tests'): Promise<string> {
  const res = await authPost('sign-up/email', { name: email, email, password, privacyVersion: PRIVACY_VERSION });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  return cookieFrom(res);
}

/** A session cookie for the seeded demo user, signed in once per seed. */
export function demoCookie(): Promise<string> {
  cachedCookie ??= authPost('sign-in/email', { email: DEMO_EMAIL, password: process.env.SEED_DEMO_PASSWORD }).then((res) => {
    if (res.status !== 200) throw new Error(`demo sign-in failed: ${res.status}`);
    return cookieFrom(res);
  });
  return cachedCookie;
}

export function demoUserId(): Promise<string> {
  cachedDemoId ??= basePrisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL }, select: { id: true } }).then((u) => u.id);
  return cachedDemoId;
}

/** Runs direct service or Prisma calls as the demo user, as a signed-in request would. */
export async function asDemo<T>(fn: () => Promise<T>): Promise<T> {
  return runAsUser(await demoUserId(), fn);
}

type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

/**
 * Invokes a route handler directly. `body` is JSON-encoded unless it is already a string.
 * Sends the demo user's session cookie unless `cookie` is given; `null` sends none.
 */
export async function call<P = Record<string, string>>(
  handler: Handler<P>,
  opts: { method?: string; url?: string; body?: unknown; params?: P; cookie?: string | null } = {},
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests assert on arbitrary JSON
): Promise<{ status: number; json: any }> {
  const headers = new Headers();
  const cookie = opts.cookie === undefined ? await demoCookie() : opts.cookie;
  if (cookie !== null) headers.set('Cookie', cookie);
  const init: RequestInit = { method: opts.method ?? 'GET', headers };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    headers.set('Content-Type', 'application/json');
  }
  const res = await handler(new Request(`http://test${opts.url ?? '/'}`, init), { params: Promise.resolve((opts.params ?? {}) as P) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

import 'dotenv/config';
import { describe, expect, it } from 'vitest';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

// [path, text that must appear in English, text that must appear with cfk-lang=th]
const PAGES: [string, string, string][] = [];

async function fetchPage(path: string, cookie = ''): Promise<{ status: number; html: string }> {
  const res = await fetch(BASE + path, { headers: cookie ? { cookie } : {} });
  return { status: res.status, html: await res.text() };
}

describe('pages', () => {
  it.each(PAGES)('%s renders in English and Thai', async (path, en, th) => {
    const enPage = await fetchPage(path);
    expect(enPage.status).toBe(200);
    expect(enPage.html).toContain(en);
    const thPage = await fetchPage(path, 'cfk-lang=th');
    expect(thPage.html).toContain(th);
  });

  it('falls back to English for a garbage language cookie', async () => {
    const page = await fetchPage('/', 'cfk-lang=%3Cscript%3E');
    expect(page.status).toBe(200);
    expect(page.html).toContain('Dashboard');
  });
});

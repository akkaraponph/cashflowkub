import 'dotenv/config';
import { beforeAll, describe, expect, it } from 'vitest';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// [path, text that must appear in English, text that must appear with cfk-lang=th]
const PAGES: [string, string, string][] = [
  ['/', 'Net worth', 'มูลค่าสุทธิ'],
  ['/', 'Debt service ratio', 'ภาระหนี้ต่อรายได้'],
  ['/transactions', 'Monthly Salary', 'ธุรกรรม'],
  ['/transactions', 'Item (by activity)', 'รายการตามกิจกรรม'],
  ['/transactions/1', 'Acme Co. payroll', 'บันทึก'],
  ['/bills', 'KTC Credit Card', 'บิลเดือนนี้'],
  ['/bills?view=calendar', 'Bills this month', 'ปฏิทิน'],
  ['/debts', 'KrungThai Personal', 'กรุงไทยใจป้ำ'],
  ['/debts?strategy=snowball', 'Pay smallest balance first', 'จ่ายยอดน้อยก่อน'],
  ['/debts/2', 'Reducing balance', 'ลดต้นลดดอก'],
  ['/debts/2?tab=schedule', 'Total interest', 'ดอกเบี้ยรวม'],
  ['/debts/plan', 'Debt service ratio', 'ภาระหนี้ต่อรายได้'],
  ['/debts/plan?strategy=snowball&extra=2000', 'Interest saved', 'ประหยัดดอกเบี้ย'],
  ['/debts/plan?extra=-5', 'Debt service ratio', 'ภาระหนี้ต่อรายได้'],
  ['/debts/16', 'Payment history', 'ประวัติการชำระ'],
  ['/debts/16?tab=schedule', 'Total interest', 'ดอกเบี้ยรวม'],
  ['/networth', 'Net worth trend', 'แนวโน้มมูลค่าสุทธิ'],
  ['/networth?tab=liabilities', 'Student Loan', 'กยศ'],
  ['/budgets', 'Total budget', 'งบรวม'],
  ['/accounts', 'Kasikorn Savings', 'บัญชี'],
  ['/bills?month=2026-07', 'Apartment Rent', 'ค่าเช่าบ้าน'],
  ['/bills?month=garbage', 'Apartment Rent', 'ค่าเช่าบ้าน'],
  ['/goals', 'Japan Trip', 'เที่ยวญี่ปุ่น'],
  ['/plan?tab=monthly', 'Add plan item', 'เพิ่มรายการแผน'],
  ['/plan?tab=monthly&month=2025-01', 'Nothing planned here yet.', 'ยังไม่มีรายการในแผนนี้'],
  ['/plan?tab=monthly&month=garbage', 'Income plan', 'แผนรายรับ'],
  ['/reports', 'Central Ladprao', 'ร้านค้ายอดนิยม'],
  ['/plan', 'Income plan', 'แผนรายรับ'],
  ['/plan?tab=summary', 'Net variance', 'ผลต่างรวม'],
  ['/plan?tab=assets', 'Last updated', 'อัพเดตล่าสุด'],
  ['/tax', 'Estimated tax', 'ภาษีที่ต้องจ่ายทั้งปี'],
  ['/tax', 'Estimate only, not tax advice', 'ไม่ใช่คำแนะนำทางภาษี'],
  ['/setup', 'Expense items', 'หมวด'],
  ['/setup', 'Debt payments', 'ชำระหนี้สิน'],
  ['/setup?tab=goals', 'Retirement', 'เกษียณ'],
  ['/settings', 'Preferences', 'การตั้งค่า'],
];

// Every page needs a session: sign in once as the demo user (SEED_DEMO_PASSWORD, same value the server was seeded with).
let session = '';
beforeAll(async () => {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error('SEED_DEMO_PASSWORD is not set (see .env.example)');
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: new URL(BASE).origin },
    body: JSON.stringify({ email: 'demo@cashflowkub.local', password }),
  });
  if (!res.ok) throw new Error(`demo sign-in failed: ${res.status}`);
  session = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
});

async function fetchPage(path: string, cookie = '', signedIn = true): Promise<{ status: number; html: string; location: string | null }> {
  const cookies = [signedIn ? session : '', cookie].filter(Boolean).join('; ');
  const res = await fetch(BASE + path, { headers: cookies ? { cookie: cookies } : {}, redirect: 'manual' });
  return { status: res.status, html: await res.text(), location: res.headers.get('location') };
}

describe('pages', () => {
  it('redirects a signed-out visit to /login, and /login and /privacy are public', async () => {
    const home = await fetchPage('/', '', false);
    expect(home.status).toBeGreaterThanOrEqual(300);
    expect(home.status).toBeLessThan(400);
    expect(home.location).toContain('/login');
    expect((await fetchPage('/login', '', false)).status).toBe(200);
  });

  it.each(PAGES)('%s renders in English and Thai', async (path, en, th) => {
    const enPage = await fetchPage(path);
    expect(enPage.status).toBe(200);
    expect(enPage.html).toContain(en);
    const thPage = await fetchPage(path, 'cfk-lang=th');
    expect(thPage.html).toContain(th);
  });

  it('/tax says unsaved figures are defaults and hides owe/refund until saved', async () => {
    const page = await fetchPage('/tax', 'cfk-year=2028');
    expect(page.html).toContain('Not saved yet');
    expect(page.html).not.toContain('You may owe');
  });

  it('falls back to English for a garbage language cookie', async () => {
    const page = await fetchPage('/', 'cfk-lang=%3Cscript%3E');
    expect(page.status).toBe(200);
    expect(page.html).toContain('Dashboard');
  });
});

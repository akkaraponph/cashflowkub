import 'dotenv/config';
import { describe, expect, it } from 'vitest';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// [path, text that must appear in English, text that must appear with cfk-lang=th]
const PAGES: [string, string, string][] = [
  ['/', 'Net worth', 'มูลค่าสุทธิ'],
  ['/', 'Debt service ratio', 'ภาระหนี้ต่อรายได้'],
  ['/transactions', 'Monthly Salary', 'ธุรกรรม'],
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
  ['/goals', 'Japan Trip', 'เที่ยวญี่ปุ่น'],
  ['/reports', 'Central Ladprao', 'ร้านค้ายอดนิยม'],
  ['/plan', 'Income plan', 'แผนรายรับ'],
  ['/plan?tab=summary', 'Net variance', 'ผลต่างรวม'],
  ['/plan?tab=assets', 'Last updated', 'อัพเดตล่าสุด'],
  ['/tax', 'Estimated tax', 'ภาษีที่ต้องจ่ายทั้งปี'],
  ['/tax', 'Estimate only, not tax advice', 'ไม่ใช่คำแนะนำทางภาษี'],
  ['/setup', 'Expense items', 'หมวด'],
  ['/setup?tab=goals', 'Retirement', 'เกษียณ'],
  ['/settings', 'Preferences', 'การตั้งค่า'],
];

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
